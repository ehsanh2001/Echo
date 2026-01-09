"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from "@/lib/validations";
import { forgotPassword } from "@/lib/api/auth";
import { useState } from "react";
import Link from "next/link";

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

// Icons
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Mail,
} from "lucide-react";

type FormState = "input" | "submitted";

/**
 * Forgot Password Form Component
 *
 * A form for requesting password reset emails with:
 * - Email input with validation
 * - Generic success message (doesn't reveal if email exists)
 * - Link back to login
 * - React Hook Form + Zod validation
 *
 * Uses the #99B8F8 color scheme for branding consistency.
 */
export function ForgotPasswordForm() {
  const [formState, setFormState] = useState<FormState>("input");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // React Hook Form setup with Zod validation
  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  /**
   * Handle form submission
   *
   * Sends password reset request and shows generic success message.
   * Always shows success to prevent email enumeration attacks.
   */
  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await forgotPassword({ email: data.email });
      // Always show success to prevent email enumeration
      setFormState("submitted");
    } catch (err: any) {
      // Only show error for rate limiting or server errors
      // Don't reveal if email exists or not
      if (err?.status === 429) {
        setError("Too many requests. Please try again later.");
      } else {
        // For all other errors, still show success message
        // to prevent email enumeration
        setFormState("submitted");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state - email has been "sent"
  if (formState === "submitted") {
    return (
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="space-y-4">
          {/* Success Header */}
          <div className="space-y-2 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Check your email
            </h1>
            <p className="text-muted-foreground">
              If an account exists with the email you entered, we've sent a
              password reset link. Please check your inbox and spam folder.
            </p>
          </div>

          {/* Additional Info */}
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              The link will expire in 15 minutes. If you don't receive an email,
              make sure you entered the correct address.
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setFormState("input");
                form.reset();
              }}
            >
              Try a different email
            </Button>

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

  // Input state - show email form
  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="space-y-4">
        {/* Form Header */}
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] bg-clip-text text-transparent">
            Forgot password?
          </h1>
          <p className="text-muted-foreground">
            Enter your email address and we'll send you a link to reset your
            password.
          </p>
        </div>

        {/* Forgot Password Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Email Field */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      autoComplete="email"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] hover:from-[#89A8E8] hover:to-[#5B7DC6] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send reset link"
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
