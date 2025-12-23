
export interface UserProfile {
  clientId: string;
  username: string;
  avatarBase64: string | null;
  avatarColor?: string; // Hex color for random avatars
  vipCode?: string; // Added for VIP effects
}

export interface BrokerConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  path: string;
}

// Internal type for tracking activity
export interface OnlineUser extends UserProfile {
  lastSeen: number;
}

export type MessageType = 'text' | 'image' | 'mixed' | 'system';

export interface Reaction {
  emoji: string;
  fromClientId: string;
  fromUsername: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string; // Text content
  senderId: string; // Ref to UserProfile
  senderUsername: string; // Fallback username
  // senderAvatar is optional in message payload to save bandwidth, resolved via presence cache
  senderAvatar?: string | null; 
  timestamp: number;
  replyToId?: string;
  replyToSummary?: {
    username: string;
    content: string;
  };
  imageUrl?: string; // Base64
  reactions: Record<string, Reaction[]>; // Key is emoji
}

export interface RoomConfig {
  isPublic: boolean;
  topicName: string;
  createdBy: string;
  createdAt: number;
}

export interface RoomInfo {
  id: string;
  topicName: string;
  isPublic: boolean;
  onlineCount: number;
  lastActivity: number;
  isCustom?: boolean;
  customBroker?: BrokerConfig;
}

export interface PresencePayload {
  type: 'join' | 'leave' | 'heartbeat';
  user: UserProfile;
  roomId: string;
}

export interface PublicRoomPayload {
  roomId: string;
  topicName: string;
  userCount: number;
}

export interface VotePayload {
  type: 'proposal' | 'ballot';
  voteId: string;
  action: 'toggle_privacy';
  targetState?: boolean; // For proposal
  voterId?: string; // For ballot
  decision?: 'agree' | 'veto'; // For ballot
  initiatorId?: string;
  timestamp?: number; // Added for timeout logic
}
