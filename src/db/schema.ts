import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'opponent_goal' | 'save' | 'yellow_card' | 'chance';
  playerName: string;
  detail: string;
}

export interface PlayerSnapshot {
  id: number;
  squadId: number;
  squadName: string;
  squadSeason: string;
  squadCrestUrl: string | null;
  fullName: string;
  nickname: string;
  shirtNumber: number;
  primaryPosition: string;
  secondaryPositions: string[];
  rating: number;
  isLegendary: boolean;
  photoUrl: string | null;
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const squads = pgTable('squads', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  season: text('season').notNull().default(''),
  country: text('country').notNull().default(''),
  competition: text('competition'),
  crestUrl: text('crest_url'),
  isExample: boolean('is_example').notNull().default(false),
  isFinalOnly: boolean('is_final_only').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const players = pgTable('players', {
  id: serial('id').primaryKey(),
  squadId: integer('squad_id')
    .references(() => squads.id, { onDelete: 'cascade' })
    .notNull(),
  fullName: text('full_name').notNull(),
  nickname: text('nickname').notNull(),
  shirtNumber: integer('shirt_number').notNull().default(10),
  primaryPosition: text('primary_position').notNull(),
  secondaryPositions: jsonb('secondary_positions')
    .$type<string[]>()
    .notNull()
    .default([]),
  rating: integer('rating').notNull(),
  isLegendary: boolean('is_legendary').notNull().default(false),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const campaigns = pgTable('campaigns', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  guestToken: text('guest_token'),
  coachName: text('coach_name').notNull().default('Treinador'),
  formation: text('formation').notNull(),
  style: text('style').notNull(),
  difficulty: text('difficulty').notNull(),
  status: text('status').notNull().default('drafting'),
  skipsRemaining: integer('skips_remaining').notNull().default(3),
  currentSquadId: integer('current_squad_id'),
  drawnSquadIds: jsonb('drawn_squad_ids').$type<number[]>().notNull().default([]),
  avgRating: integer('avg_rating').notNull().default(0),
  wins: integer('wins').notNull().default(0),
  draws: integer('draws').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  goalsFor: integer('goals_for').notNull().default(0),
  goalsAgainst: integer('goals_against').notNull().default(0),
  isChampion: boolean('is_champion').notNull().default(false),
  isPerfectSevenZero: boolean('is_perfect_seven_zero').notNull().default(false),
  shareCode: text('share_code').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const lineups = pgTable('lineups', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .references(() => campaigns.id, { onDelete: 'cascade' })
    .notNull(),
  slotIndex: integer('slot_index').notNull(),
  slotPosition: text('slot_position').notNull(),
  slotLabel: text('slot_label').notNull(),
  playerId: integer('player_id').references(() => players.id, {
    onDelete: 'set null',
  }),
  playerSnapshot: jsonb('player_snapshot').$type<PlayerSnapshot | null>(),
  pickedAt: timestamp('picked_at').defaultNow(),
});

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .references(() => campaigns.id, { onDelete: 'cascade' })
    .notNull(),
  matchOrder: integer('match_order').notNull(),
  stage: text('stage').notNull(),
  opponentName: text('opponent_name').notNull(),
  opponentCrestUrl: text('opponent_crest_url'),
  opponentStrength: integer('opponent_strength').notNull(),
  homeScore: integer('home_score').notNull(),
  awayScore: integer('away_score').notNull(),
  penaltyNote: text('penalty_note'),
  events: jsonb('events').$type<MatchEvent[]>().notNull().default([]),
  playedAt: timestamp('played_at').defaultNow().notNull(),
});

export const achievements = pgTable('achievements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  guestToken: text('guest_token'),
  campaignId: integer('campaign_id').references(() => campaigns.id, {
    onDelete: 'set null',
  }),
  code: text('code').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
});

export interface CreditEntry {
  id: string;
  role: string;
  name: string;
  description: string;
  linkLabel?: string;
  linkUrl?: string;
}

export const siteCredits = pgTable('site_credits', {
  id: serial('id').primaryKey(),
  title: text('title').notNull().default('Créditos & Agradecimentos'),
  subtitle: text('subtitle').notNull().default(''),
  intro: text('intro').notNull().default(''),
  entries: jsonb('entries').$type<CreditEntry[]>().notNull().default([]),
  footerNote: text('footer_note').notNull().default(''),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  campaigns: many(campaigns),
  achievements: many(achievements),
}));

export const squadsRelations = relations(squads, ({ many }) => ({
  players: many(players),
}));

export const playersRelations = relations(players, ({ one }) => ({
  squad: one(squads, {
    fields: [players.squadId],
    references: [squads.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, {
    fields: [campaigns.userId],
    references: [users.id],
  }),
  lineups: many(lineups),
  matches: many(matches),
}));

export const lineupsRelations = relations(lineups, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [lineups.campaignId],
    references: [campaigns.id],
  }),
  player: one(players, {
    fields: [lineups.playerId],
    references: [players.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [matches.campaignId],
    references: [campaigns.id],
  }),
}));
