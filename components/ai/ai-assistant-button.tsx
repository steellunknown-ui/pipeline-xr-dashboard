"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { AiChatModal } from "./ai-chat-modal";

export function AiAssistantButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
      >
        <Bot className="h-6 w-6" />
      </Button>
      <AiChatModal open={open} onOpenChange={setOpen} />
    </>
  );
}
