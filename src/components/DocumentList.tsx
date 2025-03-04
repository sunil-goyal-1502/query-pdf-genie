
import React from "react";
import { File, X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DocumentListProps {
  documents: {
    id: string;
    name: string;
    size: string;
    isProcessing?: boolean;
    isProcessed?: boolean;
    error?: string;
  }[];
  onRemoveDocument: (id: string) => void;
  onSelectDocument: (id: string) => void;
  selectedDocumentId: string | null;
}

const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onRemoveDocument,
  onSelectDocument,
  selectedDocumentId,
}) => {
  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="w-full animate-fade-in">
      <h2 className="text-sm font-medium text-muted-foreground mb-2">Your Documents</h2>
      <ul className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
        {documents.map((doc) => (
          <li 
            key={doc.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg transition-all duration-200",
              "border border-border hover:border-primary/30 cursor-pointer",
              "hover:shadow-sm group",
              selectedDocumentId === doc.id ? "bg-primary/5 border-primary/30" : "bg-card"
            )}
            onClick={() => onSelectDocument(doc.id)}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 flex items-center justify-center rounded-md transition-colors",
                selectedDocumentId === doc.id ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
              )}>
                {doc.isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : doc.error ? (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                ) : (
                  <File className="w-4 h-4" />
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate max-w-[160px]">{doc.name}</span>
                  {doc.isProcessing && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Processing</span>
                  )}
                  {doc.isProcessed && (
                    <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">Ready</span>
                  )}
                  {doc.error && (
                    <span className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded">Error</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{doc.size}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {doc.error && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-destructive">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">{doc.error}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveDocument(doc.id);
                }}
              >
                <X className="w-4 h-4" />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DocumentList;
