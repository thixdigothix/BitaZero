import { MatchEvent, PlayerSnapshot } from '../db/schema.ts';

export interface AuthUser {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'user';
}

export interface Squad {
  id: number;
  name: string;
  season: string;
  country: string;
  competition: string | null;
  crestUrl: string | null;
  isExample: boolean;
  isFinalOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Player {
  id: number;
  squadId: number;
  fullName: string;
  nickname: string;
  shirtNumber: number;
  primaryPosition: string;
  secondaryPositions: string[];
  rating: number | null;
  isLegendary: boolean;
  photoUrl: string | null;
}

export interface SquadWithPlayers extends Squad {
  players: Player[];
}

export interface LineupSlot {
  id: number;
  campaignId: number;
  slotIndex: number;
  slotPosition: string;
  slotLabel: string;
  playerId: number | null;
  playerSnapshot: PlayerSnapshot | null;
}

export interface CampaignMatch {
  id: number;
  campaignId: number;
  matchOrder: number;
  stage: string;
  opponentName: string;
  opponentCrestUrl: string | null;
  opponentStrength: number;
  homeScore: number;
  awayScore: number;
  penaltyNote: string | null;
  events: MatchEvent[];
  playedAt: string;
}

export interface Campaign {
  id: number;
  userId: number | null;
  guestToken: string | null;
  coachName: string;
  formation: string;
  style: 'ofensivo' | 'equilibrado' | 'defensivo';
  difficulty: 'classico' | 'almanaque';
  status: 'drafting' | 'ready' | 'simulating' | 'completed';
  skipsRemaining: number;
  currentSquadId: number | null;
  drawnSquadIds: number[];
  avgRating: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  isChampion: boolean;
  isPerfectSevenZero: boolean;
  shareCode: string;
  createdAt: string;
  completedAt: string | null;
}

export interface UnlockedAchievement {
  id: number;
  campaignId: number | null;
  code: string;
  title: string;
  description: string;
  unlockedAt: string;
}

export interface FinalBossBreakdown {
  overall: number;
  attack: number;
  midfield: number;
  defense: number;
  goalkeeper: number;
  legendaryCount: number;
}

export interface FinalBossReveal {
  id: number;
  name: string;
  serie: string | null;
  crestUrl: string | null;
  formation: string;
  breakdown: FinalBossBreakdown;
  lineup: LineupSlot[];
  reservesCount: number;
}

export interface BonusMatchResult {
  opponentName: string;
  opponentCrestUrl: string | null;
  opponentStrength: number;
  homeScore: number;
  awayScore: number;
  events: import('../db/schema.ts').MatchEvent[];
}

export interface CampaignPayload {
  campaign: Campaign;
  lineup: LineupSlot[];
  matches: CampaignMatch[];
  achievements: UnlockedAchievement[];
  currentSquad: SquadWithPlayers | null;
  finalBoss?: FinalBossReveal | null;
  userBreakdown?: FinalBossBreakdown | null;
}
