export interface LogMessage {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

export interface WSClientOptions {
  url: string;
  onMessage: (message: LogMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class WSClient {
  private ws: WebSocket | null = null;
  private options: WSClientOptions;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private shouldReconnect = true;
  private isManuallyDisconnected = false;

  constructor(options: WSClientOptions) {
    this.options = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      ...options,
    };
  }

  connect(): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.options.url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.options.onConnect?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: LogMessage = JSON.parse(event.data);
          this.options.onMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.options.onDisconnect?.();
        
        // Don't reconnect if:
        // 1. Manually disconnected
        // 2. Server closed gracefully (code 1000)
        // 3. shouldReconnect is false
        if (!this.isManuallyDisconnected && event.code !== 1000 && this.shouldReconnect) {
          this.handleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        this.isConnecting = false;
        this.options.onError?.(error);
      };
    } catch (error) {
      this.isConnecting = false;
      console.error('Failed to create WebSocket connection:', error);
    }
  }

  disconnect(): void {
    this.isManuallyDisconnected = true;
    this.shouldReconnect = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  private handleReconnect(): void {
    if (
      this.shouldReconnect &&
      !this.isManuallyDisconnected &&
      this.reconnectAttempts < (this.options.maxReconnectAttempts || 5) &&
      !this.isConnecting
    ) {
      this.reconnectAttempts++;
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, this.options.reconnectInterval);
    }
  }

  getConnectionState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  setShouldReconnect(shouldReconnect: boolean): void {
    this.shouldReconnect = shouldReconnect;
  }

  isDisconnectedPermanently(): boolean {
    return this.isManuallyDisconnected || !this.shouldReconnect;
  }
}