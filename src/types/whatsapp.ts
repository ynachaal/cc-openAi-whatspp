interface WhatsAppId {
  server: string;
  user: string;
  _serialized: string;
}

interface LastReceivedKey {
  fromMe: boolean;
  remote: WhatsAppId;
  id: string;
  _serialized: string;
}

interface ChatlistPreview {
  type: string;
  msgKey: string;
  parentMsgKey: string;
  reactionText: string;
  sender: string;
  timestamp: number;
}

interface LimitSharing {
  trigger: number;
}

interface ProfilePicThumb {
  eurl: string;
  id: WhatsAppId;
  img: string;
  imgFull: string;
  tag: string;
}

interface Contact {
  id: WhatsAppId;
  name: string;
  shortName: string;
  pushname: string;
  type: string;
  verifiedName?: string;
  isBusiness?: boolean;
  isEnterprise?: boolean;
  verifiedLevel?: number;
  privacyMode?: string | null;
  labels: string[];
  isContactSyncCompleted: number;
  textStatusLastUpdateTime: number;
  syncToAddressbook: boolean;
  isUser: boolean;
  profilePicThumbObj: ProfilePicThumb;
  msgs: null;
}

interface Presence {
  id: WhatsAppId;
  chatstates: any[];
}

interface GroupParticipant {
  id: WhatsAppId;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface PastParticipant {
  id: WhatsAppId;
  leaveTs: number;
  leaveReason: string;
}

export interface GroupMetadata {
  id: WhatsAppId;
  creation: number;
  owner: WhatsAppId;
  subject: string;
  subjectTime: number;
  desc: string;
  descId: string;
  descTime: number;
  descOwner: WhatsAppId;
  restrict: boolean;
  announce: boolean;
  noFrequentlyForwarded: boolean;
  ephemeralDuration: number;
  disappearingModeTrigger: string;
  membershipApprovalMode: boolean;
  memberAddMode: string;
  reportToAdminMode: boolean;
  size: number;
  support: boolean;
  suspended: boolean;
  terminated: boolean;
  uniqueShortNameMap: Record<string, any>;
  isLidAddressingMode: boolean;
  isParentGroup: boolean;
  isParentGroupClosed: boolean;
  defaultSubgroup: boolean;
  generalSubgroup: boolean;
  groupSafetyCheck: boolean;
  generalChatAutoAddDisabled: boolean;
  allowNonAdminSubGroupCreation: boolean;
  lastActivityTimestamp: number;
  lastSeenActivityTimestamp: number;
  incognito: boolean;
  hasCapi: boolean;
  participants: GroupParticipant[];
  pendingParticipants: any[];
  pastParticipants: PastParticipant[];
  membershipApprovalRequests: any[];
  subgroupSuggestions: any[];
}

export interface WhatsAppChat {
  id: WhatsAppId;
  pendingMsgs: boolean;
  labels: string[];
  lastReceivedKey: LastReceivedKey;
  t: number;
  unreadCount: number;
  unreadDividerOffset: number;
  archive: boolean;
  isReadOnly: boolean;
  isLocked: boolean;
  muteExpiration: number;
  isAutoMuted: boolean;
  name: string;
  notSpam: boolean;
  ephemeralDuration: number;
  ephemeralSettingTimestamp: number;
  disappearingModeInitiator: string;
  disappearingModeTrigger: string;
  unreadMentionCount: number;
  hasUnreadMention: boolean;
  archiveAtMentionViewedInDrawer: boolean;
  hasChatBeenOpened: boolean;
  tcToken: null;
  tcTokenTimestamp: number;
  tcTokenSenderTimestamp: number;
  endOfHistoryTransferType: number;
  pendingInitialLoading: boolean;
  chatlistPreview: ChatlistPreview;
  celebrationAnimationLastPlayed: number;
  hasRequestedWelcomeMsg: boolean;
  limitSharing: LimitSharing;
  msgs: null;
  contact: Contact;
  groupMetadata: GroupMetadata | null;
  presence: Presence;
  isOnline: null;
  lastSeen: null;
} 