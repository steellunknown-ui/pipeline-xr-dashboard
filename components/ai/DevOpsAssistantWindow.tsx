"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, Loader2, Sparkles, Wrench, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase-browser";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface DevOpsAssistantWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DevOpsAssistantWindow({ open, onOpenChange }: DevOpsAssistantWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "🚀 Hey! I'm XR DevOps AI. I can help you deploy projects, analyze errors, and fix issues. What do you need help with?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const quickActions = [
    { label: "Auto-deploy my project", icon: Sparkles },
    { label: "Upload ZIP for deployment", icon: Wrench },
    { label: "Analyze failed deployment", icon: CheckCircle },
  ];

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          userId: user.id,
          githubToken: session?.provider_token,
        }),
      });

      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('AI service returned invalid response format');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'AI request failed');
      }

      const aiMessage: Message = {
        role: "assistant",
        content: data.message || data.data?.response || 'I\'m here to help with your deployments.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error: any) {
      toast.error(error.message || "Failed to get AI response");
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickAction(action: string) {
    setInput(action);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] h-[600px] p-0 gap-0 overflow-hidden flex flex-col rounded-xl shadow-2xl border-0">
        <DialogTitle className="sr-only">XR DevOps AI Assistant</DialogTitle>
        
        {/* Platinum Gradient Top Border */}
        <div className="h-[2px] w-full bg-gradient-to-r from-zinc-400 via-zinc-200 to-zinc-400 dark:from-zinc-500 dark:via-zinc-300 dark:to-zinc-500" />
        
        {/* Header */}
        <div className="px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-black flex items-center justify-center border border-zinc-300 dark:border-zinc-700/50">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="16" height="16" rx="3" className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth="2" />
                <path d="M8 12H16M12 8V16" className="stroke-zinc-700 dark:stroke-zinc-200" strokeWidth="2" strokeLinecap="round" />
                <circle cx="8" cy="8" r="1" className="fill-zinc-800 dark:fill-white" />
                <circle cx="16" cy="8" r="1" className="fill-zinc-800 dark:fill-white" />
                <circle cx="12" cy="16" r="1" className="fill-zinc-800 dark:fill-white" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold">XR DevOps AI</h3>
              <p className="text-xs text-muted-foreground">Senior Engineer Mode</p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2 items-start",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-black flex items-center justify-center flex-shrink-0 mt-0.5 border border-zinc-300 dark:border-zinc-700/50">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="4" y="4" width="16" height="16" rx="3" className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth="2" />
                      <path d="M8 12H16M12 8V16" className="stroke-zinc-700 dark:stroke-zinc-200" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="8" cy="8" r="1" className="fill-zinc-800 dark:fill-white" />
                      <circle cx="16" cy="8" r="1" className="fill-zinc-800 dark:fill-white" />
                      <circle cx="12" cy="16" r="1" className="fill-zinc-800 dark:fill-white" />
                    </svg>
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 max-w-[85%] shadow-sm",
                    msg.role === "user"
                      ? "bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-800 dark:to-black text-zinc-900 dark:text-zinc-100 border border-zinc-400 dark:border-zinc-700/50"
                      : "bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700/50"
                  )}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className="text-[10px] opacity-50 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-800 dark:to-black flex items-center justify-center flex-shrink-0 mt-0.5 border border-zinc-400 dark:border-zinc-700/50">
                    <User className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 items-start">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-black flex items-center justify-center flex-shrink-0 border border-zinc-300 dark:border-zinc-700/50">
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="4" width="16" height="16" rx="3" className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth="2" />
                    <path d="M8 12H16M12 8V16" className="stroke-zinc-700 dark:stroke-zinc-200" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="8" cy="8" r="1" className="fill-zinc-800 dark:fill-white" />
                    <circle cx="16" cy="8" r="1" className="fill-zinc-800 dark:fill-white" />
                    <circle cx="12" cy="16" r="1" className="fill-zinc-800 dark:fill-white" />
                  </svg>
                </div>
                <div className="bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700/50 rounded-2xl px-3 py-2 shadow-sm">
                  <p className="text-sm">Analyzing...</p>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        {/* Quick Actions + Input Area */}
        <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 space-y-2">
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action.label)}
                disabled={loading}
                className="h-7 text-xs rounded-full"
              >
                <action.icon className="h-3 w-3 mr-1" />
                {action.label}
              </Button>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Ask me anything..."
              disabled={loading}
              className="flex-1 rounded-full text-sm h-9"
            />
            <Button 
              onClick={handleSend} 
              disabled={loading || !input.trim()}
              size="icon"
              className="h-9 w-9 rounded-full flex-shrink-0 bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-800 dark:to-black border border-zinc-400 dark:border-zinc-700/50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

