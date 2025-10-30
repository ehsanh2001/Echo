import Image from "next/image";
import Link from "next/link";

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
          href="#"
          className="px-6 py-2 bg-blue-900 text-white font-medium rounded-md transition-all hover:brightness-75"
        >
          Login
        </Link>
        <Link
          href="#"
          className="px-6 py-2 bg-blue-900 text-white font-medium rounded-md transition-all hover:brightness-75"
        >
          Sign Up
        </Link>
      </nav>

      {/* Get Started Button - Desktop (at 7%, 68%) */}
      <Link
        href="#"
        className="hidden lg:flex absolute z-10 items-center justify-center rounded-lg transition-all hover:brightness-75"
        style={{
          left: "7%",
          top: "68%",
          width: "20%",
          height: "8%",
          backgroundColor: "#6A93F7",
        }}
      >
        <span className="text-white font-semibold text-xl">Get Started</span>
      </Link>

      {/* Get Started Button - Mobile (at 10%, 47%) */}
      <Link
        href="#"
        className="flex lg  :hidden absolute z-10 items-center justify-center rounded-lg transition-all hover:brightness-75"
        style={{
          left: "10%",
          top: "47%",
          width: "36%",
          height: "6%",
          backgroundColor: "#6A93F7",
        }}
      >
        <span className="text-white font-semibold text-lg">Get Started</span>
      </Link>
    </div>
  );
}
