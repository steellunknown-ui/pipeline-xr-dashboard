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
import { useRouter } from "next/navigation";

interface GitHubProviderModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function GitHubProviderModal({ open, onOpenChange }: GitHubProviderModalProps) {
    const router = useRouter();

    const handleCreateAccount = () => {
        window.open("https://github.com/signup", "_blank");
    };

    const handleLoginWithGitHub = () => {
        // Redirect to auth callback with GitHub provider
        window.location.href = '/auth/github';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertCircle className="h-6 w-6 text-destructive" />
                        </div>
                        <DialogTitle className="text-lg">GitHub connection unavailable</DialogTitle>
                    </div>
                    <DialogDescription className="text-base leading-relaxed pt-2">
                        To connect GitHub, please sign up or log in using a GitHub account.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        onClick={handleLoginWithGitHub}
                        className="w-full sm:w-auto"
                    >
                        Log in with GitHub
                    </Button>
                    <Button
                        onClick={handleCreateAccount}
                        className="w-full sm:w-auto"
                    >
                        Create GitHub Account
                        <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
