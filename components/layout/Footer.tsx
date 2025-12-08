"use client";

import Link from "next/link";
import { Github, Twitter } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="w-full border-t border-white/10 bg-black py-12 text-white/70">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Left - Logo & Description */}
          <div>
            <h3 className="mb-2 text-lg font-bold text-white">Pipeline XR</h3>
            <p className="text-sm">
              AI-powered deployment platform for modern developers. Ship faster, monitor smarter.
            </p>
          </div>

          {/* Middle - Links */}
          <div className="flex gap-8">
            <div>
              <h4 className="mb-3 text-sm font-semibold text-white">Product</h4>
              <div className="flex flex-col gap-2">
                <Link href="/" className="text-sm transition-colors hover:text-white">
                  Home
                </Link>
                <Link href="#docs" className="text-sm transition-colors hover:text-white">
                  Docs
                </Link>
                <Link href="#pricing" className="text-sm transition-colors hover:text-white">
                  Pricing
                </Link>
                <Link href="/dashboard" className="text-sm transition-colors hover:text-white">
                  Dashboard
                </Link>
              </div>
            </div>
          </div>

          {/* Right - Social Icons */}
          <div className="flex items-start justify-end gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              <Github className="h-5 w-5" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              <Twitter className="h-5 w-5" />
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-8 text-center text-sm">
          © 2024 Pipeline XR. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
