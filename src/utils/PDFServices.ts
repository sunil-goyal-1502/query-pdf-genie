
import { nanoid } from "nanoid";
import * as pdfjs from "pdfjs-dist";

// Initialize PDF.js worker
// We'll use the workerPort approach which doesn't require loading an external file
pdfjs.GlobalWorkerOptions.workerPort = new Worker(
  new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url)
);

export interface PDFDocument {
  id: string;
  name: string;
  size: string;
  file: File;
  content?: string;
  pages?: string[];
}

export interface QuestionAnswer {
  question: string;
  answer: string;
  sources?: {
    documentName: string;
    pageNumber: number;
    excerpt: string;
  }[];
}

export interface AIConfig {
  provider: "openai" | "claude";
  apiKey: string;
  model: string;
}

// Helper to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  else return (bytes / 1048576).toFixed(1) + " MB";
};

// Real PDF text extraction using PDF.js
const extractTextFromPDF = async (file: File): Promise<string[]> => {
  try {
    console.log("Starting PDF text extraction for:", file.name);
    
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log("File converted to ArrayBuffer");
    
    // Load the PDF document
    console.log("Loading PDF document...");
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    console.log("PDF loaded, pages:", pdf.numPages);
    
    const numPages = pdf.numPages;
    const pagesContent: string[] = [];
    
    // Extract text from each page
    for (let i = 1; i <= numPages; i++) {
      console.log(`Processing page ${i} of ${numPages}`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items.map((item: any) => 
        'str' in item ? item.str : '');
      pagesContent.push(textItems.join(' '));
      console.log(`Completed page ${i}`);
    }
    
    console.log("PDF text extraction complete");
    return pagesContent;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw error;
  }
};

// Find relevant content passages from documents based on the question
const findRelevantPassages = (
  question: string, 
  documents: PDFDocument[]
): { documentName: string; pageNumber: number; content: string; }[] => {
  const passages: { documentName: string; pageNumber: number; content: string; }[] = [];
  
  // Search for relevant content in documents
  documents.forEach((doc) => {
    if (doc.pages) {
      doc.pages.forEach((pageContent, pageIndex) => {
        // Simple keyword matching - in a real app, this would be more sophisticated
        const questionWords = question.toLowerCase().split(/\s+/).filter(word => 
          word.length > 3 && !['what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how', 'does', 'did', 'about'].includes(word)
        );
        
        let isRelevant = false;
        for (const word of questionWords) {
          if (pageContent.toLowerCase().includes(word)) {
            isRelevant = true;
            break;
          }
        }
        
        if (isRelevant) {
          passages.push({
            documentName: doc.name,
            pageNumber: pageIndex + 1,
            content: pageContent,
          });
        }
      });
    }
  });
  
  return passages;
};

// Get answer from OpenAI
const getOpenAIAnswer = async (
  question: string,
  relevantPassages: { documentName: string; pageNumber: number; content: string; }[],
  apiKey: string,
  model: string = "gpt-4o-mini"
): Promise<string> => {
  try {
    // Prepare context from relevant passages (limit size to avoid token limits)
    const context = relevantPassages.map(passage => 
      `Document: ${passage.documentName}, Page: ${passage.pageNumber}\n${passage.content.substring(0, 1000)}...`
    ).join('\n\n').substring(0, 10000);
    
    console.log("Connecting to OpenAI...");
    
    // Create the prompt for the AI model
    const prompt = `
You are a helpful assistant that answers questions based on the provided documents.
Answer the question based only on the information from the documents. If you don't find relevant information, admit that you don't know.

CONTEXT FROM DOCUMENTS:
${context}

QUESTION: ${question}

Please provide a concise answer with information found in the documents.
`;

    // Make API call to OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that answers questions based on provided document contents.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      
      if (response.status === 401) {
        return "Error: Invalid or missing API key. Please check your OpenAI API key.";
      } else {
        return `Error connecting to OpenAI: ${errorData.error?.message || response.statusText}`;
      }
    }

    const data = await response.json();
    console.log("OpenAI response received");
    
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error getting OpenAI answer:", error);
    return "Sorry, there was an error connecting to OpenAI. Please try again later.";
  }
};

