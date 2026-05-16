"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink } from "lucide-react";

interface GitHubAlreadyLinkedModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function GitHubAlreadyLinkedModal({ open, onOpenChange }: GitHubAlreadyLinkedModalProps) {
    const handleVisitGitHub = () => {
        window.open("https://github.com", "_blank");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertCircle className="h-6 w-6 text-destructive" />
                        </div>
                        <DialogTitle className="text-lg">GitHub Account Already Linked</DialogTitle>
                    </div>
                    <DialogDescription className="text-base leading-relaxed pt-2">
                        This GitHub account is already linked to another Pipeline XR user. Each GitHub account can only be linked to one Pipeline XR account.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="w-full sm:w-auto"
                    >
                        Close
                    </Button>
                    <Button
                        onClick={handleVisitGitHub}
                        className="w-full sm:w-auto"
                    >
                        Visit GitHub
                        <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}