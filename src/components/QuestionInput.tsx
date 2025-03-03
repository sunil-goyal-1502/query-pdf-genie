
import React, { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface QuestionInputProps {
  onAskQuestion: (question: string) => Promise<void>;
  isLoading: boolean;
  disabled?: boolean;
}

const QuestionInput: React.FC<QuestionInputProps> = ({
  onAskQuestion,
  isLoading,
  disabled = false,
}) => {
  const [question, setQuestion] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && !isLoading) {
      await onAskQuestion(question.trim());
      setQuestion("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "w-full relative flex items-center gap-2 transition-opacity duration-200",
        disabled ? "opacity-60 pointer-events-none" : "opacity-100"
      )}
    >
      <Input
        type="text"
        placeholder="Ask a question about your documents..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="flex-1 transition-all border-border focus-visible:ring-1 focus-visible:ring-primary/30 pr-10"
        disabled={isLoading || disabled}
      />
      <Button
        type="submit"
        size="icon"
        disabled={!question.trim() || isLoading || disabled}
        className={cn(
          "absolute right-1",
          "transition-all duration-200 ease-out",
          question.trim() ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        <span className="sr-only">Send question</span>
      </Button>
    </form>
  );
};

export default QuestionInput;
