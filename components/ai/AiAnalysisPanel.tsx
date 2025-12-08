'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Lightbulb,
  Brain,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorAnalysis {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  summary: string;
  cause: string;
  suggestedFix: string[];
  affectedLogs: string[];
}

interface AiAnalysisPanelProps {
  logs: string[];
  className?: string;
}

const errorPatterns = [
  {
    keywords: ['missing environment variable', 'DATABASE_URL', 'env'],
    type: 'Environment Configuration',
    severity: 'high' as const,
    summary: 'Missing required environment variables',
    cause: 'The application is trying to access environment variables that are not configured in the deployment environment.',
    suggestedFix: [
      'Add missing environment variables to your deployment configuration',
      'Check your .env file and ensure all required variables are set',
      'Verify environment variable names match exactly (case-sensitive)'
    ]
  },
  {
    keywords: ['connection timeout', 'timeout', 'network'],
    type: 'Network Connectivity',
    severity: 'medium' as const,
    summary: 'Network connection issues detected',
    cause: 'The deployment process is experiencing network connectivity problems, possibly due to firewall rules or service unavailability.',
    suggestedFix: [
      'Check network connectivity and firewall rules',
      'Verify target server is accessible and running',
      'Increase timeout values in configuration',
      'Check DNS resolution for target hosts'
    ]
  },
  {
    keywords: ['build failed', 'compilation error', 'syntax error'],
    type: 'Build Process',
    severity: 'high' as const,
    summary: 'Build compilation errors',
    cause: 'The application code contains syntax errors or missing dependencies that prevent successful compilation.',
    suggestedFix: [
      'Review and fix syntax errors in your code',
      'Ensure all dependencies are properly installed',
      'Check TypeScript configuration if applicable',
      'Verify import statements and module paths'
    ]
  },
  {
    keywords: ['deprecated', 'outdated', 'legacy'],
    type: 'Dependency Issues',
    severity: 'low' as const,
    summary: 'Deprecated dependencies detected',
    cause: 'Your project is using outdated or deprecated packages that may cause compatibility issues.',
    suggestedFix: [
      'Update deprecated packages to their latest versions',
      'Review package.json for outdated dependencies',
      'Run npm audit to identify security vulnerabilities',
      'Consider migrating to modern alternatives'
    ]
  },
  {
    keywords: ['port', 'already in use', 'EADDRINUSE'],
    type: 'Port Configuration',
    severity: 'medium' as const,
    summary: 'Port conflict detected',
    cause: 'The application is trying to bind to a port that is already in use by another process.',
    suggestedFix: [
      'Change the application port in configuration',
      'Kill existing processes using the same port',
      'Use dynamic port allocation',
      'Check for port conflicts in your environment'
    ]
  }
];

const severityConfig = {
  low: {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/10'
  },
  medium: {
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    icon: AlertTriangle,
    bgColor: 'bg-orange-50 dark:bg-orange-950/10'
  },
  high: {
    color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    icon: XCircle,
    bgColor: 'bg-red-50 dark:bg-red-950/10'
  }
};

export function AiAnalysisPanel({ logs, className }: AiAnalysisPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyses, setAnalyses] = useState<ErrorAnalysis[]>([]);
  const [lastAnalyzedCount, setLastAnalyzedCount] = useState(0);

  const analyzeLogsForErrors = (logMessages: string[]) => {
    const foundAnalyses: ErrorAnalysis[] = [];
    
    logMessages.forEach((log, index) => {
      const lowerLog = log.toLowerCase();
      
      errorPatterns.forEach((pattern) => {
        const hasKeyword = pattern.keywords.some(keyword => 
          lowerLog.includes(keyword.toLowerCase())
        );
        
        if (hasKeyword) {
          // Check if we already have this type of analysis
          const existingAnalysis = foundAnalyses.find(a => a.type === pattern.type);
          
          if (existingAnalysis) {
            // Add to affected logs if not already present
            if (!existingAnalysis.affectedLogs.includes(log)) {
              existingAnalysis.affectedLogs.push(log);
            }
          } else {
            // Create new analysis
            foundAnalyses.push({
              id: `analysis_${pattern.type.replace(/\s+/g, '_').toLowerCase()}`,
              type: pattern.type,
              severity: pattern.severity,
              summary: pattern.summary,
              cause: pattern.cause,
              suggestedFix: pattern.suggestedFix,
              affectedLogs: [log]
            });
          }
        }
      });
    });
    
    return foundAnalyses;
  };

  useEffect(() => {
    if (logs.length > lastAnalyzedCount) {
      setIsAnalyzing(true);
      
      // Simulate AI analysis delay
      setTimeout(() => {
        const newAnalyses = analyzeLogsForErrors(logs);
        setAnalyses(newAnalyses);
        setLastAnalyzedCount(logs.length);
        setIsAnalyzing(false);
      }, 1500);
    }
  }, [logs, lastAnalyzedCount]);

  const reanalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const newAnalyses = analyzeLogsForErrors(logs);
      setAnalyses(newAnalyses);
      setLastAnalyzedCount(logs.length);
      setIsAnalyzing(false);
    }, 1000);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">AI Error Analysis</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={reanalyze}
            disabled={isAnalyzing}
            className="gap-1"
          >
            <RefreshCw className={cn('h-3 w-3', isAnalyzing && 'animate-spin')} />
            Analyze
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground">
          {isAnalyzing ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing {logs.length} log entries...
            </div>
          ) : (
            <div>
              Analyzed {logs.length} logs • Found {analyses.length} issues
            </div>
          )}
        </div>
      </Card>

      {/* Loading State */}
      {isAnalyzing && (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
            <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
          </div>
        </Card>
      )}

      {/* No Issues Found */}
      {!isAnalyzing && analyses.length === 0 && logs.length > 0 && (
        <Card className="p-6 text-center">
          <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-3" />
          <h4 className="font-medium text-foreground mb-1">No Issues Detected</h4>
          <p className="text-sm text-muted-foreground">
            Your deployment logs look healthy!
          </p>
        </Card>
      )}

      {/* Error Analyses */}
      {!isAnalyzing && analyses.map((analysis) => {
        const SeverityIcon = severityConfig[analysis.severity].icon;
        
        return (
          <Card key={analysis.id} className={cn('p-4', severityConfig[analysis.severity].bgColor)}>
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <SeverityIcon className="h-4 w-4 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-foreground text-sm">
                      {analysis.type}
                    </h4>
                    <Badge 
                      variant="outline" 
                      className={cn('text-xs mt-1', severityConfig[analysis.severity].color)}
                    >
                      {analysis.severity} severity
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {analysis.summary}
                </p>
                <p className="text-xs text-muted-foreground">
                  {analysis.cause}
                </p>
              </div>

              {/* Suggested Fixes */}
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <Lightbulb className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium text-foreground">
                    Suggested Fixes
                  </span>
                </div>
                <ul className="space-y-1">
                  {analysis.suggestedFix.map((fix, index) => (
                    <li key={index} className="text-xs text-muted-foreground flex items-start gap-1">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{fix}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Affected Logs Count */}
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  Found in {analysis.affectedLogs.length} log {analysis.affectedLogs.length === 1 ? 'entry' : 'entries'}
                </p>
              </div>
            </div>
          </Card>
        );
      })}

      {/* Empty State */}
      {!isAnalyzing && logs.length === 0 && (
        <Card className="p-6 text-center">
          <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h4 className="font-medium text-foreground mb-1">Waiting for Logs</h4>
          <p className="text-sm text-muted-foreground">
            AI analysis will start once logs are available
          </p>
        </Card>
      )}
    </div>
  );
}