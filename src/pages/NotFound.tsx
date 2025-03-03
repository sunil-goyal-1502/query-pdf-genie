
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6 animate-scale-in">
        <div className="mx-auto w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        
        <h1 className="text-4xl font-medium">Page Not Found</h1>
        
        <p className="text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <Button asChild className="mt-4">
          <a href="/">Return to Home</a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
