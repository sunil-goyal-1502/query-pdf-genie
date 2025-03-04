
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

// Improved passage finding with better tokenization and relevance scoring
const findRelevantPassages = (
  question: string, 
  documents: PDFDocument[]
): { documentName: string; pageNumber: number; content: string; score: number }[] => {
  const passages: { documentName: string; pageNumber: number; content: string; score: number }[] = [];
  
  console.log("Finding relevant passages for question:", question);
  console.log("Number of documents to search:", documents.length);
  
  // Clean and tokenize the question
  const questionLower = question.toLowerCase();
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 
    'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'like', 
    'through', 'over', 'before', 'between', 'after', 'since', 'without',
    'under', 'within', 'along', 'following', 'across', 'behind', 'beyond',
    'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
    'does', 'did', 'doing', 'done', 'has', 'have', 'having', 'had', 'can',
    'could', 'should', 'would', 'may', 'might', 'must', 'will', 'shall'
  ]);
  
  // Extract meaningful keywords
  const questionWords = questionLower
    .replace(/[.,?!;:()[\]{}""''""]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  console.log("Extracted keywords from question:", questionWords);
  
  if (questionWords.length === 0) {
    console.log("No meaningful keywords found in the question");
    return [];
  }
  
  // Search for relevant content in documents
  documents.forEach((doc) => {
    if (!doc.pages || doc.pages.length === 0) {
      console.log(`Document ${doc.name} has no extracted pages`);
      return;
    }
    
    console.log(`Searching document: ${doc.name} with ${doc.pages.length} pages`);
    
    doc.pages.forEach((pageContent, pageIndex) => {
      if (!pageContent || pageContent.trim() === '') {
        console.log(`Page ${pageIndex + 1} of ${doc.name} is empty`);
        return;
      }
      
      const pageLower = pageContent.toLowerCase();
      
      // Calculate relevance score
      let score = 0;
      const matchedKeywords = new Set<string>();
      
      for (const word of questionWords) {
        // Count occurrences of each keyword
        const regex = new RegExp('\\b' + word + '\\b', 'gi');
        const matches = pageLower.match(regex);
        
        if (matches && matches.length > 0) {
          matchedKeywords.add(word);
          score += matches.length;
        }
      }
      
      // Page is relevant if it contains at least one keyword
      if (matchedKeywords.size > 0) {
        // Normalize score by page length and matched keywords
        const normalizedScore = (score * matchedKeywords.size) / Math.sqrt(pageContent.length);
        
        passages.push({
          documentName: doc.name,
          pageNumber: pageIndex + 1,
          content: pageContent,
          score: normalizedScore
        });
        
        console.log(`Page ${pageIndex + 1} of ${doc.name} matched ${matchedKeywords.size} keywords. Score: ${normalizedScore.toFixed(4)}`);
      }
    });
  });
  
  // Sort passages by relevance score (highest first)
  const sortedPassages = passages.sort((a, b) => b.score - a.score);
  console.log(`Found ${sortedPassages.length} relevant passages`);
  
  return sortedPassages;
};

// Enhanced OpenAI answer generation with better prompt
const getOpenAIAnswer = async (
  question: string,
  relevantPassages: { documentName: string; pageNumber: number; content: string; score?: number }[],
  apiKey: string,
  model: string = "gpt-4o-mini"
): Promise<string> => {
  try {
    // Take top passages but limit to avoid token limits
    const topPassages = relevantPassages.slice(0, 5);
    console.log(`Using top ${topPassages.length} passages for OpenAI query`);
    
    // Prepare context from relevant passages with document references
    const context = topPassages.map((passage, index) => 
      `[Document ${index + 1}: "${passage.documentName}", Page ${passage.pageNumber}]\n${passage.content.substring(0, 1500)}`
    ).join('\n\n');
    
    console.log("Connecting to OpenAI...");
    console.log(`Using model: ${model}`);
    
    // Improved prompt with clearer instructions
    const systemPrompt = `You are a helpful assistant that provides accurate information based on PDF documents. 
Answer questions based ONLY on the information in the provided document excerpts.
If the answer cannot be found in the provided excerpts, clearly state: "The answer is not found in the provided documents."
Do not speculate or provide information not contained in the documents.
When appropriate, cite which document and page contains the information in your answer.`;

    const userPrompt = `My question is: ${question}

Here are the relevant excerpts from the documents:

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

// Get answer from Claude
const getClaudeAnswer = async (
  question: string,
  relevantPassages: { documentName: string; pageNumber: number; content: string; score?: number }[],
  apiKey: string,
  model: string = "claude-3-haiku-20240307"
): Promise<string> => {
  try {
    // Take top passages but limit to avoid token limits
    const topPassages = relevantPassages.slice(0, 5);
    console.log(`Using top ${topPassages.length} passages for Claude query`);
    
    // Prepare context from relevant passages with document references
    const context = topPassages.map((passage, index) => 
      `[Document ${index + 1}: "${passage.documentName}", Page ${passage.pageNumber}]\n${passage.content.substring(0, 1500)}`
    ).join('\n\n');
    
    console.log("Connecting to Claude...");
    console.log(`Using model: ${model}`);
    
    // Improved prompt with clearer instructions
    const systemPrompt = `You are a helpful assistant that provides accurate information based on PDF documents. 
Answer questions based ONLY on the information in the provided document excerpts.
If the answer cannot be found in the provided excerpts, clearly state: "The answer is not found in the provided documents."
Do not speculate or provide information not contained in the documents.
When appropriate, cite which document and page contains the information in your answer.`;

    const userPrompt = `My question is: ${question}

Here are the relevant excerpts from the documents:

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

// Enhanced question answering with AI and detailed logging
const generateAnswerFromDocuments = async (
  question: string,
  documents: PDFDocument[],
  aiConfig: AIConfig
): Promise<QuestionAnswer> => {
  console.log("Generating answer for question:", question);
  console.log("AI Provider:", aiConfig.provider);
  console.log("AI Model:", aiConfig.model);
  
  // Validate documents
  if (!documents || documents.length === 0) {
    console.log("No documents available");
    return {
      question,
      answer: "Please upload PDF documents before asking questions.",
      sources: [],
    };
  }
  
  // Find relevant passages from the documents with improved algorithm
  const relevantPassages = findRelevantPassages(question, documents);
  
  // No relevant content found
  if (relevantPassages.length === 0) {
    console.log("No relevant passages found");
    return {
      question,
      answer: "I couldn't find specific information about that in the uploaded documents. Please try rephrasing your question or uploading additional documentation.",
      sources: [],
    };
  }
  
  // Get AI-generated answer based on the selected provider
  console.log(`Requesting answer from ${aiConfig.provider} using model ${aiConfig.model}`);
  let aiAnswer = "";
  if (aiConfig.provider === "openai") {
    aiAnswer = await getOpenAIAnswer(question, relevantPassages, aiConfig.apiKey, aiConfig.model);
  } else if (aiConfig.provider === "claude") {
    aiAnswer = await getClaudeAnswer(question, relevantPassages, aiConfig.apiKey, aiConfig.model);
  }
  
  console.log("AI answer generated");
  
  // Create source references from top passages
  const sources = relevantPassages.slice(0, 3).map(passage => {
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
