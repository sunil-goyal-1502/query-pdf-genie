
import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SourceReference {
  documentName: string;
  pageNumber: number;
  excerpt: string;
}

interface AnswerDisplayProps {
  question: string;
  answer: string;
  sources?: SourceReference[];
  isLoading: boolean;
}

const AnswerDisplay: React.FC<AnswerDisplayProps> = ({
  question,
  answer,
  sources = [],
  isLoading,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && !isLoading && answer) {
      containerRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [answer, isLoading]);

  if (!question && !answer && !isLoading) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "w-full mt-6 space-y-4 animate-slide-up",
        isLoading ? "opacity-70" : "opacity-100"
      )}
    >
      {question && (
        <div className="flex flex-col space-y-2">
          <div className="self-end max-w-[80%] bg-primary text-primary-foreground px-4 py-3 rounded-lg rounded-tr-none">
            <p className="text-sm">{question}</p>
          </div>
        </div>
      )}

      {(answer || isLoading) && (
        <div className="flex flex-col space-y-2">
          <div className="self-start max-w-[80%] bg-secondary border border-border px-4 py-3 rounded-lg rounded-tl-none">
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded-full w-[80%] animate-pulse"></div>
                <div className="h-4 bg-muted rounded-full w-[90%] animate-pulse"></div>
                <div className="h-4 bg-muted rounded-full w-[60%] animate-pulse"></div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-line">{answer}</p>
            )}
          </div>
        </div>
      )}

      {sources.length > 0 && !isLoading && (
        <div className="mt-4 pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Sources</h3>
          <div className="space-y-2">
            {sources.map((source, index) => (
              <div 
                key={index}
                className="p-3 bg-secondary/50 border border-border rounded-md text-sm"
              >
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{source.documentName}</span>
                  <span className="text-xs text-muted-foreground">Page {source.pageNumber}</span>
                </div>
                <p className="text-xs text-muted-foreground italic">{source.excerpt}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnswerDisplay;
