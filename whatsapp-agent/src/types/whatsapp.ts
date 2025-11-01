export interface UserInfo {
  phone: string;
  name: string;
}

export interface WhatsAppMessage {
  id: string;
  rowId?: number;
  viewed?: boolean;
  body: string;
  type?: string;
  t?: number;
  from: string;
  to?: string;
  ack?: number;
  invis?: boolean;
  star?: boolean;
  kicNotified?: boolean;
  streamingSidecar?: any;
  waveform?: any;
  scanLengths?: any;
  scansSidecar?: any;
  isFromTemplate?: boolean;
  pollOptions?: any[];
  pollInvalidated?: boolean;
  pollVotesSnapshot?: { pollVotes: any[] };
  latestEditMsgKey?: any;
  latestEditSenderTimestampMs?: any;
  broadcast?: boolean;
  mentionedJidList?: any[];
  groupMentions?: any[];
  hydratedButtons?: any;
  eventInvalidated?: boolean;
  isVcardOverMmsDocument?: boolean;
  isForwarded?: boolean;
  isQuestion?: boolean;
  labels?: any[];
  hasReaction?: boolean;
  viewMode?: string;
  messageSecret?: { [key: string]: number };
  productHeaderImageRejected?: boolean;
  lastPlaybackProgress?: number;
  isDynamicReplyButtonsMsg?: boolean;
  dynamicReplyButtons?: any;
  isCarouselCard?: boolean;
  parentMsgId?: any;
  callSilenceReason?: any;
  isVideoCall?: boolean;
  callDuration?: any;
  callCreator?: any;
  callParticipants?: any;
  isCallLink?: any;
  callLinkToken?: any;
  isMdHistoryMsg?: boolean;
  stickerSentTs?: number;
  isAvatar?: boolean;
  lastUpdateFromServerTs?: number;
  invokedBotWid?: any;
  botTargetSenderJid?: any;
  bizBotType?: any;
  botResponseTargetId?: any;
  botPluginType?: any;
  botPluginReferenceIndex?: any;
  botPluginSearchProvider?: any;
  botPluginSearchUrl?: any;
  botPluginSearchQuery?: any;
  botPluginMaybeParent?: boolean;
  botReelPluginThumbnailCdnUrl?: any;
  botMessageDisclaimerText?: any;
  botMsgBodyType?: any;
  requiresDirectConnection?: boolean;
  bizContentPlaceholderType?: any;
  hostedBizEncStateMismatch?: boolean;
  senderOrRecipientAccountTypeHosted?: boolean;
  placeholderCreatedWhenAccountIsHosted?: boolean;
  galaxyFlowDisabled?: boolean;
  chatId?: {
    server: string;
    user: string;
    _serialized: string;
  };
  fromMe?: boolean;
  sender?: {
    id: {
      server: string;
      user: string;
      _serialized: string;
    };
    name?: string;
    shortName?: string;
    pushname?: string;
    type?: string;
    labels?: any[];
    isContactSyncCompleted?: number;
    textStatusLastUpdateTime?: number;
    syncToAddressbook?: boolean;
    isUser?: boolean;
    profilePicThumbObj?: any;
    msgs?: any;
  };
  timestamp: number;
  content?: string;
  chat?: any;
  mediaData?: any;
  replyButtons?: any;
  buttons?: any;
  isGroupMsg: boolean;
  groupInfo?: any;
  reply?: any;
  notifyName?: string;
}

export interface ConnectionStatus {
  status: string;
  session?: string;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  status?: string;
  error?: string;
  message?: string;
}

export interface WhatsAppSession {
  isLoggedIn: boolean;
  lastAnalyzedMessageDate?: Date;
  lastProcessedMessageId?: string;
  activeListeningGroups?: string[];
}

export interface MessageAnalysis {
  not_real_estate?: string;
  error?: string;
  [key: string]: any;
} 