

import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ExtractedDataItem, PageText, ChatMessage, QuerySource, ExtractedChartItem, StructuredTemplateResponse } from '../types';

export const analyzeDocument = async (
  pageTexts: PageText[],
  fileName: string,
  apiKey: string
): Promise<ExtractedDataItem[]> => {
  if (!apiKey) {
    throw new Error("Gemini API Key is not provided. Please enter your API key in the configuration section.");
  }
  const ai = new GoogleGenAI({ apiKey });


  let combinedTextForPrompt = `Document: ${fileName}\n\n`;
  pageTexts.forEach(pt => {
    const sanitizedText = pt.text.length > 15000 ? pt.text.substring(0, 15000) + '... [TRUNCATED]' : pt.text;
    combinedTextForPrompt += `--- Page ${pt.pageNumber} ---\n${sanitizedText}\n\n`;
  });
  
  if (combinedTextForPrompt.length > 100000) { 
    console.warn("Combined text for prompt is very large, truncating to reduce size.");
    combinedTextForPrompt = combinedTextForPrompt.substring(0, 100000) + "\n... [TRUNCATED DUE TO OVERALL LENGTH]";
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
  "period": "string (e.g., '30 Jun 2024', 'Q1 2023', '2023'). This should capture the specific date or period from the column header. If not available, use 'N/A'.",
  "page": "number (page number from which the 'source' text was extracted, must match one of the provided page numbers. If data is from an uploaded JSON not from a PDF, use 0 or a relevant identifier if available in source JSON)",
  "source": "string (original full paragraph or table row/cell group containing the data point, be concise yet complete for context. Max 300 characters. If from an uploaded JSON, this might be a description or key from the source JSON item.)",
  "file": "string (source file name, use '${fileName}')",
  "bankName": "string (e.g., 'Royal Bank of Canada', 'HSBC Holdings plc'. If not clearly identifiable from the text, leave as an empty string or omit.)",
  "documentType": "string (e.g., 'Annual Report 2023', 'Q1 Financial Results', 'S&P Credit Analysis', 'Sustainability Report'. If not clearly identifiable, leave as an empty string or omit.)"
}

Analyze the text carefully. The 'year' field is mandatory and must be a number. The 'page' field must accurately reflect the page number.
Extract as many relevant financial data points as possible.
If a subcategory is not apparent, omit the 'subcategory' field or set it to an empty string.
Focus on quantifiable financial metrics.
The 'source' text should be the direct snippet from the document that contains the data.
`;

  let response: GenerateContentResponse;
  try {
    response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1, 
        topP: 0.95,
        topK: 64,
      },
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    const finishMessage = response.candidates?.[0]?.finishMessage;
    if (finishReason) console.log(`Gemini [analyzeDocument] Finish Reason: ${finishReason}`);
    if (finishMessage) console.log(`Gemini [analyzeDocument] Finish Message: ${finishMessage}`);
    
    let jsonStr = response.text.trim();
    
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
    }

    try {
      const parsedData = JSON.parse(jsonStr);
      if (Array.isArray(parsedData)) {
        return parsedData.map((item: any) => {
            const year = parseInt(String(item.year), 10);
            return {
                name: item.name || "N/A",
                subcategory: item.subcategory || "",
                value: item.value !== undefined ? item.value : "N/A",
                unit: item.unit || "",
                period: item.period || "N/A",
                year: !isNaN(year) ? year : 0, // Ensure year is a valid number, default to 0 if not.
                page: item.page !== undefined ? item.page : 0,
                source: item.source || "N/A",
                file: item.file || fileName,
                bankName: item.bankName || "",
                documentType: item.documentType || "",
            };
        }) as ExtractedDataItem[];
      } else {
        console.error("Gemini response was valid JSON but not an array:", parsedData);
        throw new Error("AI response was valid JSON but not in the expected array format.");
      }
    } catch (e) {
      console.error("Failed to parse JSON response from Gemini [analyzeDocument]:", e);
      console.error("Full raw Gemini response text for analyzeDocument:", response.text);
      
      let diagnosticMessage = `Failed to parse AI's JSON response during document analysis.`;
      if (finishReason && finishReason !== "STOP") diagnosticMessage += ` Finish Reason: ${finishReason}.`;
      if (finishMessage) diagnosticMessage += ` Finish Message: "${finishMessage}".`;
      const rawTextSample = response.text.substring(0, 250);
      diagnosticMessage += ` Raw text sample: "${rawTextSample}${response.text.length > 250 ? '...' : ''}".`;
      
      throw new Error(diagnosticMessage);
    }
  } catch (error) {
    console.error("Error calling Gemini API or processing its response [analyzeDocument]:", error);
    if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('API_KEY'))) {
         throw new Error('Invalid Gemini API Key. Please check the key you entered.');
    }
    throw error;
  }
};


