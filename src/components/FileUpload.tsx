
import React, { useCallback, useState } from "react";
import { Upload, File, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface FileUploadProps {
  onFilesAdded: (files: File[]) => void;
  maxSize?: number; // In MB
  accept?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesAdded,
  maxSize = 10, // Default to 10MB
  accept = ".pdf",
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFiles = useCallback(
    (files: File[]) => {
      const validFiles: File[] = [];
      const maxSizeInBytes = maxSize * 1024 * 1024;
      const fileExtensions = accept.split(",").map((ext) => ext.trim());

      for (const file of files) {
        const fileExt = `.${file.name.split(".").pop()?.toLowerCase()}`;
        
        // Check if the file type is accepted
        if (!fileExtensions.includes(fileExt) && !fileExtensions.includes("*")) {
          toast({
            title: "Invalid file type",
            description: `${file.name} is not a PDF file.`,
            variant: "destructive",
          });
          continue;
        }

        // Check file size
        if (file.size > maxSizeInBytes) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the ${maxSize}MB limit.`,
            variant: "destructive",
          });
          continue;
        }

        validFiles.push(file);
      }

      return validFiles;
    },
    [accept, maxSize, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        const validFiles = validateFiles(files);
        
        if (validFiles.length > 0) {
          onFilesAdded(validFiles);
        }
      }
    },
    [onFilesAdded, validateFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        const files = Array.from(e.target.files);
        const validFiles = validateFiles(files);
        
        if (validFiles.length > 0) {
          onFilesAdded(validFiles);
        }
        
        // Reset the input value to allow uploading the same file again
        e.target.value = "";
      }
    },
    [onFilesAdded, validateFiles]
  );

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div
      className={cn(
        "relative w-full rounded-lg border-2 border-dashed transition-all duration-300 ease-in-out",
        "flex flex-col items-center justify-center text-center p-8",
        isDragging
          ? "border-primary/70 bg-primary/5"
          : "border-border bg-secondary/50 hover:bg-secondary/80"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="animate-fade-in flex flex-col items-center gap-2">
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-300",
            isDragging ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          <Upload
            className={cn(
              "w-6 h-6 transition-transform",
              isDragging ? "scale-110" : "scale-100"
            )}
          />
        </div>
        <h3 className="text-lg font-medium">
          {isDragging ? "Drop PDF files here" : "Upload PDF files"}
        </h3>
        <p className="text-sm text-muted-foreground mb-3 max-w-xs">
          Drag and drop your PDF files here, or click to browse your files.
          Maximum size: {maxSize}MB per file.
        </p>

        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleButtonClick}
          className="relative group overflow-hidden"
        >
          <span className="group-hover:translate-y-[-100%] transition-transform duration-300 flex items-center gap-2">
            <File className="w-4 h-4" />
            Browse Files
          </span>
          <span className="absolute inset-0 flex items-center justify-center translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300">
            <File className="w-4 h-4 mr-2" />
            Select PDFs
          </span>
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
        multiple
      />
    </div>
  );
};

export default FileUpload;
