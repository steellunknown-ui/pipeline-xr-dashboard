"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Info } from "lucide-react";
import { type DeploymentReplayEvent } from "@/lib/deployment-replay";
import { type ReplayExplanationResult } from "@/lib/replay-explanation";

interface DeploymentReplayTimelineProps {
  deploymentId: string;
}

export function DeploymentReplayTimeline({ deploymentId }: DeploymentReplayTimelineProps) {
  const [replay, setReplay] = useState<DeploymentReplayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<{ event: DeploymentReplayEvent; index: number } | null>(null);
  const [explanation, setExplanation] = useState<ReplayExplanationResult | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  useEffect(() => {
    fetchReplay();
  }, [deploymentId]);

  const fetchReplay = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/deployments/${deploymentId}/replay`);
      const data = await response.json();
      if (data.success) {
        setReplay(data.replay || []);
      }
    } catch (error) {
      setReplay([]);
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeTime = (ms: number) => {
    const seconds = (ms / 1000).toFixed(1);
    return `+${seconds}s`;
  };

  const handleEventClick = async (event: DeploymentReplayEvent, index: number) => {
    setSelectedEvent({ event, index });
    setExplanation(null);
    setLoadingExplanation(true);

    try {
      const response = await fetch(`/api/deployments/${deploymentId}/replay/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIndex: index }),
      });
      const data = await response.json();
      if (data.success) {
        setExplanation(data.explanation);
      }
    } catch (error) {
      setExplanation(null);
    } finally {
      setLoadingExplanation(false);
    }
  };

  const getEventColor = (event: DeploymentReplayEvent) => {
    if (event.type === "BUILD_FAILED") return "text-red-500";
    if (event.source === "system") return "text-gray-500";
    if (event.source === "runner") return "text-blue-500";
    return "text-gray-500";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Deployment replay
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            A step-by-step reconstruction of what happened during this deployment.
          </p>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (replay.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Deployment replay
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            A step-by-step reconstruction of what happened during this deployment.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Replay data is limited for this deployment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          Deployment replay
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          A step-by-step reconstruction of what happened during this deployment.
        </p>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] overflow-y-auto space-y-3">
          {replay.map((event, index) => (
            <div
              key={index}
              className="flex gap-3 items-start cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
              onClick={() => handleEventClick(event, index)}
            >
              <div className="flex-shrink-0 w-16 text-xs text-muted-foreground font-mono">
                {formatRelativeTime(event.relativeMs)}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${getEventColor(event)}`}>
                  {event.type.replace(/_/g, " ")}
                </div>
                <div className="text-sm text-muted-foreground font-mono break-words">
                  {event.message}
                </div>
              </div>
              <Info className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </div>
          ))}
        </div>

        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Event Explanation
              </DialogTitle>
            </DialogHeader>
            {selectedEvent && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded">
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    {selectedEvent.event.type.replace(/_/g, " ")}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {formatRelativeTime(selectedEvent.event.relativeMs)} • {selectedEvent.event.message}
                  </div>
                </div>

                {loadingExplanation ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ) : explanation ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Summary</div>
                      <div className="text-sm text-gray-600">{explanation.summary}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Why it matters</div>
                      <div className="text-sm text-gray-600">{explanation.whyItMatters}</div>
                    </div>
                    {explanation.whatToCheckNext && explanation.whatToCheckNext.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">What to check next</div>
                        <ul className="list-disc list-inside space-y-1">
                          {explanation.whatToCheckNext.map((item, i) => (
                            <li key={i} className="text-sm text-gray-600">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    Not enough context to explain this step in detail.
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
