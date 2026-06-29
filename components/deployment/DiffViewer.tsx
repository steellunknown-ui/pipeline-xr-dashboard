"use client";

import React, { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, CheckCircle2, FileCode, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PatchChange {
    filePath: string;
    reason: string;
    before: string;
    after: string;
}

interface DiffViewerProps {
    changes: PatchChange[];
    className?: string;
}

export function DiffViewer({ changes, className }: DiffViewerProps) {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    if (!changes || changes.length === 0) {
        return (
            <div className="p-4 text-sm text-zinc-500 bg-zinc-950 rounded-md border border-zinc-800 text-center">
                No changes to display
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className || ""}`}>
            {changes.map((change, index) => (
                <div key={index} className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl">
                    {/* File Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                        <div className="flex items-center gap-2 text-zinc-300 font-mono text-sm">
                            <FileCode className="h-4 w-4 text-indigo-400" />
                            {change.filePath}
                        </div>
                        <span className="text-xs text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded-full border border-zinc-700/50">
                            {change.reason}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
                        {/* Old Code (Red) */}
                        <div className="bg-[#1e1012] relative group">
                            <div className="px-4 py-2 border-b border-red-900/30 bg-red-950/20 text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center justify-between">
                                <span>Current Code</span>
                            </div>
                            <ScrollArea className="h-[250px] w-full">
                                <div className="p-4 font-mono text-xs text-red-200 whitespace-pre overflow-x-auto">
                                    {change.before || <span className="italic text-zinc-600">File is new or empty.</span>}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* New Code (Green) */}
                        <div className="bg-[#0c1a12] relative group">
                            <div className="px-4 py-2 border-b border-green-900/30 bg-green-950/20 text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center justify-between">
                                <span>AI Suggested Fix</span>
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-6 px-2 text-green-400 hover:text-green-300 hover:bg-green-900/40"
                                    onClick={() => handleCopy(change.after, index)}
                                >
                                    {copiedIndex === index ? (
                                        <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Copied</>
                                    ) : (
                                        <><Copy className="h-3.5 w-3.5 mr-1" /> Copy Fix</>
                                    )}
                                </Button>
                            </div>
                            <ScrollArea className="h-[250px] w-full">
                                <div className="p-4 font-mono text-xs text-green-200 whitespace-pre overflow-x-auto">
                                    {change.after || <span className="italic text-zinc-600">File will be deleted.</span>}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
