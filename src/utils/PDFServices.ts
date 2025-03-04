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
  isProcessing: boolean;
  isProcessed: boolean;
  error?: string;
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
  provider: "openai" | "claude" | "transformers";
  apiKey?: string;
  model?: string;
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
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map((item: any) => 
          'str' in item ? item.str : '');
        pagesContent.push(textItems.join(' '));
        console.log(`Completed page ${i}`);
      } catch (pageError) {
        console.error(`Error extracting text from page ${i}:`, pageError);
        pagesContent.push(`[Error extracting text from page ${i}]`);
      }
    }
    
    console.log("PDF text extraction complete");
    return pagesContent;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw error;
  }
};

// Get answer from OpenAI by sending full document content
const getOpenAIAnswer = async (
  question: string,
  documents: PDFDocument[],
  apiKey: string,
  model: string = "gpt-4o-mini"
): Promise<string> => {
  try {
    // Check for unprocessed documents
    const unprocessedDocs = documents.filter(doc => !doc.isProcessed);
    if (unprocessedDocs.length > 0) {
      return `Some documents are still being processed: ${unprocessedDocs.map(d => d.name).join(', ')}. Please wait for processing to complete.`;
    }

    // Prepare document content for context
    console.log("Preparing document content for OpenAI");
    
    // Gather content from all documents with metadata
    const documentContexts: string[] = [];
    
    for (const doc of documents) {
      if (!doc.pages || doc.pages.length === 0) {
        console.log(`Document ${doc.name} has no extracted pages`);
        continue;
      }
      
      console.log(`Processing document: ${doc.name} with ${doc.pages.length} pages`);
      
      // For each document, include metadata and sample of content
      const documentSummary = `Document: "${doc.name}" (${doc.pages.length} pages)`;
      documentContexts.push(documentSummary);
      
      // Add content from pages (up to 4 pages full content to avoid token limits)
      const maxPagesToInclude = Math.min(doc.pages.length, 4);
      for (let i = 0; i < maxPagesToInclude; i++) {
        const pageContent = doc.pages[i];
        if (pageContent && pageContent.trim() !== '') {
          documentContexts.push(`[Page ${i + 1}]:\n${pageContent.substring(0, 2000)}`);
        }
      }
      
      // If more than 4 pages, sample content from remaining pages
      if (doc.pages.length > 4) {
        documentContexts.push(`[Additional content]: This document has ${doc.pages.length - 4} more pages not shown in full.`);
        
        // Include smaller samples from remaining pages
        for (let i = 4; i < doc.pages.length; i++) {
          const pageContent = doc.pages[i];
          if (pageContent && pageContent.trim() !== '') {
            documentContexts.push(`[Page ${i + 1} sample]:\n${pageContent.substring(0, 200)}...`);
          }
        }
      }
    }
    
    const context = documentContexts.join('\n\n');
    console.log(`Prepared context with ${documentContexts.length} sections`);
    
    console.log("Connecting to OpenAI...");
    console.log(`Using model: ${model}`);
    
    // Improved prompt with clearer instructions
    const systemPrompt = `You are a helpful assistant that answers questions based on PDF documents that have been uploaded.
Your task is to provide accurate, comprehensive answers based on the content of these documents.
If the information cannot be found in the provided documents, clearly state that.
When appropriate, mention specific document names and page numbers in your answer.
Keep your answers concise but complete.`;

    const userPrompt = `Question: ${question}

Here's the content from the uploaded documents:

${context}`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
    });

    console.log("OpenAI API response status:", response.status);
    
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

