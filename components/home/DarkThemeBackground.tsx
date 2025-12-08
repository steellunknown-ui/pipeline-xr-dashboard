"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function DarkThemeBackground() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  if (theme === "dark") {
    return (
      <div className="fixed inset-0 -z-10">
        {/* Unified dark background */}
        <div className="absolute inset-0 bg-black" />
        
        {/* Top hero glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-blue-600/20 via-purple-600/10 to-transparent blur-3xl" />
        
        {/* Bottom soft glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-purple-600/10 via-blue-600/5 to-transparent blur-3xl" />
        
        {/* Unified grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>
    );
  }

  // Light mode grid
  return (
    <div className="fixed inset-0 -z-10">
      {/* White background */}
      <div className="absolute inset-0 bg-white" />
      
      {/* Light mode grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000006_1px,transparent_1px),linear-gradient(to_bottom,#00000006_1px,transparent_1px)] bg-[size:14px_24px]" />
    </div>
  );
}
