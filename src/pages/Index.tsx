
import React, { useState, useEffect } from "react";
import { PDFServices, PDFDocument, QuestionAnswer } from "@/utils/PDFServices";
import FileUpload from "@/components/FileUpload";
import DocumentList from "@/components/DocumentList";
import QuestionInput from "@/components/QuestionInput";
import AnswerDisplay from "@/components/AnswerDisplay";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { FileText, MessageCircle, X, Key } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

const Index = () => {
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [questionHistory, setQuestionHistory] = useState<QuestionAnswer[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [currentAnswer, setCurrentAnswer] = useState<string>("");
  const [answerSources, setAnswerSources] = useState<QuestionAnswer["sources"]>([]);
  const [isAnswering, setIsAnswering] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "chat">("upload");
  const [apiKey, setApiKey] = useState<string>("");
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState<boolean>(false);
  const { toast } = useToast();

  // Load saved API key on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('openai_api_key', apiKey.trim());
      setApiKeyDialogOpen(false);
      toast({
        title: "API key saved",
        description: "Your OpenAI API key has been saved.",
      });
    } else {
      toast({
        title: "Invalid API key",
        description: "Please enter a valid API key.",
        variant: "destructive",
      });
    }
  };

  const handleFilesAdded = async (files: File[]) => {
    setProcessing(true);
    
    try {
      const newDocuments = files.map(PDFServices.createPDFDocument);
      
      // Add new documents to state immediately to show in UI
      setDocuments((prev) => [...prev, ...newDocuments]);
      
      // Process each document in background
      const processedDocuments = await Promise.all(
        newDocuments.map(async (doc) => {
          const processed = await PDFServices.processPDFDocument(doc);
          console.log("Processed document:", processed.name);
          console.log("First 200 chars of content:", processed.content?.substring(0, 200));
          console.log("Number of pages:", processed.pages?.length);
          return processed;
        })
      );
      
      // Update state with processed documents
      setDocuments((prev) => {
        const existingDocs = prev.filter(
          (doc) => !processedDocuments.some((processed) => processed.id === doc.id)
        );
        return [...existingDocs, ...processedDocuments];
      });
      
      if (processedDocuments.length > 0) {
        toast({
          title: `${processedDocuments.length} document${processedDocuments.length > 1 ? 's' : ''} ready`,
          description: "You can now ask questions about your documents.",
        });
        
        // If this is the first document, automatically switch to chat tab
        if (documents.length === 0 && newDocuments.length > 0) {
          setTimeout(() => setActiveTab("chat"), 500);
        }
      }
    } catch (error) {
      console.error("Error processing documents:", error);
      toast({
        title: "Error processing documents",
        description: "An error occurred while processing your documents.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    if (selectedDocumentId === id) {
      setSelectedDocumentId(null);
    }
  };

  const handleSelectDocument = (id: string) => {
    setSelectedDocumentId((prev) => (prev === id ? null : id));
  };

  const handleAskQuestion = async (question: string) => {
    if (documents.length === 0) {
      toast({
        title: "No documents available",
        description: "Please upload PDF documents before asking questions.",
        variant: "destructive",
      });
      return;
    }

    // Check if API key is set
    if (!localStorage.getItem('openai_api_key')) {
      setApiKeyDialogOpen(true);
      toast({
        title: "API key required",
        description: "Please set your OpenAI API key to ask questions.",
        variant: "destructive",
      });
      return;
    }

    setIsAnswering(true);
    setCurrentQuestion(question);
    setCurrentAnswer("");
    setAnswerSources([]);

    try {
      const result = await PDFServices.askQuestion(question, documents);
      
      // Save to history
      setQuestionHistory((prev) => [...prev, result]);
      
      // Update current answer
      setCurrentAnswer(result.answer);
      setAnswerSources(result.sources);
    } catch (error) {
      console.error("Error answering question:", error);
      toast({
        title: "Error answering question",
        description: "An error occurred while generating an answer.",
        variant: "destructive",
      });
    } finally {
      setIsAnswering(false);
    }
  };

  const clearHistory = () => {
    setQuestionHistory([]);
    setCurrentQuestion("");
    setCurrentAnswer("");
    setAnswerSources([]);
  };

  // Detect if it's a mobile view
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    
    return () => {
      window.removeEventListener("resize", checkIsMobile);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background antialiased">
      {/* Header */}
      <header className="w-full py-6 px-6 md:px-10 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-medium flex items-center gap-2">
            <FileText className="h-6 w-6" />
            <span>PDF Query</span>
          </h1>
          
          <div className="flex items-center gap-2">
            <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Key className="h-4 w-4" />
                  <span className="sr-only md:not-sr-only">API Key</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set OpenAI API Key</DialogTitle>
                  <DialogDescription>
                    Enter your OpenAI API key to enable AI-powered answers.
                    The key will be stored in your browser's localStorage.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    type="password"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Your API key is stored locally and never sent to our servers.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setApiKeyDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveApiKey}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {documents.length > 0 && (
              <>
                {isMobile && (
                  <div className="border rounded-md overflow-hidden">
                    <Button
                      variant={activeTab === "upload" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setActiveTab("upload")}
                      className="rounded-none"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      <span className="sr-only md:not-sr-only">Documents</span>
                    </Button>
                    <Button
                      variant={activeTab === "chat" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setActiveTab("chat")}
                      className="rounded-none"
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      <span className="sr-only md:not-sr-only">Chat</span>
                    </Button>
                  </div>
                )}
                
                {questionHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearHistory}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4 mr-1" />
                    <span className="sr-only md:not-sr-only">Clear History</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row max-w-6xl w-full mx-auto p-6 md:p-10 gap-6 md:gap-10">
        {/* Document Section - Hidden on mobile when chat is active */}
        <div 
          className={cn(
            "flex-1 md:max-w-xs space-y-6 order-1",
            isMobile && activeTab === "chat" ? "hidden" : "block"
          )}
        >
          <div className="space-y-6 animate-fade-in">
            <FileUpload 
              onFilesAdded={handleFilesAdded}
              maxSize={5}
              accept=".pdf"
            />
            
            <DocumentList
              documents={documents}
              onRemoveDocument={handleRemoveDocument}
              onSelectDocument={handleSelectDocument}
              selectedDocumentId={selectedDocumentId}
            />
          </div>
        </div>
        
        {/* Separator for desktop */}
        {!isMobile && documents.length > 0 && (
          <div className="hidden md:block w-px bg-border/70 h-auto order-2" />
        )}
        
        {/* Q&A Section - Hidden on mobile when upload is active */}
        <div 
          className={cn(
            "flex-[2] flex flex-col order-3",
            isMobile && activeTab === "upload" ? "hidden" : "block"
          )}
        >
          <div className="flex-1 min-h-0">
            <div className="space-y-6 h-full flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                {documents.length > 0 ? (
                  <AnswerDisplay
                    question={currentQuestion}
                    answer={currentAnswer}
                    sources={answerSources}
                    isLoading={isAnswering}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-center">
                    <div className="max-w-sm space-y-2 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2" />
                      <h2 className="text-lg font-medium text-foreground">No documents yet</h2>
                      <p className="text-sm">
                        Upload PDF documents first, then ask questions about their content.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="sticky bottom-0 pb-2 pt-4 bg-background">
                <QuestionInput
                  onAskQuestion={handleAskQuestion}
                  isLoading={isAnswering}
                  disabled={documents.length === 0}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
