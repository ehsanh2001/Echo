import Link from "next/link";
import { ReactNode } from "react";

/**
 * Props for the AuthLayout component
 */
interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Layout component for authentication pages
 *
 * Provides a consistent visual wrapper for all auth pages (register, login) with:
 * - Gradient background using #99B8F8 color scheme
 * - Echo branding with logo and tagline
 * - Centered white card container for form content
 * - Footer with copyright
 *
 * @param props - Component props
 * @param props.children - Auth page content to render inside the card
 * @returns Authentication layout wrapper
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#99B8F8] via-[#B8CFFF] to-[#E8F0FF] py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo/Branding with enhanced styling */}
        <div className="text-center">
          <div className="inline-block p-3 bg-white rounded-full shadow-lg mb-4">
            <Link href="/">
              <div className="w-12 h-12 bg-gradient-to-br from-[#99B8F8] to-[#6B8DD6] rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-white">E</span>
              </div>
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-md">
            Echo
          </h1>
          <p className="text-lg text-white/90 drop-shadow">
            Team collaboration made simple
          </p>
        </div>

        {/* Form Content with enhanced card styling */}
        <div className="bg-white shadow-2xl rounded-2xl p-8 border border-[#99B8F8]/20">
          {children}
        </div>

        {/* Footer text */}
        <p className="text-center text-sm text-white/80 drop-shadow">
          © 2025 Echo. Built for modern teams.
        </p>
      </div>
    </div>
  );
}
