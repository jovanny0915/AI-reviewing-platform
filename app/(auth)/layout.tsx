import React from "react";
import Image from "next/image";

export default function AuthLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="w-full max-w-sm mb-8">
        <Image
          src="/litreview-logo.png"
          alt="LitReview"
          width={320}
          height={90}
          className="w-full h-auto object-contain"
          priority
        />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
