"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZipUploadModal } from "./ZipUploadModal";

export function UploadZipButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState(0);

  function handleClick() {
    // Force refresh the input element
    setKey(prev => prev + 1);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 10);
  }

  return (
    <>
      <Button
        onClick={handleClick}
        variant="outline"
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        Upload ZIP
      </Button>
      <ZipUploadModal fileInputRef={fileInputRef} key={key} />
    </>
  );
}
