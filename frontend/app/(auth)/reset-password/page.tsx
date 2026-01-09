import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { Loader2 } from "lucide-react";

/**
 * Loading spinner component for Suspense fallback
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-8 w-8 animate-spin text-[#99B8F8]" />
    </div>
  );
}

/**
 * Reset Password Page
 *
 * Allows users to set a new password using a reset token from email.
 * Wrapped in Suspense because it uses useSearchParams.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
