"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Features", href: "#features" },
  { name: "Docs", href: "#docs" },
  { name: "Pricing", href: "#pricing" },
  { name: "Dashboard", href: "/dashboard" },
];

const useScrollState = () => {
  const [hidden, setHidden] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        setLightMode(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    const heroElement = document.querySelector("#hero-section");
    if (heroElement) {
      heroObserver.observe(heroElement);
    }

    return () => {
      if (heroElement) {
        heroObserver.unobserve(heroElement);
      }
    };
  }, []);

  return { hidden, lightMode };
};

export const Navbar = () => {
  const { hidden, lightMode } = useScrollState();

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ 
        y: hidden ? -80 : 0, 
        opacity: hidden ? 0 : 1 
      }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`fixed left-0 top-0 z-50 w-full backdrop-blur-xl transition-all duration-300 ${
        lightMode
          ? "border-b border-black/10 bg-white/80 shadow-[0_2px_15px_rgba(0,0,0,0.15)]"
          : "border-b border-white/10 bg-black/10"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link 
          href="/" 
          className={`text-xl font-bold transition-colors duration-300 ${
            lightMode ? "text-black" : "text-white"
          }`}
        >
          Pipeline XR
        </Link>

        <div className="flex items-center gap-8">
          {navLinks.map((link) => (
            <motion.div key={link.name} whileHover={{ scale: 1.05 }}>
              <Link
                href={link.href}
                className={`relative text-sm transition-colors duration-300 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:transition-all after:duration-300 hover:after:w-full ${
                  lightMode
                    ? "text-black/90 hover:text-black after:bg-black"
                    : "text-white/90 hover:text-white after:bg-white"
                }`}
              >
                {link.name}
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            href="/login"
            className={`text-sm transition-colors duration-300 ${
              lightMode
                ? "text-black/90 hover:text-black"
                : "text-white/90 hover:text-white"
            }`}
          >
            Login
          </Link>
          <Link
            href="/signup"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-105 ${
              lightMode
                ? "bg-black text-white"
                : "bg-white text-black"
            }`}
          >
            Sign Up
          </Link>
        </div>
      </div>
    </motion.nav>
  );
};