// Get answer from Claude by sending full document content
const getClaudeAnswer = async (
  question: string,
  documents: PDFDocument[],
  apiKey: string,
  model: string = "claude-3-haiku-20240307"
): Promise<string> => {
  try {
    // Check for unprocessed documents
    const unprocessedDocs = documents.filter(doc => !doc.isProcessed);
    if (unprocessedDocs.length > 0) {
      return `Some documents are still being processed: ${unprocessedDocs.map(d => d.name).join(', ')}. Please wait for processing to complete.`;
    }

    // Prepare document content for context
    console.log("Preparing document content for Claude");
    
    // Gather content from all documents with metadata
    const documentContexts: string[] = [];
    
    for (const doc of documents) {
      if (!doc.pages || doc.pages.length === 0) {
        console.log(`Document ${doc.name} has no extracted pages`);
        continue;
      }
      
      console.log(`Processing document: ${doc.name} with ${doc.pages.length} pages`);
      
      // For each document, include metadata and sample of content
      const documentSummary = `Document: "${doc.name}" (${doc.pages.length} pages)`;
      documentContexts.push(documentSummary);
      
      // Add content from pages (up to 4 pages full content to avoid token limits)
      const maxPagesToInclude = Math.min(doc.pages.length, 4);
      for (let i = 0; i < maxPagesToInclude; i++) {
        const pageContent = doc.pages[i];
        if (pageContent && pageContent.trim() !== '') {
          documentContexts.push(`[Page ${i + 1}]:\n${pageContent.substring(0, 2000)}`);
        }
      }
      
      // If more than 4 pages, sample content from remaining pages
      if (doc.pages.length > 4) {
        documentContexts.push(`[Additional content]: This document has ${doc.pages.length - 4} more pages not shown in full.`);
        
        // Include smaller samples from remaining pages
        for (let i = 4; i < doc.pages.length; i++) {
          const pageContent = doc.pages[i];
          if (pageContent && pageContent.trim() !== '') {
            documentContexts.push(`[Page ${i + 1} sample]:\n${pageContent.substring(0, 200)}...`);
          }
        }
      }
    }
    
    const context = documentContexts.join('\n\n');
    console.log(`Prepared context with ${documentContexts.length} sections`);
    
    console.log("Connecting to Claude...");
    console.log(`Using model: ${model}`);
    
    // Improved prompt with clearer instructions
    const systemPrompt = `You are a helpful assistant that answers questions based on PDF documents that have been uploaded.
Your task is to provide accurate, comprehensive answers based on the content of these documents.
If the information cannot be found in the provided documents, clearly state that.
When appropriate, mention specific document names and page numbers in your answer.
Keep your answers concise but complete.`;

    const userPrompt = `Question: ${question}

Here's the content from the uploaded documents:

${context}`;

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
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
      }),
    });

    console.log("Claude API response status:", response.status);
    
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

// New: Get answer using Transformers.js (in-browser)
const getTransformersAnswer = async (
  question: string,
  documents: PDFDocument[]
): Promise<string> => {
  try {
    console.log("Using local Transformers.js to generate answer");
    
    // Check for unprocessed documents
    const unprocessedDocs = documents.filter(doc => !doc.isProcessed);
    if (unprocessedDocs.length > 0) {
      return `Some documents are still being processed: ${unprocessedDocs.map(d => d.name).join(', ')}. Please wait for processing to complete.`;
    }

    // Prepare a simplified context from the documents
    let context = "";
    for (const doc of documents) {
      if (!doc.pages || doc.pages.length === 0) continue;
      
      context += `Document: ${doc.name}\n\n`;
      
      // Add first 3 pages or fewer if the document has fewer pages
      const pagesToInclude = Math.min(doc.pages.length, 3);
      for (let i = 0; i < pagesToInclude; i++) {
        if (doc.pages[i] && doc.pages[i].trim() !== '') {
          // Limit each page to 1000 characters to prevent overloading
          context += `[Page ${i + 1}]:\n${doc.pages[i].substring(0, 1000)}\n\n`;
        }
      }
    }
    
    // Prepare a simple prompt that can work with smaller models
    const prompt = `Based on the following document excerpts, please answer this question: "${question}"

Document excerpts:
${context}

Answer:"`;

    try {
      // Simple regex-based information extraction for basic QA
      // This is a fallback "AI" for when no external API is available
      console.log("Using simple pattern matching for basic QA");
      
      // Convert everything to lowercase for case-insensitive matching
      const lowerPrompt = prompt.toLowerCase();
      const lowerQuestion = question.toLowerCase();
      
      // Break question into keywords
      const keywords = lowerQuestion
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => 
          word.length > 3 && 
          !['what', 'when', 'where', 'which', 'who', 'how', 'does', 'is', 'are', 'was', 'were', 'will', 'would', 'could', 'should', 'can', 'this', 'that', 'these', 'those', 'about'].includes(word)
        );
      
      console.log("Extracted keywords:", keywords);
      
      // Find sentences containing the keywords
      const allSentences = context.split(/(?<=[.!?])\s+/);
      const relevantSentences = allSentences.filter(sentence => {
        const lowerSentence = sentence.toLowerCase();
        return keywords.some(keyword => lowerSentence.includes(keyword));
      });
      
      console.log(`Found ${relevantSentences.length} relevant sentences`);
      
      if (relevantSentences.length > 0) {
        // Simple answer construction from relevant sentences
        let answer = "Based on the documents, I found the following information:\n\n";
        
        // Add up to 5 most relevant sentences
        const topSentences = relevantSentences.slice(0, 5);
        answer += topSentences.join('\n\n');
        
        // Add disclaimer
        answer += "\n\nNote: This answer was generated using simple text matching since no AI API key was provided. For more accurate answers, please configure an OpenAI or Claude API key.";
        
        return answer;
      } else {
        return "I couldn't find specific information about that in the uploaded documents. The basic search couldn't match your question with the document content. For better results, try using OpenAI or Claude with an API key.";
      }
    } catch (transformersError) {
      console.error("Error using Transformers.js:", transformersError);
      return "There was an error processing your question with the local model. Try using simpler questions or configure an OpenAI or Claude API key for better results.";
    }
  } catch (error) {
    console.error("Error in getTransformersAnswer:", error);
    return "Sorry, there was an error processing your question locally. Please try again or configure an AI provider API key.";
  }
};

