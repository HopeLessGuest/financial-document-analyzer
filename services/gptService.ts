import { ExtractedDataItem, PageText, ChatMessage, QuerySource, StructuredTemplateResponse, ExtractedChartItem } from '../types';

const AZURE_OPENAI_ENDPOINT = "https://ae-sbx-uom.openai.azure.com/";
const API_VERSION = "2024-02-01";

async function callAzureGptApi(payload: object, apiKey: string, deploymentName: string): Promise<any> {
  const url = `${AZURE_OPENAI_ENDPOINT}openai/deployments/${deploymentName}/chat/completions?api-version=${API_VERSION}`;

  // The payload to Azure may not need the model property, as it's defined by the deployment.
  // We can strip it to be safe.
  const { model, ...azurePayload } = payload as { model?: string } & object;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(azurePayload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errorMessage = errorBody?.error?.message || `HTTP error! status: ${response.status}`;
    throw new Error(`Azure OpenAI API error: ${errorMessage}. Please check your endpoint, deployment name, and API key.`);
  }

  return response.json();
}

// Function signatures remain the same to avoid refactoring App.tsx
export const analyzeDocument = async (
  pageTexts: PageText[],
  fileName: string,
  apiKey: string,
  modelName: string // This will be used as the deployment name
): Promise<ExtractedDataItem[]> => {
  if (!apiKey) throw new Error("Azure OpenAI API Key is not provided.");

  let combinedTextForPrompt = `Document: ${fileName}\n\n`;
  pageTexts.forEach(pt => {
    const sanitized = pt.text.length > 15000 ? pt.text.substring(0, 15000) + '... [TRUNCATED]' : pt.text;
    combinedTextForPrompt += `--- Page ${pt.pageNumber} ---\n${sanitized}\n\n`;
  });
  if (combinedTextForPrompt.length > 100000) {
    combinedTextForPrompt = combinedTextForPrompt.substring(0, 100000) + '\n... [TRUNCATED DUE TO OVERALL LENGTH]';
  }

  const systemPrompt = `You are an expert financial document analysis assistant. From the provided text, extract structured financial data. Your response MUST be a valid JSON object with a single key "financialData", which contains an array of financial data items. Each annual data point MUST be a separate JSON object. Each object MUST conform to this structure: { "name": string, "subcategory": string, "value": number | string, "unit": string, "year": number (MANDATORY), "period": string, "page": number, "source": string (max 300 chars), "file": string, "bankName": string, "documentType": string }. 'year' must be a number. 'page' must be accurate. Focus on quantifiable metrics.`;

  const userPrompt = `Please extract the financial data from the following document text:\n\n${combinedTextForPrompt}`;

  const payload = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: "json_object" },
  };

  const data = await callAzureGptApi(payload, apiKey, modelName);
  const content = JSON.parse(data.choices[0].message.content);

  const parsedData = content.financialData;
  if (Array.isArray(parsedData)) {
    return parsedData.map((item: any) => {
      const year = parseInt(String(item.year), 10);
      return {
        name: item.name || "N/A",
        subcategory: item.subcategory || "",
        value: item.value !== undefined ? item.value : "N/A",
        unit: item.unit || "",
        period: item.period || "N/A",
        year: !isNaN(year) ? year : 0,
        page: item.page !== undefined ? item.page : 0,
        source: item.source || "N/A",
        file: item.file || fileName,
        bankName: item.bankName || "",
        documentType: item.documentType || "",
      };
    }) as ExtractedDataItem[];
  } else {
    throw new Error("AI response was valid JSON but did not contain the expected 'financialData' array.");
  }
};