interface GeminiChartResponse {
  charts: {
    title: string;
  }[];
}

export const analyzeImagesForCharts = async (
  pageImages: { pageNumber: number; imageDataUrl: string; width: number; height: number }[],
  apiKey: string,
  onProgress?: (progress: number, message: string) => void
): Promise<Omit<ExtractedChartItem, 'id' | 'file'>[]> => {
  if (!apiKey) {
    throw new Error("Gemini API Key is not provided.");
  }
  const ai = new GoogleGenAI({ apiKey });

  const allExtractedCharts: Omit<ExtractedChartItem, 'id' | 'file'>[] = [];

  for (let i = 0; i < pageImages.length; i++) {
    const pageImage = pageImages[i];
    if (onProgress) {
        onProgress(Math.round(((i) / pageImages.length) * 100), `Analyzing page ${pageImage.pageNumber} for charts...`);
    }

    const base64Data = pageImage.imageDataUrl.split(',')[1];
    
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data,
      },
    };

    const textPart = {
      text: `You are an expert at identifying visual data representations in financial documents.
Analyze the following image of a document page.

Your task is to identify all visual charts and graphs and extract their titles. This includes, but is not limited to:
- Bar charts
- Line graphs
- Pie charts
- Area charts
- Scatter plots

**CRITICAL INSTRUCTIONS:**
1.  **DO NOT** extract simple, unstyled data tables. Only extract complex visual graphics.
2.  For each chart/graph found, provide its title as accurately as possible.
3.  If a chart has no visible title, provide a concise, descriptive name (e.g., "Bar Chart of Revenue by Quarter").

Your response MUST be a JSON object that strictly adheres to the provided schema. Do not include any markdown fences or other text outside the JSON object.
If no visual charts or graphs are found, return a JSON object with an empty "charts" array.`
    };

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [textPart, imagePart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              charts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: 'The title of the chart or a descriptive name.' },
                  },
                  required: ['title']
                }
              }
            },
            required: ['charts']
          },
          temperature: 0.1,
        },
      });

      let jsonStr = response.text.trim();
      const parsed = JSON.parse(jsonStr) as GeminiChartResponse;

      if (parsed.charts && Array.isArray(parsed.charts)) {
        parsed.charts.forEach(chartInfo => {
          if (chartInfo.title && chartInfo.title.trim().length > 0) {
             allExtractedCharts.push({
                pageNumber: pageImage.pageNumber,
                title: chartInfo.title,
              });
          }
        });
      }

    } catch (error) {
      console.error(`Error analyzing page ${pageImage.pageNumber} for charts:`, error);
    }
  }
  
  if (onProgress) {
    onProgress(100, `AI analysis complete. Found ${allExtractedCharts.length} potential charts.`);
  }

  return allExtractedCharts;
};


