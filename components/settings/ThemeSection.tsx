"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Moon, Sun } from "lucide-react";

export default function ThemeSection() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Theme</h3>
            <p className="text-sm text-muted-foreground">
              Choose your preferred theme
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors ${
              theme === "dark" ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-8 w-8 transform rounded-full bg-white transition-transform flex items-center justify-center ${
                theme === "dark" ? "translate-x-11" : "translate-x-1"
              }`}
            >
              {theme === "dark" ? (
                <Moon className="h-4 w-4 text-blue-600" />
              ) : (
                <Sun className="h-4 w-4 text-yellow-500" />
              )}
            </span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
