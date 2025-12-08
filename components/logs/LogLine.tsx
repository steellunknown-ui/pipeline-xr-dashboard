import { memo } from 'react';
import { cn } from '@/lib/utils';
import { LogMessage } from '@/lib/ws-client';

interface LogLineProps {
  log: LogMessage;
  className?: string;
  onClick?: (log: LogMessage) => void;
}

const logLevelStyles = {
  info: 'text-blue-600 dark:text-blue-400',
  warn: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-600 dark:text-red-400',
  debug: 'text-gray-600 dark:text-gray-400',
};

const logLevelBg = {
  info: 'bg-blue-50 dark:bg-blue-950/20 border-l-blue-500',
  warn: 'bg-yellow-50 dark:bg-yellow-950/20 border-l-yellow-500',
  error: 'bg-red-50 dark:bg-red-950/20 border-l-red-500',
  debug: 'bg-gray-50 dark:bg-gray-950/20 border-l-gray-500',
};

export const LogLine = memo(({ log, className, onClick }: LogLineProps) => {
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 border-l-2 font-mono text-sm transition-all cursor-pointer',
        'hover:bg-muted/70 hover:shadow-sm hover:scale-[1.01] active:scale-[0.99]',
        logLevelBg[log.level],
        className
      )}
      onClick={() => onClick?.(log)}
      title="Click to view detailed analysis"
    >
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground">
          {formatTimestamp(log.timestamp)}
        </span>
        <span
          className={cn(
            'text-xs font-semibold uppercase px-1.5 py-0.5 rounded',
            logLevelStyles[log.level]
          )}
        >
          {log.level}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <pre className="whitespace-pre-wrap break-words text-foreground">
          {log.message}
        </pre>
        {log.source && (
          <div className="text-xs text-muted-foreground mt-1">
            Source: {log.source}
          </div>
        )}
      </div>
    </div>
  );
});

LogLine.displayName = 'LogLine';