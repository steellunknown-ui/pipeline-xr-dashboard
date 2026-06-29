"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { createClient } from "@/lib/supabase-browser";
import { supabase } from "@/lib/supabase-browser";
import { User } from "@supabase/supabase-js";
import { getUserDisplayName, getUserAvatar } from "@/lib/auth-utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";

const publicNavLinks = [
  { name: "Home", href: "/" },
  { name: "Features", href: "#features" },
  { name: "Docs", href: "#docs" },
  { name: "Pricing", href: "#pricing" },
];

const authNavLinks = [
  { name: "Home", href: "/" },
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
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    router.push("/");
  };

  const displayName = getUserDisplayName(user);
  const avatarUrl = getUserAvatar(user);
  const navLinks = user ? authNavLinks : publicNavLinks;

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
          className="transition-colors duration-300 mix-blend-screen"
        >
          <Image src="/images/logo-full.png" alt="Pipeline XR" width={180} height={40} className="object-contain h-8 w-auto" />
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
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={displayName}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full border-2 border-border"
                  />
                ) : (
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    lightMode ? "bg-black/10 border-black/20" : "bg-white/10 border-white/20"
                  }`}>
                    <UserIcon className="h-4 w-4" />
                  </div>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
};
