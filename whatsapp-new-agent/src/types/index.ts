import { Message, Chat, Contact } from 'whatsapp-web.js';

export interface WhatsAppAgentConfig {
  sessionName?: string;
  headless?: boolean;
  debug?: boolean;
  puppeteerArgs?: string[];
}

export interface MessageHandler {
  (message: Message): Promise<void>;
}

export interface ChatHandler {
  (chat: Chat): Promise<void>;
}

export interface ContactHandler {
  (contact: Contact): Promise<void>;
}

export interface WhatsAppAgentEvents {
  'qr': (qr: string) => void;
  'ready': () => void;
  'authenticated': () => void;
  'auth_failure': (msg: string) => void;
  'message': (message: Message) => void;
  'message_create': (message: Message) => void;
  'message_revoke_everyone': (message: Message) => void;
  'message_revoke_me': (message: Message) => void;
  'message_ack': (message: Message, ack: number) => void;
  'group_join': (notification: any) => void;
  'group_leave': (notification: any) => void;
  'group_update': (notification: any) => void;
  'change_state': (state: string) => void;
  'disconnected': (reason: string) => void;
  'loading_screen': (percent: string, message: string) => void;
}

export interface SendMessageOptions {
  quotedMessageId?: string;
  mentions?: string[];
  sendSeen?: boolean;
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

export interface ContactInfo {
  id: string;
  name: string;
  number: string;
  isBusiness: boolean;
  isMyContact: boolean;
  profilePicUrl?: string;
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

export interface AgentStatus {
  isReady: boolean;
  isAuthenticated: boolean;
  isConnected: boolean;
  sessionName: string;
  startTime?: Date;
  lastActivity?: Date;
}

export interface ErrorInfo {
  code: string;
  message: string;
  timestamp: Date;
  context?: any;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: any;
}
