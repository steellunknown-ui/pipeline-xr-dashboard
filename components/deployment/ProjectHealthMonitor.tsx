"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, Zap, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { pingWebsite, getPageSpeedScore } from "@/app/dashboard/actions/health";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectHealthMonitorProps {
  url: string;
}

function ScoreBar({ title, score, isLoading }: { title: string, score: number | null, isLoading: boolean }) {
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          {title}
        </span>
        {isLoading ? (
           <Skeleton className="h-6 w-10 bg-zinc-800" />
        ) : score !== null ? (
          <span className={`text-xl font-bold ${score >= 90 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
            {score}
          </span>
        ) : (
          <span className="text-sm text-zinc-500">N/A</span>
        )}
      </div>
      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden flex">
        {isLoading ? (
           <div className="h-full bg-indigo-500/50 w-full animate-pulse" />
        ) : score !== null ? (
           <div 
             className={`h-full transition-all duration-1000 ${score >= 90 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
             style={{ width: `${score}%` }} 
           />
        ) : (
           <div className="h-full bg-zinc-800 w-full" />
        )}
      </div>
    </div>
  );
}

export function ProjectHealthMonitor({ url }: ProjectHealthMonitorProps) {
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isProtected, setIsProtected] = useState<boolean>(false);
  const [uptime, setUptime] = useState<number>(100); // We'll keep this optimistic for the demo, or base it on ping history
  
  const [performanceScore, setPerformanceScore] = useState<number | null>(null);
  const [seoScore, setSeoScore] = useState<number | null>(null);
  const [accessibilityScore, setAccessibilityScore] = useState<number | null>(null);
  const [isLoadingScore, setIsLoadingScore] = useState(true);
  const [lighthouseError, setLighthouseError] = useState<string | null>(null);

  // Poll for basic ping every 30 seconds
  useEffect(() => {
    let isMounted = true;
    
    async function checkPing() {
      const result = await pingWebsite(url);
      if (!isMounted) return;
      
      if (result.success) {
        if (result.status === 401) {
          setIsProtected(true);
          setIsOnline(false);
          setResponseTime(result.responseTime!);
          setUptime(prev => Math.min(100, prev + 0.1));
        } else {
          setIsProtected(false);
          setIsOnline(result.ok);
          setResponseTime(result.responseTime!);
          setUptime(prev => result.ok ? Math.min(100, prev + 0.1) : Math.max(0, prev - 1.5));
        }
      } else {
        setIsProtected(false);
        setIsOnline(false);
        setUptime(prev => Math.max(0, prev - 1.5));
      }
    }

    checkPing(); // Initial ping
    const interval = setInterval(checkPing, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [url]);

  // Fetch PageSpeed once on mount
  useEffect(() => {
    let isMounted = true;
    
    async function fetchScore() {
      setIsLoadingScore(true);
      const result = await getPageSpeedScore(url);
      if (!isMounted) return;
      
      if (result.success) {
        setPerformanceScore(result.score!);
        setSeoScore(result.seoScore ?? null);
        setAccessibilityScore(result.accessibilityScore ?? null);
        setLighthouseError(null);
      } else {
        setPerformanceScore(null);
        setSeoScore(null);
        setAccessibilityScore(null);
        
        // Handle quota errors nicely
        if (result.error?.includes('Quota') || result.error?.includes('429')) {
          setLighthouseError("Google API quota exceeded. Please try again later or add GOOGLE_API_KEY in .env");
        } else {
          setLighthouseError(result.error || "Failed to fetch metrics");
        }
      }
      setIsLoadingScore(false);
    }

    fetchScore();
    
    return () => {
      isMounted = false;
    };
  }, [url]);

  return (
    <Card className="border-zinc-800 bg-black text-white h-full">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2 text-white">
          <Activity className="w-5 h-5 text-indigo-400" />
          Health & Performance
        </CardTitle>
        <CardDescription className="text-zinc-400">Real-time metrics for your live deployment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Uptime Status */}
        <div>
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-medium text-zinc-300">Current Status</span>
            {isOnline === null && !isProtected ? (
              <Skeleton className="h-6 w-20 bg-zinc-800" />
            ) : isProtected ? (
              <span className="text-xl font-bold text-yellow-500 flex items-center gap-1">
                <ShieldCheck className="w-5 h-5" /> Protected
              </span>
            ) : isOnline ? (
              <span className="text-xl font-bold text-green-500 flex items-center gap-1">
                <CheckCircle2 className="w-5 h-5" /> Online
              </span>
            ) : (
              <span className="text-xl font-bold text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-5 h-5" /> Offline
              </span>
            )}
          </div>
          <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${isProtected ? 'bg-yellow-500' : isOnline ? 'bg-green-500' : 'bg-red-500'}`} 
              style={{ width: `${uptime}%` }} 
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2">Uptime estimated at {uptime.toFixed(1)}%</p>
          {isProtected && (
            <div className="mt-4 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-500/90 text-sm">
              <AlertTriangle className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
              Vercel Deployment Protection is ON. Disable it in Vercel Dashboard → Project Settings → Deployment Protection.
            </div>
          )}
        </div>

        {/* Lighthouse Scores */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
             <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                Lighthouse Metrics
                {isLoadingScore && <span className="text-xs text-indigo-400 animate-pulse">(Scanning...)</span>}
             </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ScoreBar title="Performance" score={performanceScore} isLoading={isLoadingScore} />
            <ScoreBar title="Accessibility" score={accessibilityScore} isLoading={isLoadingScore} />
            <ScoreBar title="SEO" score={seoScore} isLoading={isLoadingScore} />
          </div>
          <p className="text-xs text-zinc-500">
            {isLoadingScore 
              ? 'Running Lighthouse audit via Google API...' 
              : lighthouseError 
                ? <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> {lighthouseError}</span>
                : 'Powered by Google PageSpeed Insights.'}
          </p>
        </div>

        {/* Response Time */}
        <div>
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-medium text-zinc-300">Live Response Time</span>
            {responseTime === null ? (
              <Skeleton className="h-8 w-24 bg-zinc-800" />
            ) : (
              <span className={`text-2xl font-bold flex items-center gap-1 ${responseTime < 300 ? 'text-green-400' : responseTime < 1000 ? 'text-yellow-400' : 'text-red-400'}`}>
                <Zap className="w-5 h-5" />
                {responseTime}ms
              </span>
            )}
          </div>
        </div>
        
        <div className="pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Live Monitoring Active
            </div>
            {responseTime !== null && (
               <div className="flex items-center gap-1 text-xs">
                 <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                 Polling
               </div>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
