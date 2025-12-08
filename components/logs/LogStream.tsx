'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogLine } from './LogLine';
import { LogDetailsModal } from './LogDetailsModal';
import { WSClient, LogMessage } from '@/lib/ws-client';
import { 
  Loader2, 
  Wifi, 
  WifiOff, 
  Pause, 
  Play, 
  Download,
  AlertCircle,
  FileText,
  Square
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogStreamProps {
  deploymentId: string;
  wsUrl?: string;
  className?: string;
  onLogsUpdate?: (logs: string[]) => void;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function LogStream({ deploymentId, wsUrl, className, onLogsUpdate }: LogStreamProps) {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeploymentComplete, setIsDeploymentComplete] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogMessage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const wsClientRef = useRef<WSClient | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const isNearBottom = useCallback(() => {
    if (!scrollAreaRef.current) return false;
    const container = scrollAreaRef.current;
    return container.scrollTop >= container.scrollHeight - container.clientHeight - 50;
  }, []);

  const handleNewLog = useCallback((message: LogMessage) => {
    if (isStopped) return;
    
    setLogs(prev => {
      const newLogs = [...prev, message];
      // Pass log messages to parent for AI analysis
      onLogsUpdate?.(newLogs.map(log => log.message));
      return newLogs;
    });
    
    // Check if deployment is complete
    if (message.message.includes('Deployment completed successfully!')) {
      setIsDeploymentComplete(true);
      wsClientRef.current?.setShouldReconnect(false);
    }
  }, [onLogsUpdate, isStopped]);

  const handleConnect = useCallback(() => {
    setConnectionStatus('connected');
    setError(null);
    setIsLoading(false);
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnectionStatus('disconnected');
    setIsLoading(false);
    
    // If deployment is complete, don't try to reconnect
    if (isDeploymentComplete) {
      wsClientRef.current?.setShouldReconnect(false);
    }
  }, [isDeploymentComplete]);

  const handleError = useCallback((error: Event) => {
    setConnectionStatus('error');
    setError('Connection failed. Retrying...');
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Real WebSocket URL
    const realWsUrl = wsUrl || `ws://localhost:3001/logs/${deploymentId}`;
    
    wsClientRef.current = new WSClient({
      url: realWsUrl,
      onMessage: handleNewLog,
      onConnect: handleConnect,
      onDisconnect: handleDisconnect,
      onError: handleError,
    });

    setIsLoading(true);
    setConnectionStatus('connecting');
    
    // Connect to real WebSocket
    wsClientRef.current.connect();

    return () => {
      wsClientRef.current?.disconnect();
    };
  }, [deploymentId, wsUrl, handleNewLog, handleConnect, handleDisconnect, handleError]);

  useEffect(() => {
    // Only scroll to bottom if autoScroll is true AND user is near bottom
    if (autoScroll && isNearBottom()) {
      scrollToBottom();
    }
  }, [logs, autoScroll, scrollToBottom, isNearBottom]);

  // Handle manual scroll detection
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const userScrolledUp = container.scrollTop < container.scrollHeight - container.clientHeight - 50;
    
    // Turn off auto-scroll if user scrolled up
    if (userScrolledUp && autoScroll) {
      setAutoScroll(false);
    }
  }, [autoScroll]);

  const toggleAutoScroll = () => {
    const newAutoScroll = !autoScroll;
    setAutoScroll(newAutoScroll);
    
    if (newAutoScroll) {
      // Instantly jump to bottom when enabling auto-scroll
      setTimeout(() => {
        if (bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: 'auto' }); // Instant scroll
        }
      }, 0);
    }
  };

  const stopLogs = () => {
    setIsStopped(true);
    setAutoScroll(false);
    wsClientRef.current?.disconnect();
    setConnectionStatus('disconnected');
  };

  const resumeLogs = () => {
    setIsStopped(false);
    setAutoScroll(true);
    setIsDeploymentComplete(false);
    
    // Create new WebSocket connection
    const realWsUrl = wsUrl || `ws://localhost:3001/logs/${deploymentId}`;
    
    wsClientRef.current = new WSClient({
      url: realWsUrl,
      onMessage: handleNewLog,
      onConnect: handleConnect,
      onDisconnect: handleDisconnect,
      onError: handleError,
    });

    setIsLoading(true);
    setConnectionStatus('connecting');
    wsClientRef.current.connect();
  };

  const handleLogClick = (log: LogMessage) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedLog(null);
  };

  const downloadLogs = () => {
    const logText = logs
      .map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`)
      .join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${deploymentId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connecting':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'connected':
        return <Wifi className="h-4 w-4" />;
      case 'disconnected':
      case 'error':
        return <WifiOff className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'connected':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'disconnected':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    }
  };

  if (isLoading && logs.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-96 space-y-4', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Connecting to log stream...</p>
      </div>
    );
  }

  if (error && logs.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-96 space-y-4', className)}>
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Button 
          variant="outline" 
          onClick={() => wsClientRef.current?.connect()}
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  if (logs.length === 0 && connectionStatus === 'connected') {
    return (
      <div className={cn('flex flex-col items-center justify-center h-96 space-y-4', className)}>
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">No logs available yet</p>
        <p className="text-sm text-muted-foreground">Logs will appear here as they are generated</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={cn('gap-1', getStatusColor())}>
            {getStatusIcon()}
            {connectionStatus}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {logs.length} log{logs.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {!isStopped && !isDeploymentComplete && connectionStatus === 'connected' && (
            <Button
              variant="outline"
              size="sm"
              onClick={stopLogs}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Square className="h-4 w-4" />
              Stop Logs
            </Button>
          )}
          
          {isStopped && !isDeploymentComplete && (
            <Button
              variant="outline"
              size="sm"
              onClick={resumeLogs}
              className="text-green-600 border-green-200 hover:bg-green-50"
            >
              <Play className="h-4 w-4" />
              Resume Logs
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAutoScroll}
            className={cn(
              autoScroll && 'bg-primary/10 text-primary border-primary/20'
            )}
            disabled={isStopped}
          >
            {autoScroll ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            Auto-scroll
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={downloadLogs}
            disabled={logs.length === 0}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </div>

      {/* Logs Container */}
      <div 
        className="flex-1 overflow-y-auto" 
        ref={scrollAreaRef}
        onScroll={handleScroll}
      >
        <div className="space-y-1 p-1">
          {logs.map((log) => (
            <LogLine 
              key={log.id} 
              log={log} 
              onClick={handleLogClick}
            />
          ))}
          <div ref={bottomRef} />
          
          {/* Completion Message */}
          {isDeploymentComplete && (
            <div className="p-4 text-center border-t border-border/50 bg-green-50 dark:bg-green-950/20">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                ✅ Deployment pipeline completed successfully
              </p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                Connection closed automatically
              </p>
            </div>
          )}
          
          {/* Stopped Message */}
          {isStopped && !isDeploymentComplete && (
            <div className="p-4 text-center border-t border-border/50 bg-yellow-50 dark:bg-yellow-950/20">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                ⏸️ Log streaming paused
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                Click "Resume Logs" to continue streaming
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Log Details Modal */}
      <LogDetailsModal 
        log={selectedLog}
        isOpen={isModalOpen}
        onClose={closeModal}
      />
    </div>
  );
}