export const queryExtractedData = async (
  question: string,
  allDataSources: QuerySource[],
  chatHistory: ChatMessage[],
  apiKey: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error("Gemini API Key is not provided for chat functionality. Please enter your API key.");
  }
  const ai = new GoogleGenAI({ apiKey });

  if (allDataSources.length === 0) {
    return "I don't have any data sources to query. Please add a document or JSON file.";
  }
  
  const contextDataForPrompt: {
    numericalData: { [sourceName: string]: ExtractedDataItem[] };
    chartData: { [sourceName: string]: Omit<ExtractedChartItem, 'id'>[] };
  } = {
    numericalData: {},
    chartData: {},
  };

  allDataSources.forEach(source => {
    if (source.dataType === 'numerical' && source.data.length > 0) {
      contextDataForPrompt.numericalData[source.name] = source.data as ExtractedDataItem[];
    } else if (source.dataType === 'chart' && source.data.length > 0) {
      contextDataForPrompt.chartData[source.name] = (source.data as ExtractedChartItem[]).map(({ id, ...rest }) => rest);
    }
  });

  let contextDataString = JSON.stringify(contextDataForPrompt, null, 2);
  const maxContextLength = 150000; // Max length for the stringified JSON data context
  let isTruncated = false;

  if (contextDataString.length > maxContextLength) {
    console.warn(`Combined JSON data for chat context is very large (${contextDataString.length} chars), truncating.`);
    contextDataString = contextDataString.substring(0, maxContextLength) +
      `\n// ... (Combined data from all sources was too long and has been truncated here. The AI is aware of this truncation.)`;
    isTruncated = true;
  }
  
  const sourceDescriptions = allDataSources
    .map(s => `- "${s.name}" (type: ${s.dataType}, items: ${s.data.length})`)
    .join('\n');

  const recentHistory = chatHistory.slice(-10); 
  let formattedChatHistory = "Conversation History (most recent first):\n";
  if (recentHistory.length > 1) { 
     recentHistory.slice(0, -1).forEach(msg => { // Exclude the current user message which is part of the question
        formattedChatHistory += `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}\n`;
     });
  } else {
    formattedChatHistory = "No previous conversation history for this query.\n";
  }
  
  const prompt = `
You are an AI assistant specialized in answering questions about financial data from multiple sources.
You have access to data from the following sources:
${sourceDescriptions}

The structured data from these sources is provided below in a JSON object format. This object contains 'numericalData' and 'chartData'.
\`\`\`json
${contextDataString}
\`\`\`
${isTruncated ? "Important Note: The provided JSON data above has been truncated due to its large size. The information might be incomplete. You are answering based on this potentially partial data. If you cannot find specific information, it might be due to this truncation.\n" : ""}

${formattedChatHistory}
Current User Question: "${question}"

Instructions for your response:
1.  Carefully analyze the user's current question, the conversation history, and the provided JSON data (both numerical and chart data).
2.  Answer the question directly and concisely using only the information found in the provided JSON data.
3.  For questions about charts, refer to the 'chartData' section, which contains chart titles and their page numbers.
4.  If information comes from a specific source or sources, please mention the source name(s) (e.g., "According to 'Source X'..." or "Combining data from 'Source X' and 'Source Y'..."). This includes mentioning bankName and documentType if relevant and available for a source.
5.  If the information needed to answer the question is not present in any of the provided data sources (or might be missing due to truncation if indicated), explicitly state that (e.g., "I could not find information about Z in the available data sources." or "The information for Z might be incomplete due to data truncation.").
6.  If the question requires a calculation (e.g., sum, difference, average, percentage change) across one or multiple sources, perform the calculation using the relevant data points from the 'numericalData' JSON and state the result. Show the basic calculation if it's simple and helpful.
7.  Do not make up information or use any external knowledge. Your knowledge is strictly limited to the JSON data provided.
8.  Respond in a natural, conversational language. Use Markdown for formatting if it enhances readability (e.g., lists, tables).
9.  If referring to specific data points, you can mention their 'name', 'period', and the source document for clarity.

Provide your answer to the "Current User Question" below:
`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: prompt,
      config: {
        temperature: 0.3, 
        topP: 0.95,
        topK: 64,
      },
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    const finishMessage = response.candidates?.[0]?.finishMessage;
    if (finishReason) console.log(`Gemini [queryExtractedData] Finish Reason: ${finishReason}`);
    if (finishMessage) console.log(`Gemini [queryExtractedData] Finish Message: ${finishMessage}`);

    if (response.text && response.text.trim().length > 0) {
        return response.text.trim();
    } else if (finishReason && finishReason !== "STOP") {
        return `I tried to process your request, but the generation stopped. Reason: ${finishReason}. ${finishMessage || ''}`;
    } else {
        return "I received an empty response. Please try rephrasing your question or check the data.";
    }

  } catch (error) {
    console.error("Error calling Gemini API for chat query:", error);
     if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('API_KEY'))) {
         throw new Error('Invalid Gemini API Key for chat. Please check the key you entered.');
    }
    throw new Error(`An error occurred while trying to answer your question with AI. Details: ${error instanceof Error ? error.message : String(error)}`);
  }
};


