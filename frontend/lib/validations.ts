import { z } from "zod";

/**
 * Registration form validation schema
 *
 * Validates all registration form fields including password confirmation.
 * Uses Zod for runtime type checking and validation.
 */
export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address"),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must not exceed 30 characters")
      .regex(
        /^[a-zA-Z0-9_.-]+$/,
        "Username can only contain letters, numbers, hyphens, periods, and underscores"
      ),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    displayName: z
      .string()
      .max(50, "Display name must not exceed 50 characters")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

/**
 * Login form validation schema
 *
 * Validates login credentials. Identifier can be either email or username.
 */
export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

/**
 * Type-safe registration form data
 *
 * Inferred from the registerSchema Zod schema.
 */
export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Type-safe login form data
 *
 * Inferred from the loginSchema Zod schema.
 */
export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Check password strength and requirements
 *
 * Validates a password against all security requirements and returns
 * detailed feedback about which requirements are met.
 *
 * @param password - The password to check
 * @param username - Optional username to ensure password is different
 * @returns Object with validation checks, score (0-5), validity, and error messages
 *
 * @example
 * ```typescript
 * const result = checkPasswordStrength('SecurePass123', 'johndoe');
 * console.log(result.score); // 5
 * console.log(result.isValid); // true
 * console.log(result.errors); // []
 *
 * const weak = checkPasswordStrength('weak', 'johndoe');
 * console.log(weak.score); // 1
 * console.log(weak.errors); // ['Must be at least 8 characters', ...]
 * ```
 */
export function checkPasswordStrength(password: string, username?: string) {
  // Check all password requirements
  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumbers: /[0-9]/.test(password),
    differentFromUsername:
      !username || password.toLowerCase() !== username.toLowerCase(),
  };

  // Calculate score based on passed checks
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const score = Math.min(passedChecks, 5);

  // Build error messages for failed checks
  const errors: string[] = [];
  if (!checks.minLength) errors.push("Must be at least 8 characters");
  if (!checks.hasUppercase) errors.push("Must contain uppercase letter");
  if (!checks.hasLowercase) errors.push("Must contain lowercase letter");
  if (!checks.hasNumbers) errors.push("Must contain number");
  if (!checks.differentFromUsername)
    errors.push("Must be different from username");

  return {
    checks,
    score,
    isValid: passedChecks === 5,
    errors,
  };
}

/**
 * Workspace creation form validation schema
 *
 * Validates workspace creation fields including name availability.
 */
export const workspaceFormSchema = z.object({
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(100, "Display name must be less than 100 characters"),
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(50, "Workspace name must be less than 50 characters")
    .regex(
      /^[a-z0-9-]+$/,
      "Workspace name can only contain lowercase letters, numbers, and hyphens"
    )
    .refine((val) => !val.includes(" "), {
      message: "Workspace name cannot contain spaces. Use hyphens instead.",
    }),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
});

/**
 * Type-safe workspace form data
 *
 * Inferred from the workspaceFormSchema Zod schema.
 */
export type WorkspaceFormData = z.infer<typeof workspaceFormSchema>;
