"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Props for RegistrationSuccessAlert component
 */
interface RegistrationSuccessAlertProps {
  /** Whether the alert should be visible */
  isVisible: boolean;
  /** Callback function to close the alert */
  onClose: () => void;
  /** Optional user email to display in success message */
  userEmail?: string;
}

/**
 * Registration success alert component
 *
 * Displays a success message after user registration with a link to the login page.
 * Uses the #99B8F8 color scheme and is closeable.
 *
 * @param props - Component props
 * @returns Success alert or null if not visible
 *
 * @example
 * ```typescript
 * const [showSuccess, setShowSuccess] = useState(false);
 *
 * <RegistrationSuccessAlert
 *   isVisible={showSuccess}
 *   onClose={() => setShowSuccess(false)}
 *   userEmail="user@example.com"
 * />
 * ```
 */
export function RegistrationSuccessAlert({
  isVisible,
  onClose,
  userEmail,
}: RegistrationSuccessAlertProps) {
  // Don't render if not visible
  if (!isVisible) return null;

  return (
    <Alert className="border-[#99B8F8] bg-[#E8F0FF] text-[#2D3748]">
      <CheckCircle className="h-4 w-4 text-[#6B8DD6]" />
      <div className="flex justify-between items-start w-full">
        <AlertDescription className="flex-1">
          <div className="space-y-2">
            <p className="font-medium text-[#2D3748]">
              Registration successful!
            </p>
            <p className="text-sm text-[#4A5568]">
              Your account has been created successfully
              {userEmail && ` for ${userEmail}`}. You can now log in to access
              your account.
            </p>
            <div className="flex items-center space-x-2 mt-3">
              <Link href="/login">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] hover:from-[#89A8E8] hover:to-[#5B7DC6] text-white shadow-md"
                >
                  Go to Login
                </Button>
              </Link>
            </div>
          </div>
        </AlertDescription>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 text-[#6B8DD6] hover:text-[#5B7DC6] hover:bg-[#D0E0FF]"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
