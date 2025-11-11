"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuccessAlertProps {
  message: string;
  title?: string;
  onClose: () => void;
}

export function SuccessAlert({
  message,
  title = "Success!",
  onClose,
}: SuccessAlertProps) {
  return (
    <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
      <AlertTitle className="text-green-800 dark:text-green-300">
        {title}
      </AlertTitle>
      <AlertDescription className="text-green-700 dark:text-green-400">
        {message}
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
}
