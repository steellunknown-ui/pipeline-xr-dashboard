"use client";

import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DiffViewerProps {
    diffText: string;
    className?: string;
}

export function DiffViewer({ diffText, className }: DiffViewerProps) {
    if (!diffText) {
        return (
            <div className="p-4 text-sm text-gray-500 bg-gray-50 rounded-md border text-center">
                No changes to display
            </div>
        );
    }

    const lines = diffText.split("\n");

    return (
        <div className={`border rounded-md bg-white overflow-hidden ${className}`}>
            <ScrollArea className="h-[300px] w-full">
                <div className="p-4 font-mono text-xs md:text-sm whitespace-pre overflow-x-auto">
                    {lines.map((line, index) => {
                        let type: "added" | "removed" | "header" | "normal" = "normal";
                        if (line.startsWith("+") && !line.startsWith("+++")) type = "added";
                        else if (line.startsWith("-") && !line.startsWith("---")) type = "removed";
                        else if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) type = "header";

                        return (
                            <div
                                key={index}
                                className={`flex w-full ${type === "added"
                                        ? "bg-green-50 text-green-700"
                                        : type === "removed"
                                            ? "bg-red-50 text-red-700"
                                            : type === "header"
                                                ? "text-gray-500 font-bold bg-gray-50"
                                                : "text-gray-600"
                                    }`}
                            >
                                <span className="select-none w-6 text-right mr-4 opacity-30 text-[10px] leading-6">
                                    {index + 1}
                                </span>
                                <span className="leading-6 py-0.5">{line}</span>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}
