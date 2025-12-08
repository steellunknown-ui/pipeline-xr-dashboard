'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Info, 
  XCircle, 
  CheckCircle,
  Lightbulb,
  Copy,
  Clock
} from 'lucide-react';
import { LogMessage } from '@/lib/ws-client';
import { cn } from '@/lib/utils';

interface LogDetailsModalProps {
  log: LogMessage | null;
  isOpen: boolean;
  onClose: () => void;
}

const logAnalysis = {
  'Missing environment variable DATABASE_URL': {
    type: 'Configuration Error',
    severity: 'high',
    category: 'Environment Setup',
    reason: 'The application is trying to connect to a database but cannot find the DATABASE_URL environment variable in the deployment configuration.',
    impact: 'Application will fail to start and cannot connect to the database, causing complete service failure.',
    solutions: [
      'Add DATABASE_URL to your environment variables in the deployment settings',
      'Verify the database connection string format: postgresql://user:password@host:port/database',
      'Check if the database server is accessible from the deployment environment',
      'Ensure the environment variable name matches exactly (case-sensitive)'
    ],
    prevention: 'Always validate environment variables in your CI/CD pipeline before deployment'
  },
  'Large image size detected': {
    type: 'Performance Warning',
    severity: 'medium',
    category: 'Docker Optimization',
    reason: 'The Docker image being pulled is larger than recommended (2.1GB), which can slow down deployment and increase resource usage.',
    impact: 'Slower deployment times, increased bandwidth usage, and higher storage costs.',
    solutions: [
      'Use multi-stage Docker builds to reduce final image size',
      'Remove unnecessary packages and files from the Docker image',
      'Use alpine-based images instead of full OS images',
      'Add .dockerignore file to exclude unnecessary files',
      'Optimize layer caching by ordering Dockerfile commands properly'
    ],
    prevention: 'Regularly audit Docker images and set up automated size monitoring'
  },
  'Deprecated package found': {
    type: 'Security Warning',
    severity: 'low',
    category: 'Dependency Management',
    reason: 'The project is using lodash@3.10.1 which is an outdated version with known security vulnerabilities and compatibility issues.',
    impact: 'Potential security vulnerabilities, compatibility issues with newer packages, and lack of bug fixes.',
    solutions: [
      'Update lodash to the latest version: npm install lodash@latest',
      'Run npm audit to identify all vulnerable packages',
      'Use npm audit fix to automatically fix known vulnerabilities',
      'Consider using modern alternatives like native ES6+ methods',
      'Set up automated dependency scanning in your CI/CD pipeline'
    ],
    prevention: 'Regularly update dependencies and use tools like Dependabot for automated updates'
  },
  'Unused variable detected': {
    type: 'Code Quality Warning',
    severity: 'low',
    category: 'Code Optimization',
    reason: 'TypeScript compiler found an unused variable in utils.ts at line 42, which indicates dead code or potential oversight.',
    impact: 'Increased bundle size, potential confusion for developers, and reduced code maintainability.',
    solutions: [
      'Remove the unused variable if it\'s truly not needed',
      'Use the variable if it was intended to be used',
      'Add underscore prefix (_variable) if it\'s intentionally unused',
      'Configure ESLint rules to catch unused variables during development',
      'Use TypeScript strict mode to catch more potential issues'
    ],
    prevention: 'Set up proper linting rules and code review processes to catch unused code early'
  }
};

const severityConfig = {
  low: {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    icon: Info,
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

const logLevelConfig = {
  info: { icon: Info, color: 'text-blue-600 dark:text-blue-400' },
  warn: { icon: AlertTriangle, color: 'text-yellow-600 dark:text-yellow-400' },
  error: { icon: XCircle, color: 'text-red-600 dark:text-red-400' },
  debug: { icon: CheckCircle, color: 'text-gray-600 dark:text-gray-400' }
};

export function LogDetailsModal({ log, isOpen, onClose }: LogDetailsModalProps) {
  if (!log) return null;

  const analysis = Object.entries(logAnalysis).find(([key]) => 
    log.message.toLowerCase().includes(key.toLowerCase())
  )?.[1];

  const LogIcon = logLevelConfig[log.level].icon;
  const SeverityIcon = analysis ? severityConfig[analysis.severity as keyof typeof severityConfig].icon : Info;

  const copyLogMessage = () => {
    navigator.clipboard.writeText(log.message);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIcon className={cn('h-5 w-5', logLevelConfig[log.level].color)} />
            Log Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Log Information */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={cn(logLevelConfig[log.level].color)}>
                {log.level.toUpperCase()}
              </Badge>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatTimestamp(log.timestamp)}
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg font-mono text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="flex-1">{log.message}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyLogMessage}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              {log.source && (
                <div className="text-xs text-muted-foreground mt-2">
                  Source: {log.source}
                </div>
              )}
            </div>
          </div>

          {/* Error Analysis */}
          {analysis ? (
            <div className={cn('p-4 rounded-lg', severityConfig[analysis.severity as keyof typeof severityConfig].bgColor)}>
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <SeverityIcon className="h-5 w-5" />
                    <div>
                      <h3 className="font-semibold text-foreground">{analysis.type}</h3>
                      <p className="text-sm text-muted-foreground">{analysis.category}</p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn(severityConfig[analysis.severity as keyof typeof severityConfig].color)}
                  >
                    {analysis.severity} severity
                  </Badge>
                </div>

                {/* Reason */}
                <div>
                  <h4 className="font-medium text-foreground mb-2">Why this happened:</h4>
                  <p className="text-sm text-muted-foreground">{analysis.reason}</p>
                </div>

                {/* Impact */}
                <div>
                  <h4 className="font-medium text-foreground mb-2">Impact:</h4>
                  <p className="text-sm text-muted-foreground">{analysis.impact}</p>
                </div>

                {/* Solutions */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">How to fix:</h4>
                  </div>
                  <ul className="space-y-2">
                    {analysis.solutions.map((solution, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-1 text-xs">•</span>
                        <span>{solution}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Prevention */}
                <div className="pt-3 border-t border-border/50">
                  <h4 className="font-medium text-foreground mb-2">Prevention:</h4>
                  <p className="text-sm text-muted-foreground">{analysis.prevention}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-muted/20 rounded-lg text-center">
              <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <h4 className="font-medium text-foreground mb-1">No Analysis Available</h4>
              <p className="text-sm text-muted-foreground">
                This log entry appears to be informational and doesn't require specific analysis.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}