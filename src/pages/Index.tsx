
import React, { useState, useEffect } from "react";
import { PDFServices, PDFDocument, QuestionAnswer, AIConfig } from "@/utils/PDFServices";
import FileUpload from "@/components/FileUpload";
import DocumentList from "@/components/DocumentList";
import QuestionInput from "@/components/QuestionInput";
import AnswerDisplay from "@/components/AnswerDisplay";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { FileText, MessageCircle, X, Key, Settings, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState<boolean>(false);
  
  const [aiProvider, setAiProvider] = useState<"openai" | "claude" | "transformers">("transformers");
  const [openaiApiKey, setOpenaiApiKey] = useState<string>("");
  const [claudeApiKey, setClaudeApiKey] = useState<string>("");
  const [openaiModel, setOpenaiModel] = useState<string>("gpt-4o-mini");
  const [claudeModel, setClaudeModel] = useState<string>("claude-3-haiku-20240307");
  const [useLocalModel, setUseLocalModel] = useState<boolean>(true);
  
  const { toast } = useToast();

  useEffect(() => {
    const savedOpenaiApiKey = localStorage.getItem('openai_api_key');
    const savedClaudeApiKey = localStorage.getItem('claude_api_key');
    const savedAiProvider = localStorage.getItem('ai_provider') as "openai" | "claude" | "transformers" | null;
    const savedOpenaiModel = localStorage.getItem('openai_model');
    const savedClaudeModel = localStorage.getItem('claude_model');
    const savedUseLocalModel = localStorage.getItem('use_local_model');
    
    if (savedOpenaiApiKey) {
      setOpenaiApiKey(savedOpenaiApiKey);
    }
    if (savedClaudeApiKey) {
      setClaudeApiKey(savedClaudeApiKey);
    }
    if (savedAiProvider) {
      setAiProvider(savedAiProvider);
    }
    if (savedOpenaiModel) {
      setOpenaiModel(savedOpenaiModel);
    }
    if (savedClaudeModel) {
      setClaudeModel(savedClaudeModel);
    }
    if (savedUseLocalModel !== null) {
      setUseLocalModel(savedUseLocalModel === 'true');
    }
  }, []);

  const handleSaveApiSettings = () => {
    // Check if user wants to use local model
    if (useLocalModel) {
      setAiProvider("transformers");
      localStorage.setItem('ai_provider', "transformers");
      localStorage.setItem('use_local_model', 'true');
      
      setApiKeyDialogOpen(false);
      toast({
        title: "Settings saved",
        description: "Using local processing without API keys.",
      });
      return;
    }
    
    const currentApiKey = aiProvider === "openai" ? openaiApiKey : claudeApiKey;
    
    if (currentApiKey.trim()) {
      localStorage.setItem('ai_provider', aiProvider);
      localStorage.setItem('openai_api_key', openaiApiKey.trim());
      localStorage.setItem('claude_api_key', claudeApiKey.trim());
      localStorage.setItem('openai_model', openaiModel);
      localStorage.setItem('claude_model', claudeModel);
      localStorage.setItem('use_local_model', 'false');
      
      setApiKeyDialogOpen(false);
      toast({
        title: "API settings saved",
        description: `Your ${aiProvider === "openai" ? "OpenAI" : "Claude"} API settings have been saved.`,
      });
    } else {
      toast({
        title: "Invalid API key",
        description: `Please enter a valid ${aiProvider === "openai" ? "OpenAI" : "Claude"} API key or use local processing.`,
        variant: "destructive",
      });
    }
  };

  const handleFilesAdded = async (files: File[]) => {
    setProcessing(true);
    
    try {
      const newDocuments = files.map(PDFServices.createPDFDocument);
      
      setDocuments((prev) => [...prev, ...newDocuments]);
      
      const processedDocuments = await Promise.all(
        newDocuments.map(async (doc) => {
          try {
            const processed = await PDFServices.processPDFDocument(doc);
            console.log("Processed document:", processed.name);
            console.log("Processing state:", processed.isProcessing ? "Processing" : (processed.isProcessed ? "Processed" : "Error"));
            console.log("Number of pages:", processed.pages?.length);
            
            // Update document in state
            setDocuments((prev) => 
              prev.map((d) => d.id === doc.id ? processed : d)
            );
            
            return processed;
          } catch (error) {
            console.error(`Error processing document ${doc.name}:`, error);
            const errorDoc = {
              ...doc,
              isProcessing: false,
              isProcessed: false,
              error: `Failed to process: ${error}`
            };
            
            // Update document in state with error
            setDocuments((prev) => 
              prev.map((d) => d.id === doc.id ? errorDoc : d)
            );
            
            return errorDoc;
          }
        })
      );
      
      const successfulDocs = processedDocuments.filter(doc => doc.isProcessed);
      const failedDocs = processedDocuments.filter(doc => !doc.isProcessed && !doc.isProcessing);
      
      if (successfulDocs.length > 0) {
        toast({
          title: `${successfulDocs.length} document${successfulDocs.length > 1 ? 's' : ''} ready`,
          description: "You can now ask questions about your documents.",
        });
        
        if (documents.length === 0 && successfulDocs.length > 0) {
          setTimeout(() => setActiveTab("chat"), 500);
        }
      }
      
      if (failedDocs.length > 0) {
        toast({
          title: `${failedDocs.length} document${failedDocs.length > 1 ? 's' : ''} failed`,
          description: "There was an error processing some documents.",
          variant: "destructive",
        });
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

    const processingDocs = documents.filter(doc => doc.isProcessing);
    if (processingDocs.length > 0) {
      toast({
        title: "Documents still processing",
        description: "Please wait for all documents to finish processing before asking questions.",
        variant: "destructive",
      });
      return;
    }
    
    // Check for API keys only if not using local model
    if (!useLocalModel && aiProvider !== "transformers") {
      const currentApiKey = aiProvider === "openai" ? openaiApiKey : claudeApiKey;
      if (!currentApiKey) {
        setApiKeyDialogOpen(true);
        toast({
          title: "API key required",
          description: `Please set your ${aiProvider === "openai" ? "OpenAI" : "Claude"} API key to ask questions or use local processing.`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsAnswering(true);
    setCurrentQuestion(question);
    setCurrentAnswer("");
    setAnswerSources([]);

    try {
      // Prepare AI config
      const aiConfig: AIConfig = useLocalModel || aiProvider === "transformers" 
        ? { provider: "transformers" }
        : {
            provider: aiProvider,
            apiKey: aiProvider === "openai" ? openaiApiKey : claudeApiKey,
            model: aiProvider === "openai" ? openaiModel : claudeModel
          };
      
      console.log("Using AI config:", { 
        provider: aiConfig.provider, 
        model: aiConfig.model || "local" 
      });
      
      const result = await PDFServices.askQuestion(question, documents, aiConfig);
      
      setQuestionHistory((prev) => [...prev, result]);
      setCurrentAnswer(result.answer);
      setAnswerSources(result.sources);
    } catch (error) {
      console.error("Error answering question:", error);
      toast({
        title: "Error answering question",
        description: "An error occurred while generating an answer.",
        variant: "destructive",
      });
      setCurrentAnswer("Sorry, there was an error generating an answer. Please try again.");
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

  const isAnyDocumentProcessing = documents.some(doc => doc.isProcessing);
  const failedDocuments = documents.filter(doc => !doc.isProcessed && !doc.isProcessing);

  return (
    <div className="min-h-screen flex flex-col bg-background antialiased">
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
                  <Settings className="h-4 w-4" />
                  <span className="sr-only md:not-sr-only">AI Settings</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>AI Settings</DialogTitle>
                  <DialogDescription>
                    Choose between local processing (no API key needed) or configure an AI provider.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="py-4 space-y-4">
                  <div className="flex items-center justify-between space-x-2">
                    <div>
                      <Label htmlFor="use-local" className="font-medium">Use Local Processing</Label>
                      <p className="text-sm text-muted-foreground">
                        Process documents directly in your browser without API keys
                      </p>
                    </div>
                    <Switch
                      id="use-local"
                      checked={useLocalModel}
                      onCheckedChange={setUseLocalModel}
                    />
                  </div>
                </div>
                
                {!useLocalModel && (
                  <Tabs defaultValue={aiProvider} onValueChange={(value) => setAiProvider(value as "openai" | "claude")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="openai">OpenAI</TabsTrigger>
                      <TabsTrigger value="claude">Claude</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="openai" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="openai-api-key">OpenAI API Key</Label>
                        <Input
                          id="openai-api-key"
                          value={openaiApiKey}
                          onChange={(e) => setOpenaiApiKey(e.target.value)}
                          placeholder="sk-..."
                          type="password"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="openai-model">Model</Label>
                        <Select value={openaiModel} onValueChange={setOpenaiModel}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="claude" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="claude-api-key">Claude API Key</Label>
                        <Input
                          id="claude-api-key"
                          value={claudeApiKey}
                          onChange={(e) => setClaudeApiKey(e.target.value)}
                          placeholder="sk-ant-..."
                          type="password"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="claude-model">Model</Label>
                        <Select value={claudeModel} onValueChange={setClaudeModel}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                            <SelectItem value="claude-3-sonnet-20240229">Claude 3 Sonnet</SelectItem>
                            <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
                
                <div className="py-2">
                  {useLocalModel ? (
                    <div className="flex items-center gap-2 text-sm p-2 bg-blue-50 text-blue-800 rounded-md">
                      <Cpu className="h-4 w-4" />
                      <p>Using browser-based processing with no API keys required. Queries may be less accurate.</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Your API keys are stored locally and never sent to our servers.
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setApiKeyDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveApiSettings}>Save Settings</Button>
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

      <main className="flex-1 flex flex-col md:flex-row max-w-6xl w-full mx-auto p-6 md:p-10 gap-6 md:gap-10">
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
        
        {!isMobile && documents.length > 0 && (
          <div className="hidden md:block w-px bg-border/70 h-auto order-2" />
        )}
        
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
                    documentsProcessing={isAnyDocumentProcessing}
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
                  disabled={documents.length === 0 || isAnyDocumentProcessing}
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
