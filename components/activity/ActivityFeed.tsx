"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Loader2, RotateCcw, Activity } from "lucide-react";
import type { DeploymentActivity } from "@/lib/deployment-activity";

/**
 * PRIORITY 9.3: Activity Feed Component
 * 
 * Displays recent deployment activity in a calm, informational manner.
 * Fetches once on mount - no polling, no websockets.
 */
export function ActivityFeed() {
    const router = useRouter();
    const [activities, setActivities] = useState<DeploymentActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchActivities() {
            try {
                const response = await fetch("/api/activity");
                const data = await response.json();

                if (data.success && Array.isArray(data.activities)) {
                    setActivities(data.activities);
                }
            } catch (error) {
                console.error("Failed to fetch activities:", error);
                // Graceful failure - just show empty state
            } finally {
                setLoading(false);
            }
        }

        fetchActivities();
    }, []);

    /**
     * Gets the icon for an activity type
     */
    const getActivityIcon = (type: DeploymentActivity["type"]) => {
        switch (type) {
            case "started":
                return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
            case "success":
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case "failed":
                return <XCircle className="h-4 w-4 text-red-500" />;
            case "rollback":
                return <RotateCcw className="h-4 w-4 text-yellow-500" />;
            default:
                return <Activity className="h-4 w-4 text-gray-500" />;
        }
    };

    /**
     * Gets the background color for an activity type
     */
    const getActivityBg = (type: DeploymentActivity["type"]) => {
        switch (type) {
            case "started":
                return "bg-blue-50 border-blue-100";
            case "success":
                return "bg-green-50 border-green-100";
            case "failed":
                return "bg-red-50 border-red-100";
            case "rollback":
                return "bg-yellow-50 border-yellow-100";
            default:
                return "bg-gray-50 border-gray-100";
        }
    };

    /**
     * Formats relative time in a calm, readable way
     */
    const formatRelativeTime = (timestamp: string): string => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSeconds < 60) {
            return "Just now";
        } else if (diffMinutes < 60) {
            return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    /**
     * Navigates to deployment details
     */
    const handleActivityClick = (activity: DeploymentActivity) => {
        router.push(`/dashboard/deployments/${activity.deploymentId}/logs`);
    };

    // Loading state
    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Recent Activity
                    </CardTitle>
                    <CardDescription>Latest deployment events</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Empty state
    if (activities.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Recent Activity
                    </CardTitle>
                    <CardDescription>Latest deployment events</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <Activity className="h-8 w-8 mx-auto mb-3 opacity-40" />
                        <p>Recent deployment activity will appear here.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Activity list
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                </CardTitle>
                <CardDescription>Latest deployment events</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {activities.slice(0, 5).map((activity) => (
                        <div
                            key={activity.id}
                            onClick={() => handleActivityClick(activity)}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${getActivityBg(activity.type)}`}
                        >
                            <div className="mt-0.5">
                                {getActivityIcon(activity.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground truncate">
                                    {activity.message}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {formatRelativeTime(activity.timestamp)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
