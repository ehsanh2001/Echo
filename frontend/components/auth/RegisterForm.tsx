"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterFormData } from "@/lib/validations";
import { useRegister } from "@/lib/hooks/useAuth";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { RegistrationSuccessAlert } from "./RegistrationSuccessAlert";

// Icons
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";

/**
 * User registration form component
 *
 * A comprehensive registration form with:
 * - Email, username, password, confirm password, and optional display name fields
 * - Real-time password strength validation
 * - Password visibility toggles
 * - Form validation using Zod
 * - Success message with login link
 * - Error handling with closeable alerts
 *
 * Uses the #99B8F8 color scheme for branding consistency.
 *
 * @returns Complete registration form with validation and error handling
 *
 * @example
 * ```typescript
 * export default function RegisterPage() {
 *   return <RegisterForm />;
 * }
 * ```
 */
export function RegisterForm() {
  // State for password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // State for success message
  const [showSuccess, setShowSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  // Router for navigation
  const router = useRouter();

  // React Query mutation for registration
  const registerMutation = useRegister();

  // React Hook Form setup with Zod validation
  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      displayName: "",
    },
  });

  // Watch password and username for strength validation
  const watchPassword = form.watch("password");
  const watchUsername = form.watch("username");

  /**
   * Handle form submission
   *
   * Sends registration data to the API and shows success message on completion.
   * Note: Registration does not automatically log in the user.
   */
  const onSubmit = async (data: RegisterFormData) => {
    try {
      const result = await registerMutation.mutateAsync({
        email: data.email,
        username: data.username,
        password: data.password,
        displayName: data.displayName || undefined,
      });

      if (result.success) {
        // Check if there's a pending invite token
        const pendingToken = localStorage.getItem("pending_invite_token");

        if (pendingToken) {
          // Auto-login and redirect to invite page
          // Since registration returns tokens, we can store them and redirect
          setRegisteredEmail(data.email);
          setShowSuccess(true);
          form.reset();

          // Redirect to invite page after a short delay
          setTimeout(() => {
            router.push(`/invite/${pendingToken}`);
          }, 1500);
        } else {
          setRegisteredEmail(data.email);
          setShowSuccess(true);
          form.reset();
        }
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      // Error handling is managed by the mutation
    }
  };

  /**
   * Handle closing the success alert
   *
   * Resets the success state and clears the registered email.
   */
  const handleCloseSuccess = () => {
    setShowSuccess(false);
    setRegisteredEmail("");
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Success Alert - Shown after successful registration */}
      <RegistrationSuccessAlert
        isVisible={showSuccess}
        onClose={handleCloseSuccess}
        userEmail={registeredEmail}
      />

      {/* Registration Form Container */}
      <div className="space-y-4">
        {/* Form Header */}
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] bg-clip-text text-transparent">
            Create your account
          </h1>
          <p className="text-muted-foreground">
            Join Echo and start collaborating with your team
          </p>
        </div>

        {/* Registration Form with Validation */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field - Required */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      {...field}
                      disabled={registerMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Username Field - Required */}
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username *</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Choose a username"
                      {...field}
                      disabled={registerMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password Field - Required with Strength Indicator */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        {...field}
                        disabled={registerMutation.isPending}
                        className="pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-credentials-auto-fill-button]:hidden [&::-webkit-contacts-auto-fill-button]:hidden"
                      />
                      {/* Toggle Password Visibility Button */}
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

                  {/* Password Strength Indicator */}
                  <PasswordStrengthIndicator
                    password={watchPassword}
                    username={watchUsername}
                  />
                </FormItem>
              )}
            />

            {/* Confirm Password Field - Required */}
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-type your password"
                        {...field}
                        disabled={registerMutation.isPending}
                        className="pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-credentials-auto-fill-button]:hidden [&::-webkit-contacts-auto-fill-button]:hidden"
                      />
                      {/* Toggle Confirm Password Visibility Button */}
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
                            ? "Hide confirm password"
                            : "Show confirm password"
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

            {/* Display Name Field - Optional */}
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="How others will see you"
                      {...field}
                      disabled={registerMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error Alert - Shows when registration fails */}
            {registerMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {registerMutation.error?.message ||
                    "Registration failed. Please try again."}
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] hover:from-[#89A8E8] hover:to-[#5B7DC6] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={registerMutation.isPending}
              aria-label="Create new account"
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </Form>

        {/* Login Link - For existing users */}
        <div className="text-center text-sm">
          <span className="text-muted-foreground">
            Already have an account?{" "}
          </span>
          <Link
            href="/login"
            className="text-[#6B8DD6] hover:text-[#5B7DC6] hover:underline font-medium transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
