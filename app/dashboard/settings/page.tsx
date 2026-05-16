"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import {
  User,
  Edit3,
  Sun,
  Moon,
  Key,
  Copy,
  RefreshCw,
  Trash2,
  AlertTriangle
} from "lucide-react";
import Image from "next/image";

export default function SettingsPage() {
  
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [apiKey] = useState("pk_live_****************************a1b2");

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    // In a real app, you'd apply the theme to the document
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText("pk_live_1234567890abcdef1234567890abcdefa1b2");
    // You could add a toast notification here
  };

  const generateNewKey = () => {
    // In a real app, this would call an API
    console.log("Generating new API key...");
  };

  const deleteAccount = async () => {
    setIsDeleting(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      setIsDeleting(false);
      setDeleteSuccess(true);

      setTimeout(async () => {
        setShowDeleteDialog(false);
        setDeleteSuccess(false);

        await supabase.auth.signOut();
        router.push('/login');
      }, 2000);

    } catch (error) {
      setIsDeleting(false);
      console.error('Account deletion failed:', error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* User Profile Section */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            User Profile
          </h2>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-foreground">
                {user?.user_metadata?.username || user?.email?.split('@')[0] || "User"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {user?.email || "user@example.com"}
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-muted transition-colors">
              <Edit3 className="h-4 w-4" />
              Edit Profile
            </button>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Appearance
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground">Theme</h3>
              <p className="text-sm text-muted-foreground">
                Choose your preferred theme
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === "dark" ? "bg-primary" : "bg-muted"
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === "dark" ? "translate-x-6" : "translate-x-1"
                  }`}
              />
              <div className="absolute inset-0 flex items-center justify-between px-1">
                <Sun className="h-3 w-3 text-yellow-500" />
                <Moon className="h-3 w-3 text-blue-500" />
              </div>
            </button>
          </div>
        </div>

        {/* API Keys Section */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            API Keys
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-foreground mb-2">Production Key</h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 font-mono text-sm bg-muted px-3 py-2 rounded-md border">
                  {apiKey}
                </div>
                <button
                  onClick={copyApiKey}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-muted transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </button>
              </div>
            </div>
            <button
              onClick={generateNewKey}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Generate New Key
            </button>
          </div>
        </div>

        {/* Danger Zone Section */}
        <div className="rounded-xl border border-red-200 bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-red-600 mb-4">
            Danger Zone
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-foreground">Delete Account</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-xl p-6 max-w-md w-full mx-4 shadow-lg">
            {!deleteSuccess ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Delete Account</h3>
                    <p className="text-sm text-muted-foreground">
                      This action cannot be undone
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Are you sure you want to delete your account? All of your data will be permanently removed.
                  This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowDeleteDialog(false)}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-muted transition-colors"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteAccount}
                    className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
                    disabled={isDeleting}
                  >
                    {isDeleting && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                    {isDeleting ? 'Deleting...' : 'Delete Account'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Account Deleted Successfully</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your account has been permanently deleted. Redirecting to sign-in page...
                </p>
                <div className="flex justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