export const analyzeImagesForCharts = async (
  pageImages: { pageNumber: number; imageDataUrl: string; }[],
  apiKey: string,
  modelName: string, // used as deployment name
  onProgress?: (progress: number, message: string) => void
): Promise<Omit<ExtractedChartItem, 'id' | 'file'>[]> => {
  if (!apiKey) throw new Error("Azure OpenAI API Key is not provided.");

  const allExtractedCharts: Omit<ExtractedChartItem, 'id' | 'file'>[] = [];

  const systemPrompt = `You are an expert at identifying visual data representations in financial documents. Analyze the image. Identify all visual charts and graphs and extract their titles (bar charts, line graphs, pie charts, etc.). DO NOT extract simple tables. For each chart, provide its title. If a chart has no visible title, provide a concise, descriptive name. Your response MUST be a JSON object with a single key "charts", which contains an array of objects, each with a "title" key. If no charts are found, return an empty "charts" array.`;

  for (let i = 0; i < pageImages.length; i++) {
    const pageImage = pageImages[i];
    if (onProgress) {
        onProgress(Math.round(((i) / pageImages.length) * 100), `Analyzing page ${pageImage.pageNumber} for charts...`);
    }

    const payload = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            { type: "image_url", image_url: { url: pageImage.imageDataUrl, detail: "low" } },
          ],
        },
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" },
    };
    
    try {
        const data = await callAzureGptApi(payload, apiKey, modelName);
        const content = JSON.parse(data.choices[0].message.content);
        const parsed = content as { charts?: { title: string }[] };
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
        console.error(`Error analyzing page ${pageImage.pageNumber} for charts with Azure GPT:`, error);
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
  apiKey: string,
  modelName: string // used as deployment name
): Promise<string> => {
  if (!apiKey) throw new Error("Azure OpenAI API Key is not provided.");

  const numericalDataSources = allDataSources.filter(ds => ds.dataType === 'numerical' && ds.data.length > 0);
  if (numericalDataSources.length === 0) {
    return "I don't have any data sources to query.";
  }

  const contextData: { [sourceName: string]: ExtractedDataItem[] } = {};
  numericalDataSources.forEach(source => {
    contextData[source.name] = source.data as ExtractedDataItem[];
  });

  let contextDataString = JSON.stringify(contextData, null, 2);
  let isTruncated = false;
  if (contextDataString.length > 150000) {
    contextDataString = contextDataString.substring(0, 150000) + "\n// ... (data truncated)";
    isTruncated = true;
  }

  const systemPrompt = `You are an AI assistant specialized in answering questions about financial data from multiple sources.
Answer the user's question based ONLY on the provided JSON data context.
If information is missing or might be truncated, state that clearly.
If you perform calculations, show the basic calculation.
Mention the source names (e.g., 'file.pdf') when citing data.
Respond in a natural, conversational language. Use Markdown for formatting.
${isTruncated ? "Important Note: The provided JSON data has been truncated. Your information might be incomplete." : ""}`;

  const messages: {role: 'system' | 'user' | 'assistant', content: any}[] = [{ role: 'system', content: systemPrompt }];
  
  messages.push({ role: 'user', content: `Here is the financial data context:\n\`\`\`json\n${contextDataString}\n\`\`\``});
  messages.push({role: 'assistant', content: 'I have received the data. I will answer your questions based only on this information. How can I help?'});
  
  chatHistory.slice(-10).forEach(msg => {
    if (msg.sender === 'user') {
      messages.push({ role: 'user', content: msg.text });
    } else {
      messages.push({ role: 'assistant', content: msg.text });
    }
  });

  // remove latest user message from history as it's the current question
  if(messages.length > 0 && messages[messages.length-1].role === 'user'){
      messages.pop();
  }
  
  messages.push({ role: 'user', content: question });

  const payload = {
    messages: messages,
  };

  const data = await callAzureGptApi(payload, apiKey, modelName);
  return data.choices[0].message.content.trim();
};

export const fillTemplateWithData = async (
  templateText: string,
  allDataSources: QuerySource[],
  apiKey: string,
  modelName: string // used as deployment name
): Promise<StructuredTemplateResponse> => {
    if (!apiKey) throw new Error("Azure OpenAI API Key is not provided.");

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

    const systemPrompt = `You are an expert financial AI assistant. Your task is to fill in a user-provided template using the given JSON context data.
Your response MUST be a single JSON object that strictly adheres to the requested structure, with no other text or markdown.
The structure is: { "filledTemplate": string, "values": Array<{ placeholder: string, value: string, source: { name: string, file: string, page: number, period: string, sourceText: string } }> }.
For each value you find and insert, create a unique placeholder (e.g., {{FILL_0}}), replace it in the template, and add a corresponding entry in the 'values' array with the data and its source.
If you cannot find a value in the context, insert the string "[Data Not Found]" into the template for that spot and do not create a corresponding 'values' entry.`;

    const userPrompt = `**Context Data:**
\`\`\`json
${contextDataString}
\`\`\`

**User's Template:**
\`\`\`
${templateText}
\`\`\`

Please fill the template according to the system instructions and return the structured JSON object.`;

    const payload = {
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
    };

    const data = await callAzureGptApi(payload, apiKey, modelName);
    const parsedData = JSON.parse(data.choices[0].message.content);

    if (parsedData && typeof parsedData.filledTemplate === 'string' && Array.isArray(parsedData.values)) {
      return parsedData as StructuredTemplateResponse;
    } else {
      throw new Error("AI response did not match the expected structure for template filling.");
    }
};
