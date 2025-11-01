export interface WebSocketMessage {
  type: string;
  data?: any;
  error?: string;
  status?: string;
  message?: string;
}

export interface ConnectionStatus {
  whatsappConnected: boolean;
  connectionStatus: string;
}

export interface LoginStatus {
  isLoggedIn: boolean;
  connectionStatus: string;
}

export interface HealthResponse {
  status: string;
  whatsappConnected: boolean;
  connectionStatus: string;
}

export interface ChatInfo {
  id: string;
  name: string;
  isGroup: boolean;
  participants?: string[];
  unreadCount: number;
  lastMessage?: {
    body: string;
    timestamp: number;
  };
}

export interface MessageInfo {
  id: string;
  body: string;
  from: string;
  to: string;
  timestamp: number;
  type: string;
  isGroup: boolean;
  quotedMessage?: {
    id: string;
    body: string;
  };
}

export interface WhatsAppNumberResponse {
  number: string;
}

export interface WhatsAppNumbersResponse {
  numbers: string[];
  count: number;
}

export interface ChatMessagesResponse {
  messages: MessageInfo[];
}

export interface ApiKeysResponse {
  googleSheetId: string;
  openaiKey: string;
}
