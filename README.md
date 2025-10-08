# Financial Document Analyzer

The Financial Document Analyzer is a powerful, web-based tool designed to extract, visualize, and query structured data from financial documents using advanced AI models. It streamlines the process of analyzing complex PDFs by converting unstructured text and charts into actionable, machine-readable JSON data.

## Key Features

*   **Numerical Data Extraction**: Automatically extracts key financial metrics, figures, and data points from PDF files.
*   **Chart Title Extraction**: Identifies visual charts and graphs within a PDF and extracts their titles.
*   **AI-Powered Chat**: Ask natural language questions about your extracted numerical data and get instant, context-aware answers.
*   **Multi-Provider AI Support**: Seamlessly switch between Google's Gemini, OpenAI's GPT for cloud-based power, and a local Ollama instance for privacy and offline use.
*   **Flexible Data Management**: Upload existing JSON data files, view data from multiple sources, and manage them with ease.
*   **Comprehensive Export**: Download extracted data for a single source as a JSON file or package all loaded data sources into a single ZIP archive.

---

## How to Use the Application

The application is organized into four main tabs, each serving a specific purpose in the data analysis workflow.

### 1. Settings (Gear Icon)

Before you begin, configure your AI provider.

*   **AI Model Provider**:
    *   **Gemini**: Select this option to use Google's powerful cloud-based AI. You must provide a valid Gemini API Key. Your key is saved securely in your browser's local storage.
    *   **GPT (Azure OpenAI)**: Select this option to use OpenAI models hosted on Microsoft Azure. You must provide:
        *   An **Azure OpenAI Key** (your subscription key).
        *   A **Deployment Name** that corresponds to a model deployment in your Azure AI Studio (e.g., `gpt-4o`).
        The application is pre-configured to use the `https://ae-sbx-uom.openai.azure.com/` endpoint. Your key is saved securely in your browser's local storage.
    *   **Ollama**: Select this to use a locally running Ollama instance. This is ideal for privacy-focused or offline analysis. The application is pre-configured to connect to `http://localhost:11434` and use the `gpt-oss:20b` model. Ensure your Ollama server is running before using this option.

### 2. Numerical Extraction Tab

This module is for extracting structured financial data (e.g., revenue, profit, expenses) from a PDF document.

**Usage:**
1.  **Upload PDF**: Click the upload area to select a PDF file, or drag and drop it.
2.  **Set Page Range (Optional)**: If you only want to analyze specific pages, enter them in the "Page Range" input (e.g., `2-5, 8, 11-13`). If left blank, the entire document will be processed.
3.  **Analyze**: Click the **"Analyze for Numerical Data"** button.
4.  **Processing**: The application will first extract the raw text from the specified pages and then send it to the selected AI provider for analysis. A progress bar will show the status.
5.  **Completion**: Once complete, the extracted data is added as a new "data source," and you will be automatically switched to the "View Data" tab to see the results.

### 3. Chart Extraction Tab

This module identifies charts and graphs within your PDF and extracts their titles. **Note: This feature requires a multimodal model like Gemini or GPT.**

**Usage:**
1.  **Upload PDF**: Select or drag and drop the PDF file you wish to analyze.
2.  **Set Page Range (Optional)**: Specify the pages you want to scan for charts.
3.  **Extract**: Click the **"Extract Charts"** button.
4.  **Processing**: The application renders the selected PDF pages into images and sends them to the AI provider for visual analysis.
5.  **Completion**: The results are added as a new chart-specific data source and can be viewed in the "View Data" tab.

### 4. View Data Tab

This is the central hub for managing and viewing all your data.

**Features:**
*   **Add Data Source from JSON**: You can upload a `.json` file to add it as a new data source. This is useful for loading previously exported data. The tool accepts two formats:
    1.  The standard application export format (`{ "name": "...", "dataType": "...", "data": [...] }`).
    2.  A simple array of data items (`[...]`).
*   **Manage Data Sources**:
    *   Use the dropdown menu to switch between all loaded data sources.
    *   Click the trash can icon to delete the currently selected data source.
*   **Data Display**:
    *   **Numerical Data**: Displayed as detailed, expandable cards. Click the chevron to view the original source text snippet from the document.
    *   **Chart Data**: Displayed as simple cards showing the chart's title and the page number it was found on.
*   **Download Options**:
    *   **Download JSON**: Saves the data of the *currently selected source* as a single `.json` file.
    *   **Download All (ZIP)**: Packages all data from *every source currently loaded* in the application into a single `.zip` archive for easy portability.

### 5. AI Chat Tab

Interact with your extracted **numerical data** using natural language.

**Usage:**
1.  **Context**: The "Data Sources for Chat Context" section lists all numerical data sources that the AI will use to answer your questions. Chart data is ignored in this tab.
2.  **Ask a Question (Q&A Mode)**: By default, you can type a question into the chat input (e.g., *"What was the total revenue in 2023?"* or *"Compare the net income between 2022 and 2023."*). The AI will analyze the context from all available numerical sources and provide a direct answer.
3.  **Fill a Report (Template Mode)**:
    *   Click the **Template Mode** button (clipboard icon) next to the chat input.
    *   Paste a block of text, such as a financial report template, into the larger input area.
    *   Click send. The AI will read your template, find the corresponding data from your sources, and return the template filled with the correct values.
    *   **Interactive Sources**: Each value filled by the AI will be highlighted. Click on any highlighted value to see a popover with detailed source information, including the original file, page number, and the source text snippet. This allows for quick verification of every data point.
