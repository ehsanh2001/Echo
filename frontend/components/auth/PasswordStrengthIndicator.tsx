"use client";

import { checkPasswordStrength } from "@/lib/validations";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for PasswordStrengthIndicator component
 */
interface PasswordStrengthIndicatorProps {
  password: string;
  username?: string;
}

/**
 * Password strength indicator component
 *
 * Displays a visual strength meter and checklist of password requirements.
 * Shows a 5-level strength bar and detailed requirement checks.
 *
 * @param props - Component props
 * @returns Password strength visualization or null if password is empty
 *
 * @example
 * ```typescript
 * <PasswordStrengthIndicator
 *   password="SecurePass123"
 *   username="johndoe"
 * />
 * ```
 */
export function PasswordStrengthIndicator({
  password,
  username,
}: PasswordStrengthIndicatorProps) {
  // Don't show anything if password is empty
  if (!password) return null;

  // Evaluate password strength
  const result = checkPasswordStrength(password, username);

  /**
   * Get Tailwind background color class based on password score
   * @param score - Password strength score (0-5)
   * @returns Tailwind CSS class for background color
   */
  const getStrengthColor = (score: number) => {
    if (score <= 1) return "bg-red-500";
    if (score <= 2) return "bg-orange-500";
    if (score <= 3) return "bg-yellow-500";
    if (score <= 4) return "bg-blue-500";
    return "bg-green-500";
  };

  /**
   * Get human-readable strength label based on score
   * @param score - Password strength score (0-5)
   * @returns Strength description text
   */
  const getStrengthText = (score: number) => {
    if (score <= 1) return "Very Weak";
    if (score <= 2) return "Weak";
    if (score <= 3) return "Fair";
    if (score <= 4) return "Good";
    return "Strong";
  };

  // Password requirements to display in checklist
  const requirements = [
    {
      key: "minLength",
      text: "At least 8 characters",
      passed: result.checks.minLength,
    },
    {
      key: "hasUppercase",
      text: "One uppercase letter",
      passed: result.checks.hasUppercase,
    },
    {
      key: "hasLowercase",
      text: "One lowercase letter",
      passed: result.checks.hasLowercase,
    },
    { key: "hasNumbers", text: "One number", passed: result.checks.hasNumbers },
    {
      key: "differentFromUsername",
      text: "Different from username",
      passed: result.checks.differentFromUsername,
    },
  ];

  return (
    <div className="mt-2 space-y-2">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Password strength:</span>
          <span
            className={cn(
              "font-medium",
              result.score <= 2
                ? "text-red-600"
                : result.score <= 4
                  ? "text-yellow-600"
                  : "text-green-600"
            )}
          >
            {getStrengthText(result.score)}
          </span>
        </div>
        <div className="flex space-x-1">
          {[...Array(5)].map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-2 flex-1 rounded-full bg-muted",
                index < result.score && getStrengthColor(result.score)
              )}
            />
          ))}
        </div>
      </div>

      {/* Requirements Checklist */}
      <div className="space-y-1">
        {requirements.map((req) => (
          <div key={req.key} className="flex items-center space-x-2 text-sm">
            <div
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full",
                req.passed
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-600"
              )}
            >
              {req.passed ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </div>
            <span
              className={cn(req.passed ? "text-green-600" : "text-red-600")}
            >
              {req.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
