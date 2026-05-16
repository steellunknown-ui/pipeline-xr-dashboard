"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Compass, GitBranch, Shield } from "lucide-react";

/**
 * PRIORITY 7.2: Why Pipeline XR - Clarity + Positioning Layer
 * 
 * Visibility Rules:
 * SHOW when ANY of:
 *   - User has 0 deployments
 *   - User has ≥1 failed deployment
 *   - User has never enabled auto-deploy
 * 
 * HIDE when ALL of:
 *   - User has at least 1 successful deployment
 *   - Auto-deploy is enabled for any project
 */

interface WhyPipelineXRProps {
    deployments: any[];
    autoDeployEnabled: boolean;
}

export function shouldShowWhyPipelineXR(deployments: any[], autoDeployEnabled: boolean): boolean {
    const hasDeployments = deployments && deployments.length > 0;
    const hasSuccessfulDeployment = deployments?.some((d: any) => d.status === 'success');
    const hasFailedDeployment = deployments?.some((d: any) => d.status === 'failed');

    // Hide when: has successful deployment AND auto-deploy enabled
    if (hasSuccessfulDeployment && autoDeployEnabled) {
        return false;
    }

    // Show when ANY of: 0 deployments, failed deployment, no auto-deploy
    if (!hasDeployments || hasFailedDeployment || !autoDeployEnabled) {
        return true;
    }

    return false;
}

const differentiators = [
    {
        icon: Brain,
        title: "Explainability",
        subtitle: "Every deployment explains itself",
        description: "Failures, successes, and rollbacks come with reasons, risks, and next steps — automatically."
    },
    {
        icon: Compass,
        title: "Decision Intelligence",
        subtitle: "You see consequences before acting",
        description: "Pipeline XR shows what happens if you redeploy, rollback, or wait — before you click."
    },
    {
        icon: GitBranch,
        title: "Source Awareness",
        subtitle: "GitHub, ZIP, manual — all treated differently",
        description: "Each deployment knows where it came from and behaves accordingly."
    },
    {
        icon: Shield,
        title: "Safe by Design",
        subtitle: "Nothing happens without your consent",
        description: "No auto-rollbacks. No hidden retries. No destructive automation."
    }
];

export function WhyPipelineXR({ deployments, autoDeployEnabled }: WhyPipelineXRProps) {
    // Check visibility
    if (!shouldShowWhyPipelineXR(deployments, autoDeployEnabled)) {
        return null;
    }

    return (
        <Card className="border-gray-200 bg-gray-50/50">
            <CardHeader className="pb-4">
                <CardTitle className="text-gray-900">Why Pipeline XR exists</CardTitle>
                <CardDescription className="text-gray-600">
                    Deployments should explain themselves — not fail silently.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="grid gap-4 sm:grid-cols-2">
                    {differentiators.map((item) => (
                        <div key={item.title} className="flex gap-3">
                            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                                <item.icon className="h-5 w-5 text-gray-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-medium text-gray-900 text-sm">{item.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 mt-5 text-center">
                    Pipeline XR doesn't replace your judgment — it strengthens it.
                </p>
            </CardContent>
        </Card>
    );
}