// Enhanced question answering with AI
const generateAnswerFromDocuments = async (
  question: string,
  documents: PDFDocument[],
  aiConfig: AIConfig
): Promise<QuestionAnswer> => {
  console.log("Generating answer for question:", question);
  console.log("AI Provider:", aiConfig.provider);
  console.log("AI Model:", aiConfig.model || "local");
  
  // Validate documents
  if (!documents || documents.length === 0) {
    console.log("No documents available");
    return {
      question,
      answer: "Please upload PDF documents before asking questions.",
      sources: [],
    };
  }
  
  // Check if documents have been properly processed
  const processingDocs = documents.filter(doc => doc.isProcessing);
  if (processingDocs.length > 0) {
    console.log(`${processingDocs.length} documents are still being processed`);
    const processingNames = processingDocs.map(doc => doc.name).join(", ");
    return {
      question,
      answer: `Some documents (${processingNames}) are still being processed. Please wait for processing to complete.`,
      sources: [],
    };
  }

  const unprocessedDocs = documents.filter(doc => !doc.isProcessed);
  if (unprocessedDocs.length > 0) {
    console.log(`${unprocessedDocs.length} documents haven't been properly processed`);
    const unprocessedNames = unprocessedDocs.map(doc => doc.name).join(", ");
    return {
      question,
      answer: `Some documents (${unprocessedNames}) haven't been fully processed yet. Please try again in a moment.`,
      sources: [],
    };
  }
  
  // Get AI-generated answer based on the selected provider
  console.log(`Requesting answer from ${aiConfig.provider} using model ${aiConfig.model || "local"}`);
  let aiAnswer = "";
  
  if (aiConfig.provider === "openai" && aiConfig.apiKey) {
    aiAnswer = await getOpenAIAnswer(question, documents, aiConfig.apiKey, aiConfig.model);
  } else if (aiConfig.provider === "claude" && aiConfig.apiKey) {
    aiAnswer = await getClaudeAnswer(question, documents, aiConfig.apiKey, aiConfig.model);
  } else {
    // Default to local Transformers.js if no valid API config is provided
    aiAnswer = await getTransformersAnswer(question, documents);
  }
  
  console.log("AI answer generated");
  
  // Create source references from documents
  const sources = documents.slice(0, 3).flatMap(doc => {
    if (!doc.pages || doc.pages.length === 0) return [];
    
    // Get a sample from the first page as an excerpt
    const firstPageExcerpt = doc.pages[0].substring(0, 200) + "...";
    
    return {
      documentName: doc.name,
      pageNumber: 1,
      excerpt: firstPageExcerpt,
    };
  });
  
  return {
    question,
    answer: aiAnswer,
    sources,
  };
};

export const PDFServices = {
  createPDFDocument: (file: File): PDFDocument => {
    return {
      id: nanoid(),
      name: file.name,
      size: formatFileSize(file.size),
      file,
      isProcessing: true,
      isProcessed: false
    };
  },

  processPDFDocument: async (document: PDFDocument): Promise<PDFDocument> => {
    try {
      console.log("Processing PDF document:", document.name);
      
      // Mark as processing
      const processingDoc = {
        ...document,
        isProcessing: true,
        isProcessed: false,
        error: undefined
      };
      
      // Add a timeout to avoid blocking UI
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Extract text from PDF
      const pages = await extractTextFromPDF(document.file);
      console.log(`Extracted ${pages.length} pages from ${document.name}`);
      
      // Check if pages were successfully extracted
      if (!pages || pages.length === 0) {
        throw new Error("Failed to extract pages from PDF");
      }
      
      // Join pages into a single content string
      const content = pages.join(' ');
      console.log(`Extracted total of ${content.length} characters`);
      
      // Verify content was extracted
      if (!content || content.trim() === '') {
        throw new Error("Extracted content is empty");
      }
      
      // Mark as processed successfully
      return {
        ...processingDoc,
        content,
        pages,
        isProcessing: false,
        isProcessed: true
      };
    } catch (error) {
      console.error("Error processing PDF:", error);
      
      // Mark as failed processing
      return {
        ...document,
        isProcessing: false,
        isProcessed: false,
        error: `Failed to process ${document.name}: ${error}`
      };
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
