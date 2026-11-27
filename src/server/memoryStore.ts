import crypto from 'crypto';
import type { CreditEntry, MatchEvent, PlayerSnapshot } from '../db/schema.ts';
import type { DbUser } from '../middleware/auth.ts';
import {
  getFormation,
  isPlayerCompatibleWithSlot,
  normalizeNickname,
  type PlayStyle,
} from '../shared/gameLogic.ts';
import { OFFICIAL_SQUADS } from './officialSquads.ts';
import {
  buildOpponentBestXI,
  computeTeamStrength,
  evaluateCampaignAchievements,
  simulateSingleMatch,
} from './simulator.ts';

export interface MemSquad {
  id: number;
  name: string;
  season: string;
  country: string;
  competition: string | null;
  crestUrl: string | null;
  isExample: boolean;
  isFinalOnly: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemPlayer {
  id: number;
  squadId: number;
  fullName: string;
  nickname: string;
  shirtNumber: number;
  primaryPosition: string;
  secondaryPositions: string[];
  rating: number;
  isLegendary: boolean;
  photoUrl: string | null;
  createdAt: Date;
}

export interface MemCampaign {
  id: number;
  userId: number | null;
  guestToken: string | null;
  coachName: string;
  formation: string;
  style: string;
  difficulty: string;
  status: string;
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
  createdAt: Date;
  completedAt: Date | null;
}

export interface MemLineupSlot {
  id: number;
  campaignId: number;
  slotIndex: number;
  slotPosition: string;
  slotLabel: string;
  playerId: number | null;
  playerSnapshot: PlayerSnapshot | null;
  pickedAt: Date | null;
}

export interface MemMatch {
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
  playedAt: Date;
}

export interface MemAchievement {
  id: number;
  userId: number | null;
  guestToken: string | null;
  campaignId: number | null;
  code: string;
  title: string;
  description: string;
  unlockedAt: Date;
}

export interface MemCredits {
  id: number;
  title: string;
  subtitle: string;
  intro: string;
  entries: CreditEntry[];
  footerNote: string;
  updatedBy: string | null;
  updatedAt: Date;
}

const OWNER_ADMIN_EMAILS = new Set(
  [
    'thixdigosemgamer@gmail.com',
    ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : []),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

const POSITION_SORT_ORDER: Record<string, number> = {
  GOL: 0,
  DEF: 1,
  MEI: 2,
  ATQ: 3,
};

function comparePlayers(
  a: { primaryPosition: string; nickname: string; fullName: string },
  b: { primaryPosition: string; nickname: string; fullName: string }
) {
  const pa = POSITION_SORT_ORDER[a.primaryPosition] ?? 9;
  const pb = POSITION_SORT_ORDER[b.primaryPosition] ?? 9;
  if (pa !== pb) return pa - pb;
  const nameA = (a.nickname || a.fullName || '').trim();
  const nameB = (b.nickname || b.fullName || '').trim();
  const nickCmp = nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
  if (nickCmp !== 0) return nickCmp;
  return (a.fullName || '').localeCompare(b.fullName || '', 'pt-BR', {
    sensitivity: 'base',
  });
}

interface StoreState {
  initialized: boolean;
  nextUserId: number;
  nextSquadId: number;
  nextPlayerId: number;
  nextCampaignId: number;
  nextLineupId: number;
  nextMatchId: number;
  nextAchievementId: number;
  users: DbUser[];
  squads: MemSquad[];
  players: MemPlayer[];
  campaigns: MemCampaign[];
  lineups: MemLineupSlot[];
  matches: MemMatch[];
  achievements: MemAchievement[];
  credits: MemCredits;
}

declare global {
  var _bitAZeroMemoryStore: StoreState | undefined;
}

function getStore(): StoreState {
  if (!global._bitAZeroMemoryStore) {
    const state: StoreState = {
      initialized: false,
      nextUserId: 1,
      nextSquadId: 1,
      nextPlayerId: 1,
      nextCampaignId: 1,
      nextLineupId: 1,
      nextMatchId: 1,
      nextAchievementId: 1,
      users: [],
      squads: [],
      players: [],
      campaigns: [],
      lineups: [],
      matches: [],
      achievements: [],
      credits: {
        id: 1,
        title: 'Créditos & Agradecimentos',
        subtitle: 'BIT A ZERO · Draft de elencos do canal Bit Fut',
        intro:
          'Projeto criado para celebrar os elencos históricos, carreiras lendárias e o desafio do 7 a 0 do canal Bit Fut.',
        entries: [
          {
            id: 'bitfut',
            role: 'Inspiração & Canal',
            name: 'Canal Bit Fut',
            description:
              'Séries marcantes, clubes históricos, lendas inesquecíveis e o formato do desafio que inspiraram este jogo.',
            linkLabel: '',
            linkUrl: '',
          },
          {
            id: 'curadoria',
            role: 'Idealização & Elencos',
            name: 'Equipe BIT A ZERO',
            description:
              'Seleção dos elencos, montagem das fotos e calibração das disputas do torneio.',
            linkLabel: '',
            linkUrl: '',
          },
          {
            id: 'comunidade',
            role: 'Comunidade',
            name: 'Torcedores & Jogadores',
            description:
              'Sugestões de novos times, testes de equilíbrio e campanhas compartilhadas a cada temporada.',
            linkLabel: '',
            linkUrl: '',
          },
        ],
        footerNote:
          'Administradores logados podem editar todos os textos, funções, links e cartões desta página.',
        updatedBy: null,
        updatedAt: new Date(),
      },
    };

    const baseTime = Date.now() - OFFICIAL_SQUADS.length * 1000;
    OFFICIAL_SQUADS.forEach((sq, idx) => {
      const squadId = state.nextSquadId++;
      const createdAt = new Date(baseTime + idx * 1000);
      state.squads.push({
        id: squadId,
        name: sq.name,
        season: sq.season,
        country: sq.country,
        competition: sq.competition || null,
        crestUrl: sq.crestUrl,
        isExample: sq.isExample,
        isFinalOnly: Boolean(sq.isFinalOnly),
        createdAt,
        updatedAt: createdAt,
      });

      for (const p of sq.players) {
        state.players.push({
          id: state.nextPlayerId++,
          squadId,
          fullName: p.fullName,
          nickname: p.nickname,
          shirtNumber: p.shirtNumber,
          primaryPosition: p.primaryPosition,
          secondaryPositions: p.secondaryPositions,
          rating: p.rating,
          isLegendary: p.isLegendary,
          photoUrl: p.photoUrl || null,
          createdAt,
        });
      }
    });

    state.initialized = true;
    global._bitAZeroMemoryStore = state;
  }

  return global._bitAZeroMemoryStore;
}

export function getOrCreateMemoryUser(
  uid: string,
  email: string,
  displayName?: string
): DbUser {
  const store = getStore();
  const normalizedEmail = email.trim().toLowerCase();
  const existing = store.users.find((u) => u.uid === uid);
  if (existing) {
    if (OWNER_ADMIN_EMAILS.has(normalizedEmail) && existing.role !== 'admin') {
      existing.role = 'admin';
    }
    if (displayName && displayName !== existing.displayName) {
      existing.displayName = displayName;
    }
    return existing;
  }

  const hasAdmin = store.users.some((u) => u.role === 'admin');
  const isAdmin = OWNER_ADMIN_EMAILS.has(normalizedEmail) || !hasAdmin;
  const created: DbUser = {
    id: store.nextUserId++,
    uid,
    email: normalizedEmail,
    displayName: displayName || normalizedEmail.split('@')[0],
    role: isAdmin ? 'admin' : 'user',
  };
  store.users.push(created);
  return created;
}

export function memGetSquadSummary() {
  const store = getStore();
  const recentSquads = store.squads
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8);
  return {
    totalSquads: store.squads.length,
    totalPlayers: store.players.length,
    recentSquads,
  };
}

export function memListPublicSquads(searchRaw: string) {
  const store = getStore();
  const search = searchRaw.trim().toLowerCase();

  const sortedSquads = store.squads.slice().sort((a, b) => {
    if (a.isFinalOnly !== b.isFinalOnly) return a.isFinalOnly ? 1 : -1;
    const cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    return cmp !== 0 ? cmp : a.id - b.id;
  });

  const playersBySquad = new Map<number, MemPlayer[]>();
  for (const p of store.players) {
    if (!playersBySquad.has(p.squadId)) playersBySquad.set(p.squadId, []);
    playersBySquad.get(p.squadId)!.push(p);
  }

  return sortedSquads
    .map((sq) => {
      const sqPlayers = (playersBySquad.get(sq.id) || [])
        .slice()
        .sort(comparePlayers)
        .map((p) => ({
          id: p.id,
          squadId: p.squadId,
          fullName: p.fullName,
          nickname: p.nickname,
          shirtNumber: p.shirtNumber,
          primaryPosition: p.primaryPosition,
          isLegendary: p.isLegendary,
          photoUrl: p.photoUrl,
        }));
      return {
        id: sq.id,
        name: sq.name,
        season: sq.season,
        country: sq.country,
        competition: sq.competition,
        crestUrl: sq.crestUrl,
        isFinalOnly: sq.isFinalOnly,
        players: sqPlayers,
      };
    })
    .filter((sq) => {
      if (!search) return true;
      const squadMatch =
        sq.name.toLowerCase().includes(search) ||
        sq.country.toLowerCase().includes(search) ||
        sq.season.toLowerCase().includes(search) ||
        (sq.competition || '').toLowerCase().includes(search);
      const playerMatch = sq.players.some(
        (p) =>
          p.fullName.toLowerCase().includes(search) ||
          p.nickname.toLowerCase().includes(search)
      );
      return squadMatch || playerMatch;
    });
}

export function memGetCredits() {
  return getStore().credits;
}

export function memUpdateCredits(payload: {
  title: string;
  subtitle: string;
  intro: string;
  entries: CreditEntry[];
  footerNote: string;
  updatedBy: string;
}) {
  const store = getStore();
  store.credits = {
    ...store.credits,
    title: payload.title,
    subtitle: payload.subtitle,
    intro: payload.intro,
    entries: payload.entries,
    footerNote: payload.footerNote,
    updatedBy: payload.updatedBy,
    updatedAt: new Date(),
  };
  return store.credits;
}

export function memListCampaigns(userId?: number | null, guestToken?: string | null) {
  const store = getStore();
  const completed = store.campaigns.filter((c) => c.status === 'completed');
  const recent = completed
    .slice()
    .sort(
      (a, b) =>
        (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
    )
    .slice(0, 10);

  const best = completed
    .slice()
    .sort((a, b) => {
      if (a.isPerfectSevenZero !== b.isPerfectSevenZero) {
        return a.isPerfectSevenZero ? -1 : 1;
      }
      if (a.isChampion !== b.isChampion) return a.isChampion ? -1 : 1;
      if (a.wins !== b.wins) return b.wins - a.wins;
      if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
      return b.goalsFor - a.goalsFor;
    })
    .slice(0, 10);

  const activeStates = new Set(['drafting', 'ready', 'simulating']);
  let activeDraft: MemCampaign | null = null;
  if (userId) {
    activeDraft =
      store.campaigns
        .filter((c) => c.userId === userId && activeStates.has(c.status))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null;
  } else if (guestToken) {
    activeDraft =
      store.campaigns
        .filter((c) => c.guestToken === guestToken && activeStates.has(c.status))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null;
  }

  return { recent, best, activeDraft };
}

function memDrawCompatibleSquad(campaignId: number, excludeSquadId?: number | null) {
  const store = getStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return null;

  const campaignLineup = store.lineups.filter((s) => s.campaignId === campaignId);
  const emptyPositions = new Set(
    campaignLineup.filter((s) => !s.playerId).map((s) => s.slotPosition)
  );
  if (emptyPositions.size === 0) return null;

  const pickedPlayerIds = new Set(
    campaignLineup.map((s) => s.playerId).filter((id): id is number => !!id)
  );
  const pickedNicknames = new Set(
    campaignLineup
      .map((s) => s.playerSnapshot?.nickname)
      .filter((nick): nick is string => Boolean(nick))
      .map((nick) => normalizeNickname(nick))
  );

  const playersBySquad = new Map<number, MemPlayer[]>();
  for (const p of store.players) {
    if (!playersBySquad.has(p.squadId)) playersBySquad.set(p.squadId, []);
    playersBySquad.get(p.squadId)!.push(p);
  }

  const drawnSet = new Set(campaign.drawnSquadIds || []);

  const hasCompatiblePlayer = (squadId: number) => {
    const squadPlayers = playersBySquad.get(squadId) || [];
    return squadPlayers.some((p) => {
      if (pickedPlayerIds.has(p.id)) return false;
      if (pickedNicknames.has(normalizeNickname(p.nickname))) return false;
      for (const pos of emptyPositions) {
        if (isPlayerCompatibleWithSlot(p.primaryPosition, pos)) return true;
      }
      return false;
    });
  };

  const draftableSquads = store.squads.filter((s) => !s.isFinalOnly);
  const poolSquads = draftableSquads.length > 0 ? draftableSquads : store.squads;

  let candidates = poolSquads.filter(
    (s) =>
      s.id !== excludeSquadId && !drawnSet.has(s.id) && hasCompatiblePlayer(s.id)
  );
  if (candidates.length === 0) {
    candidates = poolSquads.filter(
      (s) => s.id !== excludeSquadId && hasCompatiblePlayer(s.id)
    );
  }
  if (candidates.length === 0) {
    candidates = poolSquads.filter((s) => hasCompatiblePlayer(s.id));
  }
  if (candidates.length === 0) return null;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  campaign.currentSquadId = chosen.id;
  campaign.drawnSquadIds = Array.from(
    new Set([...(campaign.drawnSquadIds || []), chosen.id])
  );
  return chosen;
}

export function memBuildCampaignPayload(campaignId: number) {
  const store = getStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return null;

  const slotRows = store.lineups.filter((l) => l.campaignId === campaignId);
  const matchRows = store.matches.filter((m) => m.campaignId === campaignId);
  const achievementRows = store.achievements.filter(
    (a) => a.campaignId === campaignId
  );

  let currentSquad:
    | (MemSquad & {
        players: Array<Omit<MemPlayer, 'rating'> & { rating: number | null }>;
      })
    | null = null;

  if (campaign.status === 'drafting' && campaign.currentSquadId) {
    const sq = store.squads.find((s) => s.id === campaign.currentSquadId);
    if (sq) {
      const sqPlayers = store.players.filter((p) => p.squadId === sq.id);
      const hideRatings = campaign.difficulty === 'almanaque';
      currentSquad = {
        ...sq,
        players: sqPlayers
          .slice()
          .sort(comparePlayers)
          .map((p) => ({
            ...p,
            rating: hideRatings ? null : p.rating,
          })),
      };
    }
  }

  const hideLineupRatings =
    campaign.difficulty === 'almanaque' && campaign.status === 'drafting';
  const sanitizedLineup = slotRows
    .slice()
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((slot) => {
      if (!slot.playerSnapshot || !hideLineupRatings) return slot;
      return {
        ...slot,
        playerSnapshot: {
          ...slot.playerSnapshot,
          rating: 0,
        },
      };
    });

  const hideAvg =
    campaign.difficulty === 'almanaque' && campaign.status === 'drafting';

  let finalBoss: any = null;
  let userBreakdown: any = null;

  const isSevenWinsUnlock =
    campaign.status === 'completed' && campaign.isChampion && campaign.wins === 7;

  if (isSevenWinsUnlock) {
    const filledUserLineup = sanitizedLineup
      .filter((s) => s.playerSnapshot !== null)
      .map((s) => ({
        slotPosition: s.slotPosition,
        player: s.playerSnapshot!,
      }));

    if (filledUserLineup.length > 0) {
      const computed = computeTeamStrength(
        filledUserLineup,
        campaign.formation,
        campaign.style as PlayStyle
      );
      userBreakdown = {
        overall: computed.overall,
        attack: computed.attack,
        midfield: computed.midfield,
        defense: computed.defense,
        goalkeeper: computed.goalkeeper,
        legendaryCount: computed.legendaryCount,
      };
    }

    const chosenBoss = store.squads.find((s) => s.isFinalOnly) || null;
    if (chosenBoss) {
      const bossPlayers = store.players.filter((p) => p.squadId === chosenBoss.id);
      const bestXI = buildOpponentBestXI(
        {
          id: chosenBoss.id,
          name: chosenBoss.name.replace(' (Exemplo)', ''),
          season: chosenBoss.season,
          crestUrl: chosenBoss.crestUrl,
          isFinalOnly: Boolean(chosenBoss.isFinalOnly),
          avgRating: bossPlayers.length
            ? Math.round(
                bossPlayers.reduce((sum, p) => sum + p.rating, 0) /
                  bossPlayers.length
              )
            : 90,
          players: bossPlayers.map((p) => ({
            id: p.id,
            fullName: p.fullName,
            nickname: p.nickname,
            shirtNumber: p.shirtNumber,
            primaryPosition: p.primaryPosition,
            secondaryPositions: [],
            rating: p.rating,
            isLegendary: Boolean(p.isLegendary),
            photoUrl: p.photoUrl,
          })),
        },
        '4-3-3',
        campaign.id
      );

      finalBoss = {
        id: chosenBoss.id,
        name: chosenBoss.name.replace(' (Exemplo)', ''),
        serie: chosenBoss.competition || null,
        crestUrl: chosenBoss.crestUrl,
        formation: bestXI.formation,
        breakdown: bestXI.breakdown,
        lineup: bestXI.lineup,
        reservesCount: bestXI.reserves.length,
      };
    }
  }

  return {
    campaign: {
      ...campaign,
      avgRating: hideAvg ? 0 : campaign.avgRating,
    },
    lineup: sanitizedLineup,
    matches: matchRows.slice().sort((a, b) => a.matchOrder - b.matchOrder),
    achievements: achievementRows,
    currentSquad,
    finalBoss,
    userBreakdown,
  };
}

export function memCreateCampaign(input: {
  userId?: number | null;
  guestToken?: string | null;
  coachName: string;
  formation?: string;
  style?: string;
  difficulty?: string;
}) {
  const store = getStore();
  const formationDef = getFormation(input.formation || '4-3-3');
  const validStyle: PlayStyle = ['ofensivo', 'equilibrado', 'defensivo'].includes(
    input.style || ''
  )
    ? (input.style as PlayStyle)
    : 'equilibrado';
  const validDifficulty =
    input.difficulty === 'almanaque' ? 'almanaque' : 'classico';

  const campaign: MemCampaign = {
    id: store.nextCampaignId++,
    userId: input.userId ?? null,
    guestToken: input.guestToken ?? null,
    coachName: input.coachName,
    formation: formationDef.id,
    style: validStyle,
    difficulty: validDifficulty,
    status: 'drafting',
    skipsRemaining: 3,
    currentSquadId: null,
    drawnSquadIds: [],
    avgRating: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    isChampion: false,
    isPerfectSevenZero: false,
    shareCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
    createdAt: new Date(),
    completedAt: null,
  };
  store.campaigns.push(campaign);

  for (const slot of formationDef.slots) {
    store.lineups.push({
      id: store.nextLineupId++,
      campaignId: campaign.id,
      slotIndex: slot.slotIndex,
      slotPosition: slot.position,
      slotLabel: slot.label,
      playerId: null,
      playerSnapshot: null,
      pickedAt: null,
    });
  }

  memDrawCompatibleSquad(campaign.id);
  return memBuildCampaignPayload(campaign.id);
}

export function memSkipCampaign(campaignId: number) {
  const store = getStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return { status: 404, error: 'Campanha não encontrada.' };
  if (campaign.status !== 'drafting') {
    return { status: 400, error: 'O draft já foi encerrado.' };
  }
  if (campaign.skipsRemaining <= 0) {
    return { status: 400, error: 'Você já utilizou todas as 3 trocas de elenco.' };
  }

  const prevSquadId = campaign.currentSquadId;
  campaign.skipsRemaining -= 1;
  memDrawCompatibleSquad(campaignId, prevSquadId);
  return { status: 200, payload: memBuildCampaignPayload(campaignId) };
}

export function memPickCampaignPlayer(
  campaignId: number,
  playerId: number,
  slotIndex: number
) {
  const store = getStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return { status: 404, error: 'Campanha não encontrada.' };
  if (campaign.status !== 'drafting') {
    return { status: 400, error: 'O draft desta campanha já terminou.' };
  }

  const player = store.players.find((p) => p.id === playerId);
  if (!player) return { status: 404, error: 'Jogador não encontrado.' };

  if (campaign.currentSquadId && player.squadId !== campaign.currentSquadId) {
    return {
      status: 400,
      error: 'Escolha um jogador do elenco atualmente sorteado.',
    };
  }

  const squad = store.squads.find((s) => s.id === player.squadId);
  const campaignSlots = store.lineups.filter((s) => s.campaignId === campaignId);

  if (campaignSlots.some((s) => s.playerId === player.id)) {
    return {
      status: 400,
      error: 'Não é permitido repetir jogadores na mesma escalação.',
    };
  }

  const normPlayerNick = normalizeNickname(player.nickname);
  if (
    campaignSlots.some(
      (s) =>
        s.playerSnapshot?.nickname &&
        normalizeNickname(s.playerSnapshot.nickname) === normPlayerNick
    )
  ) {
    return {
      status: 400,
      error: `Já existe um jogador com o apelido "${player.nickname}" no seu time.`,
    };
  }

  const targetSlot = campaignSlots.find((s) => s.slotIndex === slotIndex);
  if (!targetSlot) return { status: 400, error: 'Posição tática inválida.' };
  if (targetSlot.playerId) {
    return { status: 400, error: 'Essa posição já está preenchida.' };
  }

  if (
    !isPlayerCompatibleWithSlot(player.primaryPosition, targetSlot.slotPosition)
  ) {
    return {
      status: 400,
      error: `${player.nickname} (${player.primaryPosition}) não atua como ${targetSlot.slotPosition}.`,
    };
  }

  targetSlot.playerId = player.id;
  targetSlot.pickedAt = new Date();
  targetSlot.playerSnapshot = {
    id: player.id,
    squadId: player.squadId,
    squadName: squad?.name || 'Elenco',
    squadSeason: squad?.season || '',
    squadCrestUrl: squad?.crestUrl || null,
    fullName: player.fullName,
    nickname: player.nickname,
    shirtNumber: player.shirtNumber,
    primaryPosition: player.primaryPosition,
    secondaryPositions: [],
    rating: player.rating,
    isLegendary: player.isLegendary,
    photoUrl: player.photoUrl,
  };

  const filledSlots = campaignSlots.filter((s) => s.playerSnapshot !== null);
  if (filledSlots.length === 11) {
    campaign.avgRating = Math.round(
      filledSlots.reduce((acc, s) => acc + (s.playerSnapshot?.rating || 75), 0) /
        11
    );
    campaign.status = 'ready';
    campaign.currentSquadId = null;
  } else {
    memDrawCompatibleSquad(campaignId);
  }

  return { status: 200, payload: memBuildCampaignPayload(campaignId) };
}

export function memRemoveCampaignSlot(campaignId: number, slotIndex: number) {
  const store = getStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return { status: 404, error: 'Campanha não encontrada.' };
  if (!['drafting', 'ready'].includes(campaign.status)) {
    return {
      status: 400,
      error: 'Não é possível alterar a escalação após o início da competição.',
    };
  }

  const targetSlot = store.lineups.find(
    (s) => s.campaignId === campaignId && s.slotIndex === slotIndex
  );
  if (!targetSlot || !targetSlot.playerId) {
    return { status: 400, error: 'Nenhum jogador nesta vaga.' };
  }

  targetSlot.playerId = null;
  targetSlot.playerSnapshot = null;
  campaign.status = 'drafting';
  campaign.avgRating = 0;

  if (!campaign.currentSquadId) {
    memDrawCompatibleSquad(campaignId);
  }

  return { status: 200, payload: memBuildCampaignPayload(campaignId) };
}

export function memRunMatchStep(campaignId: number) {
  const store = getStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error('Campanha não encontrada.');

  const slotRows = store.lineups.filter((s) => s.campaignId === campaignId);
  const filled = slotRows.filter((s) => s.playerSnapshot !== null);
  if (filled.length < 11) {
    throw new Error('Complete as 11 posições antes de iniciar a competição.');
  }

  const existingMatches = store.matches.filter((m) => m.campaignId === campaignId);
  if (campaign.status === 'completed' || existingMatches.length >= 7) {
    return memBuildCampaignPayload(campaignId);
  }

  const nextOrder = existingMatches.length + 1;
  const opponentPool = store.squads.map((sq) => {
    const sqP = store.players.filter((p) => p.squadId === sq.id);
    const avg = sqP.length
      ? Math.round(sqP.reduce((a, b) => a + b.rating, 0) / sqP.length)
      : 82;
    return {
      id: sq.id,
      name: sq.name.replace(' (Exemplo)', ''),
      season: sq.season,
      crestUrl: sq.crestUrl,
      isFinalOnly: Boolean(sq.isFinalOnly),
      avgRating: avg,
      players: sqP.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        nickname: p.nickname,
        shirtNumber: p.shirtNumber,
        primaryPosition: p.primaryPosition,
        secondaryPositions: [],
        rating: p.rating,
        isLegendary: Boolean(p.isLegendary),
        photoUrl: p.photoUrl,
      })),
    };
  });

  const result = simulateSingleMatch({
    matchOrder: nextOrder,
    lineupPlayers: filled.map((s) => ({
      slotPosition: s.slotPosition,
      player: s.playerSnapshot!,
    })),
    formation: campaign.formation,
    style: campaign.style as PlayStyle,
    availableOpponents: opponentPool,
    alreadyFacedNames: existingMatches.map((m) => m.opponentName),
  });

  store.matches.push({
    id: store.nextMatchId++,
    campaignId,
    matchOrder: result.matchOrder,
    stage: result.stage,
    opponentName: result.opponentName,
    opponentCrestUrl: result.opponentCrestUrl,
    opponentStrength: result.opponentStrength,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    penaltyNote: result.penaltyNote,
    events: result.events,
    playedAt: new Date(),
  });

  campaign.wins += result.homeScore > result.awayScore ? 1 : 0;
  campaign.draws += result.homeScore === result.awayScore ? 1 : 0;
  campaign.losses += result.homeScore < result.awayScore ? 1 : 0;
  campaign.goalsFor += result.homeScore;
  campaign.goalsAgainst += result.awayScore;

  let eliminatedInGroups = false;
  if (nextOrder === 3) {
    const groupPts = campaign.wins * 3 + campaign.draws;
    if (groupPts < 3) eliminatedInGroups = true;
  }

  const isEliminated = result.eliminated || eliminatedInGroups;
  const isFinalWon = nextOrder === 7 && !isEliminated;
  const isCompleted = isFinalWon || isEliminated || nextOrder >= 7;
  const isPerfectSevenZero =
    isFinalWon &&
    campaign.wins === 7 &&
    campaign.draws === 0 &&
    campaign.losses === 0 &&
    campaign.goalsAgainst === 0;

  campaign.status = isCompleted ? 'completed' : 'simulating';
  campaign.isChampion = isFinalWon;
  campaign.isPerfectSevenZero = isPerfectSevenZero;
  campaign.completedAt = isCompleted ? new Date() : null;

  if (isCompleted) {
    const unlocked = evaluateCampaignAchievements({
      wins: campaign.wins,
      draws: campaign.draws,
      losses: campaign.losses,
      goalsAgainst: campaign.goalsAgainst,
      isChampion: isFinalWon,
      isPerfectSevenZero,
      avgRating: campaign.avgRating,
      lineupSnapshots: filled.map((s) => s.playerSnapshot!),
    });

    for (const ach of unlocked) {
      store.achievements.push({
        id: store.nextAchievementId++,
        userId: campaign.userId,
        guestToken: campaign.guestToken,
        campaignId: campaign.id,
        code: ach.code,
        title: ach.title,
        description: ach.description,
        unlockedAt: new Date(),
      });
    }
  }

  return memBuildCampaignPayload(campaignId);
}

