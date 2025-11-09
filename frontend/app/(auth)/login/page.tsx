import { LoginForm } from "@/components/auth/LoginForm";
import { Metadata } from "next";

/**
 * Metadata for the login page
 *
 * Defines SEO-friendly title and description for search engines and browser tabs.
 */
export const metadata: Metadata = {
  title: "Sign In - Echo",
  description:
    "Sign in to your Echo account and continue collaborating with your team",
};

/**
 * Login page component
 *
 * Renders the user login form within the auth layout.
 * Users can sign in with email/username and password.
 * Handles redirect to intended destination after login.
 *
 * @returns Login page with form
 */
export default function LoginPage() {
  return <LoginForm />;
}
