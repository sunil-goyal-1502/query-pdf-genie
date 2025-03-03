
import React from "react";
import { File, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DocumentListProps {
  documents: {
    id: string;
    name: string;
    size: string;
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
                <File className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium truncate max-w-[200px]">{doc.name}</span>
                <span className="text-xs text-muted-foreground">{doc.size}</span>
              </div>
            </div>
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
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DocumentList;
