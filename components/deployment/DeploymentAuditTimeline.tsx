"use client";

import { useState, useEffect } from "react";
import { Clock, User, Server } from "lucide-react";
import { type AuditLogEntry } from "@/lib/audit-log";

interface DeploymentAuditTimelineProps {
    deploymentId: string;
}

export function DeploymentAuditTimeline({ deploymentId }: DeploymentAuditTimelineProps) {
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAuditLogs();
    }, [deploymentId]);

    const fetchAuditLogs = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/deployments/${deploymentId}/audit`);
            const data = await response.json();

            if (data.success) {
                setAuditLogs(data.audit || []);
            } else {
                setError(data.error || "Failed to load audit history");
            }
        } catch (err) {
            setError("Failed to load audit history");
        } finally {
            setLoading(false);
        }
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getActorIcon = (actorType: "user" | "system") => {
        return actorType === "user" ? (
            <User className="h-3.5 w-3.5 text-slate-400" />
        ) : (
            <Server className="h-3.5 w-3.5 text-slate-400" />
        );
    };

    if (loading) {
        return (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <div className="animate-pulse space-y-3">
                    <div className="h-4 w-24 bg-slate-200 rounded"></div>
                    <div className="h-3 w-full bg-slate-200 rounded"></div>
                    <div className="h-3 w-3/4 bg-slate-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-500">{error}</p>
            </div>
        );
    }

    if (auditLogs.length === 0) {
        return (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-500">No audit history yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-700">Audit History</h3>
            <div className="bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-200">
                {auditLogs.map((log) => (
                    <div key={log.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700">{log.message}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    {getActorIcon(log.actor_type)}
                                    <span className="text-xs text-slate-500">{log.actor_label}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(log.created_at)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