export function memSimulateBonus(campaignId: number) {
  const store = getStore();
  const campaign = store.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return { status: 404, error: 'Campanha não encontrada.' };
  if (
    campaign.status !== 'completed' ||
    !campaign.isChampion ||
    campaign.wins !== 7
  ) {
    return {
      status: 403,
      error: 'O Time de Lendas só é desbloqueado após vencer todos os 7 jogos.',
    };
  }

  const filled = store.lineups.filter(
    (s) => s.campaignId === campaignId && s.playerSnapshot !== null
  );
  if (filled.length < 11) {
    return { status: 400, error: 'Escalação incompleta.' };
  }

  const chosenBoss = store.squads.find((s) => s.isFinalOnly);
  if (!chosenBoss) {
    return { status: 404, error: 'Nenhum Time de Lendas cadastrado.' };
  }

  const bossPlayers = store.players.filter((p) => p.squadId === chosenBoss.id);
  const result = simulateSingleMatch({
    matchOrder: 7,
    lineupPlayers: filled.map((s) => ({
      slotPosition: s.slotPosition,
      player: s.playerSnapshot!,
    })),
    formation: campaign.formation,
    style: campaign.style as PlayStyle,
    availableOpponents: [
      {
        id: chosenBoss.id,
        name: chosenBoss.name.replace(' (Exemplo)', ''),
        season: chosenBoss.season,
        crestUrl: chosenBoss.crestUrl,
        isFinalOnly: false,
        avgRating: bossPlayers.length
          ? Math.round(
              bossPlayers.reduce((sum, p) => sum + p.rating, 0) /
                bossPlayers.length
            )
          : 90,
        players: bossPlayers.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          nickname: p.nickname,
          shirtNumber: p.shirtNumber,
          primaryPosition: p.primaryPosition,
          secondaryPositions: [],
          rating: p.rating,
          isLegendary: Boolean(p.isLegendary),
          photoUrl: p.photoUrl,
        })),
      },
    ],
    alreadyFacedNames: [],
  });

  return {
    status: 200,
    result: {
      opponentName: result.opponentName,
      opponentCrestUrl: result.opponentCrestUrl,
      opponentStrength: result.opponentStrength,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      events: result.events,
    },
  };
}

export function memListAchievements(
  userId?: number | null,
  guestToken?: string | null
) {
  const store = getStore();
  let userRows: MemAchievement[] = [];
  if (userId) {
    userRows = store.achievements.filter((a) => a.userId === userId);
  } else if (guestToken) {
    userRows = store.achievements.filter((a) => a.guestToken === guestToken);
  } else {
    userRows = store.achievements.slice(0, 50);
  }

  const countMap = new Map<string, number>();
  for (const a of store.achievements) {
    countMap.set(a.code, (countMap.get(a.code) || 0) + 1);
  }
  const globalCounts = Array.from(countMap.entries()).map(([code, count]) => ({
    code,
    count,
  }));

  return { unlocked: userRows, globalCounts };
}
