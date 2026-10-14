export interface UserStats {
  gamesPlayed: number;
  wins: number;
  losses?: number;
  draws?: number;
  winRate?: number;
  totalScore: number;
  highestScore: number;
  correctGuesses: number;
  drawingTurns?: number;
  currentStreak?: number;
  bestStreak?: number;
}

export interface NotificationPreferences {
  productUpdates: boolean;
  gameInvites: boolean;
  emailNotifications: boolean;
}

export interface User {
  _id: string;
  username: string;
  normalizedUsername: string;
  displayName: string;
  email: string;
  avatar: string;
  bio: string;
  preferredLanguage: string;
  theme: 'light' | 'dark' | 'system';
  role?: 'user' | 'moderator' | 'admin';
  notificationPreferences: NotificationPreferences;
  profileVisibility: 'public' | 'friends_only' | 'private';
  isOnboarded: boolean;
  isEmailVerified: boolean;
  status: 'active' | 'suspended';
  suspendedUntil?: string;
  blockedUserIds?: string[];
  lastLoginAt?: string;
  stats: UserStats;
  createdAt: string;
  updatedAt: string;
}

export interface MatchPlayer {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  score: number;
  rank: number;
  correctGuesses: number;
  drawingTurns: number;
}

export interface MatchResultRecord {
  _id: string;
  gameId: string;
  roomCode: string;
  rounds: number;
  category: string;
  players: MatchPlayer[];
  winner: {
    userId: string;
    displayName: string;
    score: number;
  };
  startedAt: string;
  completedAt: string;
  status: 'completed' | 'cancelled';
  createdAt: string;
}

export interface FriendUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  isOnline: boolean;
  friendshipId: string;
  stats: {
    gamesPlayed: number;
    wins: number;
    totalScore: number;
  };
}

export interface PendingFriendRequest {
  requestId: string;
  sender?: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
  };
  recipient?: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
  };
  createdAt: string;
}

export interface NotificationItem {
  _id?: string;
  id?: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export interface AchievementItem {
  id: string;
  name: string;
  description: string;
  category: 'milestone' | 'victory' | 'skill';
  icon: string;
  target?: number;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  value: number;
  gamesPlayed: number;
  wins: number;
  totalScore: number;
  winRate: number;
}

export interface ReportItem {
  _id: string;
  reporterId: string;
  targetType: 'user' | 'match' | 'room';
  targetId: string;
  category: string;
  explanation: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  moderatorNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface AuditLogItem {
  _id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

export interface AvatarPreset {
  id: string;
  name: string;
  bgGradient: string;
  primaryColor: string;
  accessory: string;
}

export interface RoomSettings {
  maxPlayers: number;
  rounds: number;
  drawTimeSeconds: number;
  wordCount: number;
  hints: number;
  wordMode: 'normal' | 'hidden' | 'combination';
  category: string;
  gameMode?: 'classic' | 'imposter';
  spectatorsAllowed?: boolean;
  maxSpectators?: number;
  allowLateSpectators?: boolean;
  wordLanguage?: 'en' | 'hi' | 'es';
  wordSource?: 'builtin' | 'custom' | 'both';
  customWordPackId?: string | null;
}

export interface RoomPlayer {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  isDisconnected: boolean;
  joinedAt: string;
}

export interface RoomSpectator {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  joinedAt: string;
}

export interface RoomSnapshot {
  roomId: string;
  roomCode: string;
  name: string;
  visibility: 'public' | 'private';
  hostId: string;
  status: 'waiting' | 'starting' | 'in_game' | 'closed';
  settings: RoomSettings;
  players: RoomPlayer[];
  spectators?: RoomSpectator[];
  currentPlayersCount: number;
  maxPlayers: number;
  currentSpectatorsCount?: number;
  maxSpectators?: number;
  spectatorsAllowed?: boolean;
  isLobbyReadyToStart: boolean;
  createdAt: string;
}

export interface PublicRoomSummary {
  roomCode: string;
  name: string;
  currentPlayersCount: number;
  maxPlayers: number;
  currentSpectatorsCount?: number;
  maxSpectators?: number;
  spectatorsAllowed?: boolean;
  wordLanguage?: string;
  wordMode?: string;
  rounds: number;
  drawTimeSeconds: number;
  status: string;
  createdAt: string;
}

export interface CustomWordPack {
  _id: string;
  ownerId: string | { _id: string; displayName: string; username: string; avatar?: string };
  name: string;
  description: string;
  language: 'en' | 'hi' | 'es';
  category: string;
  words: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReplayEvent {
  type: 'stroke_start' | 'stroke_points' | 'stroke_end' | 'stroke_undo' | 'stroke_clear';
  offsetMs: number;
  data: any;
}

export interface DrawingReplay {
  _id: string;
  gameId: string;
  roomCode: string;
  roundNumber: number;
  drawerId: string;
  drawerDisplayName: string;
  secretWord: string;
  category: string;
  language: string;
  durationMs: number;
  events: ReplayEvent[];
  createdAt: string;
}

