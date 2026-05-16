"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, GitCommit, Rocket, Settings as SettingsIcon } from "lucide-react";
import { getActivityLogs } from "../actions";
import { toast } from "sonner";
import type { ActivityLog } from "@/lib/types/database";
import { GradientBar } from "@/components/ui/gradient-bar";



export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      const result = await getActivityLogs(50);
      if (result.success) {
        setLogs(result.data || []);
      } else {
        toast.error(result.error || "Failed to fetch activity logs");
      }
      setLoading(false);
    }
    fetchLogs();
  }, []);

  const getEventIcon = (type: string) => {
    if (type.includes("deployment")) return <Rocket className="h-4 w-4" />;
    if (type.includes("project")) return <Activity className="h-4 w-4" />;
    if (type.includes("env")) return <SettingsIcon className="h-4 w-4" />;
    return <GitCommit className="h-4 w-4" />;
  };

  const getEventVariant = (type: string): "default" | "secondary" | "outline" => {
    if (type.includes("deployment")) return "default";
    if (type.includes("deleted")) return "outline";
    return "secondary";
  };
  return (
    <div className="space-y-6">
      <GradientBar />
      <div>
        <h1 className="text-3xl font-bold">Activity Log</h1>
        <p className="text-muted-foreground mt-1">Track all events and changes in your workspace</p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No activity logs yet
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getEventVariant(log.event)} className="flex items-center gap-1 w-fit">
                      {getEventIcon(log.event)}
                      <span className="capitalize">{log.event.replace(/_/g, " ")}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>{log.description}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