export const fillTemplateWithData = async (
  templateText: string,
  allDataSources: QuerySource[],
  apiKey: string
): Promise<StructuredTemplateResponse> => {
  if (!apiKey) {
    throw new Error("Gemini API Key is not provided for this feature.");
  }
  const ai = new GoogleGenAI({ apiKey });

  const numericalData = allDataSources.reduce((acc, source) => {
    if (source.dataType === 'numerical' && source.data.length > 0) {
      acc[source.name] = source.data as ExtractedDataItem[];
    }
    return acc;
  }, {} as { [sourceName: string]: ExtractedDataItem[] });

  let contextDataString = JSON.stringify(numericalData, null, 2);
  if (contextDataString.length > 150000) {
    contextDataString = contextDataString.substring(0, 150000) + "\n// ... (data truncated)";
  }

  const prompt = `
You are an expert financial AI assistant. Your task is to fill in a user-provided template with financial data from a given JSON context.

**Context Data:**
You have access to structured financial data from multiple sources, provided below in a JSON object.
\`\`\`json
${contextDataString}
\`\`\`

**User's Template:**
\`\`\`
${templateText}
\`\`\`

**Instructions:**
1.  Read the User's Template carefully.
2.  Find the corresponding values for the metrics mentioned in the template from the Context Data.
3.  Replace the placeholders or sentences in the template with the values you find.
4.  For every value you insert, you **MUST** provide its source.
5.  If you cannot find a specific value in the context data, you MUST insert the string "[Data Not Found]". Do not invent data.
6.  Your final output **MUST** be a single JSON object that strictly adheres to the provided response schema. Do not include any other text or markdown.

**Output Structure:**
Your response must be a JSON object with two keys: "filledTemplate" and "values".
- \`filledTemplate\`: This string contains the user's template, but with each value you inserted replaced by a unique placeholder (e.g., \`{{FILL_0}}\`, \`{{FILL_1}}\`, etc.).
- \`values\`: This is an array of objects. Each object corresponds to a placeholder in \`filledTemplate\` and contains:
    - \`placeholder\`: The unique placeholder string.
    - \`value\`: The formatted numerical or text value that was inserted.
    - \`source\`: An object detailing where the data came from, including \`name\` (metric name), \`file\`, \`page\`, \`period\`, and \`sourceText\` (the original text snippet).
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            filledTemplate: {
              type: Type.STRING,
              description: "The user's template with placeholders like {{FILL_0}}, {{FILL_1}} for each inserted value."
            },
            values: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  placeholder: { type: Type.STRING, description: "The placeholder used in filledTemplate, e.g., '{{FILL_0}}'." },
                  value: { type: Type.STRING, description: "The formatted value that was inserted, e.g., '1,234.56'." },
                  source: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: "The name of the metric, e.g., 'Total Revenue'." },
                      file: { type: Type.STRING, description: "The source file name." },
                      page: { type: Type.INTEGER, description: "The page number in the source file." },
                      period: { type: Type.STRING, description: "The financial period, e.g., '2023'." },
                      sourceText: { type: Type.STRING, description: "The original text snippet from the document."}
                    },
                    required: ['name', 'file', 'page', 'period', 'sourceText']
                  }
                },
                required: ['placeholder', 'value', 'source']
              }
            }
          },
          required: ['filledTemplate', 'values']
        },
        temperature: 0.1,
      }
    });

    const jsonStr = response.text.trim();
    const parsedData = JSON.parse(jsonStr);

    if (parsedData && typeof parsedData.filledTemplate === 'string' && Array.isArray(parsedData.values)) {
      return parsedData as StructuredTemplateResponse;
    } else {
      throw new Error("AI response did not match the expected structure for template filling.");
    }

  } catch (error) {
    console.error("Error calling Gemini API for template filling:", error);
    throw new Error(`An error occurred while trying to fill the template. Details: ${error instanceof Error ? error.message : String(error)}`);
  }
};