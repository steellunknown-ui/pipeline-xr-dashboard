"use client";

import { useState, useEffect } from "react";
import { Github, FileArchive, Settings, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TimelineStage {
  name: string;
  status: "completed" | "active" | "pending";
  duration?: number;
}

interface TimelineData {
  success: boolean;
  deploymentId?: string;
  status?: string;
  currentStage?: string;
  elapsedSeconds?: number;
  stages?: TimelineStage[];
  source?: string;
  error?: string;
}

interface DeploymentTimelineProps {
  deploymentId: string;
}

export function DeploymentTimeline({ deploymentId }: DeploymentTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeline();
  }, [deploymentId]);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/deployments/${deploymentId}/timeline`);
      const data = await response.json();
      setTimeline(data);
    } catch (error) {
      setTimeline({ success: false, error: "Failed to load timeline" });
    } finally {
      setLoading(false);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "github":
        return <Github className="h-4 w-4" />;
      case "zip":
        return <FileArchive className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getStageIcon = (stage: TimelineStage) => {
    if (stage.status === "completed") {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (stage.status === "active") {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    } else {
      return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatElapsedTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Deployment Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!timeline?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Deployment Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {timeline?.error || "Timeline data not available"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Deployment Timeline
          </div>
          <div className="flex items-center gap-2">
            {timeline.source && (
              <Badge variant="outline" className="flex items-center gap-1">
                {getSourceIcon(timeline.source)}
                {timeline.source}
              </Badge>
            )}
            {timeline.elapsedSeconds !== undefined && (
              <Badge variant="secondary">
                {formatElapsedTime(timeline.elapsedSeconds)}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {timeline.stages?.map((stage, index) => (
            <div key={stage.name} className="flex items-center gap-3">
              {getStageIcon(stage)}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">
                    {stage.name === "completed" ? "Deployed" : stage.name}
                  </span>
                  {stage.duration !== undefined && (
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(stage.duration)}
                    </span>
                  )}
                </div>
                {stage.status === "active" && (
                  <div className="text-sm text-blue-600">In progress...</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}