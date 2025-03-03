
import { nanoid } from "nanoid";
import * as pdfjs from "pdfjs-dist";

// Initialize PDF.js worker
// Instead of using CDN, we'll use the worker from the node_modules
const pdfjsWorker = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
);

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker.toString();

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

// Helper to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  else return (bytes / 1048576).toFixed(1) + " MB";
};

// Real PDF text extraction using PDF.js
const extractTextFromPDF = async (file: File): Promise<string[]> => {
  try {
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PDF document
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const pagesContent: string[] = [];
    
    // Extract text from each page
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items.map((item: any) => 
        'str' in item ? item.str : '');
      pagesContent.push(textItems.join(' '));
    }
    
    return pagesContent;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw error;
  }
};

// Basic question answering logic
const generateAnswerFromDocuments = async (
  question: string,
  documents: PDFDocument[]
): Promise<QuestionAnswer> => {
  const sources: QuestionAnswer["sources"] = [];
  const relevantContent: string[] = [];
  
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
          // Find a relevant excerpt around the matched keywords
          let excerpt = "";
          const pageLines = pageContent.split('. ');
          
          for (const line of pageLines) {
            for (const word of questionWords) {
              if (line.toLowerCase().includes(word)) {
                excerpt = line + (line.endsWith('.') ? '' : '.');
                break;
              }
            }
            if (excerpt) break;
          }
          
          if (excerpt) {
            sources.push({
              documentName: doc.name,
              pageNumber: pageIndex + 1,
              excerpt: excerpt.trim(),
            });
            
            relevantContent.push(excerpt);
          }
        }
      });
    }
  });
  
  // Generate a response based on relevant content
  let answer = "";
  
  if (relevantContent.length > 0) {
    answer = `Based on the documents, here's what I found:\n\n${relevantContent.join('\n\n')}`;
  } else {
    answer = "I couldn't find specific information about that in the uploaded documents. Please try rephrasing your question or uploading additional documentation.";
  }
  
  return {
    question,
    answer,
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
    documents: PDFDocument[]
  ): Promise<QuestionAnswer> => {
    return generateAnswerFromDocuments(question, documents);
  },
};
