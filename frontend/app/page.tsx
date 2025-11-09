import Image from "next/image";
import Link from "next/link";

/**
 * Home page / Landing page component
 *
 * Displays the Echo landing page with:
 * - Responsive background images (wide for desktop, vertical for mobile)
 * - Top-right navigation with Login and Sign Up buttons
 * - Positioned "Get Started" CTA buttons (desktop and mobile versions)
 * - All buttons use #99B8F8 gradient color scheme
 * - All navigation links point to /register page
 *
 * @returns Landing page layout
 */
export default function Home() {
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Background Image for Desktop */}
      <div className="hidden lg:block absolute inset-0">
        <Image
          src="/landing-wide.png"
          alt="Echo Landing Page"
          fill
          priority
          className="max-w-full h-auto"
          sizes="100vw"
        />
      </div>

      {/* Background Image for Mobile */}
      <div className="block lg:hidden absolute inset-0">
        <Image
          src="/landing-mobile.png"
          alt="Echo Landing Page"
          fill
          priority
          className="max-w-full h-auto"
          sizes="100vw"
        />
      </div>

      {/* Top Right Navigation Buttons */}
      <nav className="absolute top-6 right-6 z-10 flex gap-4">
        <Link
          href="/login"
          className="px-6 py-2 bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] text-white font-medium rounded-md shadow-md hover:shadow-lg hover:from-[#89A8E8] hover:to-[#5B7DC6] transition-all"
        >
          Login
        </Link>
        <Link
          href="/register"
          className="px-6 py-2 bg-gradient-to-r from-[#99B8F8] to-[#6B8DD6] text-white font-medium rounded-md shadow-md hover:shadow-lg hover:from-[#89A8E8] hover:to-[#5B7DC6] transition-all"
        >
          Sign Up
        </Link>
      </nav>

      {/* Get Started Button - Desktop (at 7%, 68%) */}
      <Link
        href="/register"
        className="hidden lg:flex absolute z-10 items-center justify-center rounded-lg shadow-lg hover:shadow-xl transition-all hover:brightness-110"
        style={{
          left: "7%",
          top: "68%",
          width: "20%",
          height: "8%",
          background: "linear-gradient(to right, #99B8F8, #6B8DD6)",
        }}
      >
        <span className="text-white font-semibold text-xl">Get Started</span>
      </Link>

      {/* Get Started Button - Mobile (at 10%, 47%) */}
      <Link
        href="/register"
        className="flex lg:hidden absolute z-10 items-center justify-center rounded-lg shadow-lg hover:shadow-xl transition-all hover:brightness-110"
        style={{
          left: "10%",
          top: "47%",
          width: "36%",
          height: "6%",
          background: "linear-gradient(to right, #99B8F8, #6B8DD6)",
        }}
      >
        <span className="text-white font-semibold text-lg">Get Started</span>
      </Link>
    </div>
  );
}
