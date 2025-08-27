import { ExtractedDataItem, PageText, ChatMessage, QuerySource } from '../types';

const OLLAMA_BASE_URL = 'http://localhost:11434';
const MODEL_NAME = 'gpt-oss:20b';

// Utility function to strip ```json fenced code blocks.
function stripCodeFence(s: string): string {
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const m = s.trim().match(fenceRegex);
  return m && m[1] ? m[1].trim() : s.trim();
}

// Utility for safe JSON.parse, throws diagnostic errors.
function parseJsonArrayOrThrow(text: string, rawSampleLabel: string): any[] {
  const cleaned = stripCodeFence(text);
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error('AI response was valid JSON but not an array.');
    }
    return parsed;
  } catch (e) {
    const sample = cleaned.slice(0, 250);
    throw new Error(
      `Failed to parse AI JSON (${rawSampleLabel}). Sample: "${sample}${cleaned.length > 250 ? '...' : ''}"`
    );
  }
}

// ================ analyzeDocument =================
export const analyzeDocument = async (
  pageTexts: PageText[],
  fileName: string,
): Promise<ExtractedDataItem[]> => {

  // Truncation strategy consistent with the Gemini version.
  let combinedTextForPrompt = `Document: ${fileName}\n\n`;
  pageTexts.forEach(pt => {
    const sanitized = pt.text.length > 15000 ? pt.text.substring(0, 15000) + '... [TRUNCATED]' : pt.text;
    combinedTextForPrompt += `--- Page ${pt.pageNumber} ---\n${sanitized}\n\n`;
  });
  if (combinedTextForPrompt.length > 100000) {
    combinedTextForPrompt = combinedTextForPrompt.substring(0, 100000) + '\n... [TRUNCATED DUE TO OVERALL LENGTH]';
  }

  const prompt = `
You are an expert financial document analysis assistant.
From the provided text extracted from the document "${fileName}", extract structured financial data.
The text is provided page by page below:
${combinedTextForPrompt}

Your response MUST be a valid JSON array. Each element in the array should be a JSON object representing a single financial data item.
Each annual data point (even for the same metric from different years or contexts) MUST be a separate JSON object.

Each JSON object MUST conform to the following structure:
{
  "name": "string (e.g., 'Loans' or 'Basic earnings per share')",
  "subcategory": "string (e.g., 'Retail' or 'Wholesale', leave empty or omit if not applicable)",
  "value": "number or string (numeric value, ideally as a number, e.g., 12345.67 or '12,345.67'. If text represents a number like '12.3 million', convert to 12300000. If nil/zero/'--', use 0.)",
  "unit": "string (e.g., 'AUD', '%', 'millions', 'USD millions'. If value was '12.3 million', unit should be 'USD' or similar, not 'millions' if value is already expanded)",
  "year": "number (The financial year, e.g., 2024. This field is MANDATORY and must be a number. Derive it from the 'period' or column header.)",
  "period": "string (e.g., '30 Jun 2024', 'Q1 2023', '2023'). If not available, use 'N/A'.",
  "page": "number (page number from which the data was extracted; must match one of the provided page numbers.)",
  "source": "string (original full paragraph or table row/cell group containing the data point; concise yet complete; max 300 chars.)",
  "file": "string (use '${fileName}')",
  "bankName": "string (leave empty if not identifiable)",
  "documentType": "string (leave empty if not identifiable)"
}

Analyze carefully. 'year' is mandatory and must be a number. 'page' must be accurate. Focus on quantifiable metrics. 
Reply ONLY with the JSON array, no extra text or Markdown.
`.trim();

  // Call Ollama API.
  const payload = { model: MODEL_NAME, prompt, stream: false, format: 'json' };
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    throw new Error(`Ollama analyzeDocument HTTP ${res.status}. ${errTxt}`);
  }

  // With stream:false, the response is a JSON object where the 'response' field contains the text.
  const obj = await res.json() as { response?: string };
  const text = (obj.response || '').trim();
  if (!text) throw new Error('Empty response from Ollama for analyzeDocument.');

  const arr = parseJsonArrayOrThrow(text, 'analyzeDocument');

  // Normalize the output to be consistent with the Gemini version.
  return arr.map((item: any) => {
    const year = parseInt(String(item?.year), 10);
    return {
      name: item?.name ?? 'N/A',
      subcategory: item?.subcategory ?? '',
      value: item?.value ?? 'N/A',
      unit: item?.unit ?? '',
      period: item?.period ?? 'N/A',
      year: Number.isFinite(year) ? year : 0,
      page: item?.page ?? 0,
      source: item?.source ?? 'N/A',
      file: item?.file ?? fileName,
      bankName: item?.bankName ?? '',
      documentType: item?.documentType ?? '',
    } as ExtractedDataItem;
  });
};

// ================ queryExtractedData =================
export const queryExtractedData = async (
  question: string,
  allDataSources: QuerySource[],
  chatHistory: ChatMessage[],
): Promise<string> => {
  if (allDataSources.length === 0) {
    return "I don't have any data sources to query. Please add a document or JSON file.";
  }
  
  const numericalDataSources = allDataSources.filter(ds => ds.dataType === 'numerical' && ds.data.length > 0);

  const bag: { [name: string]: ExtractedDataItem[] } = {};
  numericalDataSources.forEach(s => { bag[s.name] = s.data as ExtractedDataItem[]; });

  let ctx = JSON.stringify(bag, null, 2);
  const MAX = 150000;
  let isTrunc = false;
  if (ctx.length > MAX) {
    ctx = ctx.substring(0, MAX) + `\n// ...(truncated)`;
    isTrunc = true;
  }

  const srcDesc = numericalDataSources.map(s => `- "${s.name}" (type: ${s.type}, items: ${s.data.length})`).join('\n');

  const recent = chatHistory.slice(-10);
  let hist = "Conversation History (most recent first):\n";
  if (recent.length > 1) {
    recent.slice(0, -1).forEach(m => { hist += `${m.sender === 'user' ? 'User' : 'AI'}: ${m.text}\n`; });
  } else {
    hist = "No previous conversation history for this query.\n";
  }

  const prompt = `
You are an AI assistant specialized in answering questions about financial data from multiple sources.
You have access to data from the following sources:
${srcDesc}

The structured data from these sources is provided below in a JSON object:
\`\`\`json
${ctx}
\`\`\`
${isTrunc ? "Important Note: The provided JSON data above has been truncated due to its large size. The information might be incomplete.\n" : ""}

${hist}
Current User Question: "${question}"

Instructions:
1) Answer ONLY using the provided JSON. Do not invent facts.
2) If info is missing (or truncated), say so explicitly.
3) If calculating (sum/avg/% change), show the simple calculation.
4) Mention source names when citing facts (and bankName/documentType if available).
5) Respond concisely in natural language; Markdown allowed for clarity.
Provide your answer now:
`.trim();

  const payload = { model: MODEL_NAME, prompt, stream: false };
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    return `I tried to process your request, but Ollama returned HTTP ${res.status}. ${errTxt}`;
  }

  const obj = await res.json() as { response?: string };
  const text = (obj.response || '').trim();
  return text || "I received an empty response. Please try rephrasing your question or check the data.";
};