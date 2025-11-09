import { RegisterForm } from "@/components/auth/RegisterForm";
import { Metadata } from "next";

/**
 * Metadata for the registration page
 *
 * Defines SEO-friendly title and description for search engines and browser tabs.
 */
export const metadata: Metadata = {
  title: "Sign Up - Echo",
  description:
    "Create your Echo account and start collaborating with your team",
};

/**
 * Registration page component
 *
 * Renders the user registration form within the auth layout.
 * Users can create a new account with email, username, password, and optional display name.
 *
 * @returns Registration page with form
 */
export default function RegisterPage() {
  return <RegisterForm />;
}