// Get answer from Claude
const getClaudeAnswer = async (
  question: string,
  relevantPassages: { documentName: string; pageNumber: number; content: string; }[],
  apiKey: string,
  model: string = "claude-3-haiku-20240307"
): Promise<string> => {
  try {
    // Prepare context from relevant passages (limit size to avoid token limits)
    const context = relevantPassages.map(passage => 
      `Document: ${passage.documentName}, Page: ${passage.pageNumber}\n${passage.content.substring(0, 1000)}...`
    ).join('\n\n').substring(0, 10000);
    
    console.log("Connecting to Claude...");
    
    // Create the prompt for the AI model
    const prompt = `
You are a helpful assistant that answers questions based on the provided documents.
Answer the question based only on the information from the documents. If you don't find relevant information, admit that you don't know.

CONTEXT FROM DOCUMENTS:
${context}

QUESTION: ${question}

Please provide a concise answer with information found in the documents.
`;

    // Make API call to Claude
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 800,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Claude API error:", errorData);
      
      if (response.status === 401) {
        return "Error: Invalid or missing API key. Please check your Claude API key.";
      } else {
        return `Error connecting to Claude: ${errorData.error?.message || response.statusText}`;
      }
    }

    const data = await response.json();
    console.log("Claude response received");
    
    return data.content[0].text;
  } catch (error) {
    console.error("Error getting Claude answer:", error);
    return "Sorry, there was an error connecting to Claude. Please try again later.";
  }
};

// Enhanced question answering with AI
const generateAnswerFromDocuments = async (
  question: string,
  documents: PDFDocument[],
  aiConfig: AIConfig
): Promise<QuestionAnswer> => {
  // Find relevant passages from the documents
  const relevantPassages = findRelevantPassages(question, documents);
  
  // No relevant content found
  if (relevantPassages.length === 0) {
    return {
      question,
      answer: "I couldn't find specific information about that in the uploaded documents. Please try rephrasing your question or uploading additional documentation.",
      sources: [],
    };
  }
  
  // Get AI-generated answer based on the selected provider
  let aiAnswer = "";
  if (aiConfig.provider === "openai") {
    aiAnswer = await getOpenAIAnswer(question, relevantPassages, aiConfig.apiKey, aiConfig.model);
  } else if (aiConfig.provider === "claude") {
    aiAnswer = await getClaudeAnswer(question, relevantPassages, aiConfig.apiKey, aiConfig.model);
  }
  
  // Create source references
  const sources = relevantPassages.map(passage => {
    // Extract a relevant excerpt (first 200 chars)
    const excerpt = passage.content.substring(0, 200) + "...";
    
    return {
      documentName: passage.documentName,
      pageNumber: passage.pageNumber,
      excerpt,
    };
  });
  
  return {
    question,
    answer: aiAnswer,
    sources: sources.slice(0, 3), // Limit to top 3 sources
  };
};

export const PDFServices = {
  createPDFDocument: (file: File): PDFDocument => {
    return {
      id: nanoid(),
      name: file.name,
      size: formatFileSize(file.size),
      file,
    };
  },

  processPDFDocument: async (document: PDFDocument): Promise<PDFDocument> => {
    try {
      console.log("Processing PDF document:", document.name);
      const pages = await extractTextFromPDF(document.file);
      console.log(`Extracted ${pages.length} pages from ${document.name}`);
      const content = pages.join(' ');
      
      return {
        ...document,
        content,
        pages,
      };
    } catch (error) {
      console.error("Error processing PDF:", error);
      throw new Error(`Failed to process ${document.name}: ${error}`);
    }
  },

  askQuestion: async (
    question: string,
    documents: PDFDocument[],
    aiConfig: AIConfig
  ): Promise<QuestionAnswer> => {
    return generateAnswerFromDocuments(question, documents, aiConfig);
  },
};
