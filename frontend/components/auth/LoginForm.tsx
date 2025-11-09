"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormData } from "@/lib/validations";
import { useLogin } from "@/lib/hooks/useAuth";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";

/**
 * Inner login form component that uses search params
 *
 * Separated to allow Suspense boundary wrapping.
 */
function LoginFormContent() {
  // State for password visibility toggle
  const [showPassword, setShowPassword] = useState(false);

  // Router and search params for redirects
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  // React Query mutation for login
  const loginMutation = useLogin();

  // React Hook Form setup with Zod validation
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  /**
   * Handle form submission
   *
   * Sends login credentials to the API and redirects on success.
   * If user was redirected to login, returns them to the intended page.
   * Otherwise, redirects to /app/workspaces.
   */
  const onSubmit = async (data: LoginFormData) => {
    try {
      const result = await loginMutation.mutateAsync({
        identifier: data.identifier,
        password: data.password,
      });

      if (result.success) {
        // Redirect to intended page or default to workspaces
        const destination = redirectTo || "/app/workspaces";
        router.push(destination);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      // Error handling is managed by the mutation
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Login Form */}
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] bg-clip-text text-transparent">
            Welcome back
          </h1>
          <p className="text-muted-foreground">Sign in to your Echo account</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Error Alert */}
            {loginMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Invalid email/username or password. Please try again.
                </AlertDescription>
              </Alert>
            )}

            {/* Email/Username Field */}
            <FormField
              control={form.control}
              name="identifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email or Username</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Enter your email or username"
                      autoComplete="username"
                      {...field}
                      disabled={loginMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password Field */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        {...field}
                        disabled={loginMutation.isPending}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
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

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] hover:from-[#89A8E8] hover:to-[#5B7DC6] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </Form>

        {/* Link to Registration */}
        <div className="text-center text-sm">
          <span className="text-muted-foreground">Don't have an account? </span>
          <Link
            href="/register"
            className="text-[#6B8DD6] hover:text-[#5B7DC6] hover:underline font-medium transition-colors"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * User login form component
 *
 * A comprehensive login form with:
 * - Email/username and password fields
 * - Password visibility toggle
 * - Form validation using Zod
 * - Redirect to intended page or /app/workspaces after successful login
 * - Error handling with alerts
 * - Link to registration page
 *
 * Uses the #99B8F8 color scheme for branding consistency.
 * Wrapped in Suspense boundary for Next.js 13+ compatibility.
 *
 * @returns Complete login form with validation and error handling
 *
 * @example
 * ```typescript
 * export default function LoginPage() {
 *   return <LoginForm />;
 * }
 * ```
 */
export function LoginForm() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
