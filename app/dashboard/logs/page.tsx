"use client";

import { useState, useEffect } from "react";
import { Eye, GitBranch, Clock, Activity, Server, Search, Github } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getActivityLogs } from "../actions";
import { verifyGithubAccess } from "../actions/projects";
import { toast } from "sonner";
import type { ActivityLog } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { GradientBar } from "@/components/ui/gradient-bar";
import { GitHubProviderModal } from "@/components/modals/GitHubProviderModal";
import { supabase } from "@/lib/supabase-browser";





export default function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [githubStatus, setGithubStatus] = useState<any>(null);
  const [checkingGithub, setCheckingGithub] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [userProvider, setUserProvider] = useState<string | null>(null);

  useEffect(() => {
    // Check user's auth provider
    const checkProvider = async () => {
      
      const { data: { session } } = await supabase.auth.getSession();
      setUserProvider(session?.user?.app_metadata?.provider || null);
    };
    checkProvider();
  }, []);

  const checkGithubAccess = async () => {
    setCheckingGithub(true);
    
    // Check if user is Google provider
    if (userProvider === 'google') {
      setShowProviderModal(true);
      setCheckingGithub(false);
      return;
    }
    
    const result = await verifyGithubAccess();
    setGithubStatus(result);
    setCheckingGithub(false);
  };

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      const result = await getActivityLogs(100);
      if (result.success) {
        setLogs(result.data || []);
        setFilteredLogs(result.data || []);
      } else {
        toast.error(result.error || "Failed to fetch logs");
      }
      setLoading(false);
    }
    fetchLogs();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = logs.filter(log => 
        log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.event.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredLogs(filtered);
    } else {
      setFilteredLogs(logs);
    }
  }, [searchTerm, logs]);

  const getEventBadge = (type: string): "default" | "secondary" | "outline" => {
    if (type.includes("deployment")) return "default";
    if (type.includes("failed") || type.includes("deleted")) return "outline";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <GradientBar />
      
      {/* GitHub Provider Modal */}
      <GitHubProviderModal
        open={showProviderModal}
        onOpenChange={setShowProviderModal}
      />
      
      <div>
        <h1 className="text-3xl font-bold">Activity Logs</h1>
        <p className="text-muted-foreground mt-1">Track all events and changes in your workspace</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            onClick={checkGithubAccess}
            disabled={checkingGithub}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Github className="h-4 w-4" />
            {checkingGithub ? "Checking..." : "Check GitHub OAuth"}
          </Button>
          
          {githubStatus && (
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              githubStatus.hasToken 
                ? "bg-green-100 text-green-800 border border-green-200" 
                : "bg-red-100 text-red-800 border border-red-200"
            }`}>
              {githubStatus.hasToken ? "✅ OAuth Connected" : "❌ OAuth Missing"}
            </div>
          )}
        </div>
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
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  {searchTerm ? "No logs match your search" : "No activity logs yet"}
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getEventBadge(log.event)} className="capitalize">
                      {log.event.replace(/_/g, " ")}
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
