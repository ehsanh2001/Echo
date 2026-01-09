"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
  checkPasswordStrength,
} from "@/lib/validations";
import { validateResetToken, resetPassword } from "@/lib/api/auth";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Custom Components
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";

// Icons
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  Clock,
} from "lucide-react";

type FormState = "validating" | "valid" | "invalid" | "expired" | "success";

/**
 * Reset Password Form Component
 *
 * A form for setting a new password using a reset token with:
 * - Token validation on mount
 * - New password and confirm password fields
 * - Password strength indicator
 * - Password visibility toggles
 * - Success/error states with appropriate messaging
 *
 * Uses the #99B8F8 color scheme for branding consistency.
 */
export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [formState, setFormState] = useState<FormState>("validating");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // React Hook Form setup with Zod validation
  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Watch password for strength indicator
  const watchPassword = form.watch("password");
  const passwordStrength = checkPasswordStrength(watchPassword);

  /**
   * Validate token on mount
   */
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setFormState("invalid");
        return;
      }

      try {
        const result = await validateResetToken(token);

        if (result.success && result.data?.valid) {
          setFormState("valid");
          if (result.data.email) {
            setUserEmail(result.data.email);
          }
        } else {
          // Check if it's an expired token vs invalid token
          const message = result.message?.toLowerCase() || "";
          if (message.includes("expired")) {
            setFormState("expired");
          } else {
            setFormState("invalid");
          }
        }
      } catch (err: any) {
        const message = err?.message?.toLowerCase() || "";
        if (message.includes("expired")) {
          setFormState("expired");
        } else {
          setFormState("invalid");
        }
      }
    }

    validateToken();
  }, [token]);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await resetPassword({
        token,
        newPassword: data.password,
      });

      if (result.success) {
        setFormState("success");
      } else {
        setError(
          result.message || "Failed to reset password. Please try again."
        );
      }
    } catch (err: any) {
      const message = err?.message?.toLowerCase() || "";
      if (message.includes("expired")) {
        setFormState("expired");
      } else if (message.includes("invalid")) {
        setFormState("invalid");
      } else {
        setError(err?.message || "An error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validating state - show loading
  if (formState === "validating") {
    return (
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="space-y-4 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#99B8F8] mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">
            Verifying your link...
          </h1>
          <p className="text-muted-foreground">
            Please wait while we verify your password reset link.
          </p>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (formState === "invalid") {
    return (
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="space-y-4">
          <div className="space-y-2 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Invalid reset link
            </h1>
            <p className="text-muted-foreground">
              This password reset link is invalid. It may have already been used
              or the link was copied incorrectly.
            </p>
          </div>

          <div className="space-y-3">
            <Link href="/forgot-password" className="block">
              <Button className="w-full bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] hover:from-[#89A8E8] hover:to-[#5B7DC6] text-white font-semibold">
                Request a new link
              </Button>
            </Link>

            <Link href="/login" className="block">
              <Button
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Expired token state
  if (formState === "expired") {
    return (
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="space-y-4">
          <div className="space-y-2 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Link expired</h1>
            <p className="text-muted-foreground">
              This password reset link has expired. For security reasons, reset
              links are only valid for 15 minutes.
            </p>
          </div>

          <div className="space-y-3">
            <Link href="/forgot-password" className="block">
              <Button className="w-full bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] hover:from-[#89A8E8] hover:to-[#5B7DC6] text-white font-semibold">
                Request a new link
              </Button>
            </Link>

            <Link href="/login" className="block">
              <Button
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (formState === "success") {
    return (
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="space-y-4">
          <div className="space-y-2 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Password reset successful
            </h1>
            <p className="text-muted-foreground">
              Your password has been reset successfully. You can now log in with
              your new password.
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              For your security, you've been logged out of all devices. Please
              log in again with your new password.
            </AlertDescription>
          </Alert>

          <Link href="/login" className="block">
            <Button className="w-full bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] hover:from-[#89A8E8] hover:to-[#5B7DC6] text-white font-semibold">
              Go to login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Valid token - show password form
  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="space-y-4">
        {/* Form Header */}
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] bg-clip-text text-transparent">
            Reset your password
          </h1>
          <p className="text-muted-foreground">
            {userEmail ? (
              <>
                Enter a new password for{" "}
                <span className="font-medium text-foreground">{userEmail}</span>
              </>
            ) : (
              "Enter a new password for your account"
            )}
          </p>
        </div>

        {/* Reset Password Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* New Password Field */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        {...field}
                        disabled={isSubmitting}
                        className="pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password Strength Indicator */}
            {watchPassword && (
              <PasswordStrengthIndicator password={watchPassword} />
            )}

            {/* Confirm Password Field */}
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        {...field}
                        disabled={isSubmitting}
                        className="pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] hover:from-[#89A8E8] hover:to-[#5B7DC6] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={isSubmitting || !passwordStrength.isValid}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting password...
                </>
              ) : (
                "Reset password"
              )}
            </Button>
          </form>
        </Form>

        {/* Back to Login Link */}
        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
