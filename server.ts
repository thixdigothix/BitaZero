import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from './src/db/index.ts';
import {
  achievements,
  campaigns,
  type CreditEntry,
  lineups,
  matches,
  players,
  type PlayerSnapshot,
  siteCredits,
  squads,
  users,
} from './src/db/schema.ts';
import {
  type AuthRequest,
  optionalAuth,
  requireAdmin,
} from './src/middleware/auth.ts';
import {
  getFormation,
  isPlayerCompatibleWithSlot,
  normalizeNickname,
  normalizePosition,
  type PlayStyle,
  type PositionCode,
} from './src/shared/gameLogic.ts';
import { ensureInitialExampleData } from './src/server/seed.ts';
import {
  buildOpponentBestXI,
  computeTeamStrength,
  evaluateCampaignAchievements,
  simulateSingleMatch,
} from './src/server/simulator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '6mb' }));

const POSITION_SORT_ORDER: Record<string, number> = {
  GOL: 0,
  DEF: 1,
  MEI: 2,
  ATQ: 3,
};

function comparePlayersByPositionAndName(
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

function sanitizeLineupForDifficulty(
  slots: Array<typeof lineups.$inferSelect>,
  campaign: typeof campaigns.$inferSelect
) {
  const hideRatings =
    campaign.difficulty === 'almanaque' && campaign.status === 'drafting';
  return slots
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((slot) => {
      if (!slot.playerSnapshot) return slot;
      if (!hideRatings) return slot;
      return {
        ...slot,
        playerSnapshot: {
          ...slot.playerSnapshot,
          rating: 0,
        },
      };
    });
}

async function drawCompatibleSquadForCampaign(
  campaignId: number,
  excludeSquadId?: number | null
) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!campaign) return null;

  const campaignLineup = await db
    .select()
    .from(lineups)
    .where(eq(lineups.campaignId, campaignId));

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

  const allSquads = await db.select().from(squads);
  const allPlayers = await db.select().from(players);

  const playersBySquad = new Map<number, (typeof players.$inferSelect)[]>();
  for (const p of allPlayers) {
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
        if (isPlayerCompatibleWithSlot(p.primaryPosition, pos)) {
          return true;
        }
      }
      return false;
    });
  };

  const draftableSquads = allSquads.filter((s) => !s.isFinalOnly);
  const poolSquads = draftableSquads.length > 0 ? draftableSquads : allSquads;

  let candidates = poolSquads.filter(
    (s) =>
      s.id !== excludeSquadId &&
      !drawnSet.has(s.id) &&
      hasCompatiblePlayer(s.id)
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
  const nextDrawnIds = Array.from(
    new Set([...(campaign.drawnSquadIds || []), chosen.id])
  );

  await db
    .update(campaigns)
    .set({
      currentSquadId: chosen.id,
      drawnSquadIds: nextDrawnIds,
    })
    .where(eq(campaigns.id, campaignId));

  return chosen;
}

async function buildCampaignPayload(campaignId: number) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) return null;

  const slotRows = await db
    .select()
    .from(lineups)
    .where(eq(lineups.campaignId, campaignId));

  const matchRows = await db
    .select()
    .from(matches)
    .where(eq(matches.campaignId, campaignId));

  const achievementRows = await db
    .select()
    .from(achievements)
    .where(eq(achievements.campaignId, campaignId));

  let currentSquad:
    | (typeof squads.$inferSelect & {
        players: Array<
          Omit<typeof players.$inferSelect, 'rating'> & { rating: number | null }
        >;
      })
    | null = null;

  if (campaign.status === 'drafting' && campaign.currentSquadId) {
    const [sq] = await db
      .select()
      .from(squads)
      .where(eq(squads.id, campaign.currentSquadId))
      .limit(1);

    if (sq) {
      const sqPlayers = await db
        .select()
        .from(players)
        .where(eq(players.squadId, sq.id));
      const hideRatings = campaign.difficulty === 'almanaque';
      currentSquad = {
        ...sq,
        players: sqPlayers
          .sort(comparePlayersByPositionAndName)
          .map((p) => ({
            ...p,
            rating: hideRatings ? null : p.rating,
          })),
      };
    }
  }

  const sanitizedLineup = sanitizeLineupForDifficulty(slotRows, campaign);
  const hideAvg =
    campaign.difficulty === 'almanaque' && campaign.status === 'drafting';

  let finalBoss: {
    id: number;
    name: string;
    serie: string | null;
    crestUrl: string | null;
    formation: string;
    breakdown: ReturnType<typeof buildOpponentBestXI>['breakdown'];
    lineup: ReturnType<typeof buildOpponentBestXI>['lineup'];
    reservesCount: number;
  } | null = null;

  let userBreakdown: ReturnType<typeof buildOpponentBestXI>['breakdown'] | null = null;

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

    const bossCandidates = await db
      .select()
      .from(squads)
      .where(eq(squads.isFinalOnly, true));

    const chosenBoss = bossCandidates[0] || null;

    if (chosenBoss) {
      const bossPlayers = await db
        .select()
        .from(players)
        .where(eq(players.squadId, chosenBoss.id));

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
    matches: matchRows.sort((a, b) => a.matchOrder - b.matchOrder),
    achievements: achievementRows,
    currentSquad,
    finalBoss,
    userBreakdown,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/me', optionalAuth, (req: AuthRequest, res) => {
  if (!req.dbUser) {
    return res.json({ authenticated: false, user: null });
  }
  res.json({
    authenticated: true,
    user: {
      id: req.dbUser.id,
      uid: req.dbUser.uid,
      email: req.dbUser.email,
      displayName: req.dbUser.displayName,
      role: req.dbUser.role,
    },
  });
});

app.get('/api/squads/summary', async (_req, res) => {
  try {
    await ensureInitialExampleData();
    const squadCountRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(squads);
    const playerCountRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(players);

    const recentSquads = await db
      .select()
      .from(squads)
      .orderBy(desc(squads.createdAt))
      .limit(8);

    res.json({
      totalSquads: squadCountRes[0]?.count ?? 0,
      totalPlayers: playerCountRes[0]?.count ?? 0,
      recentSquads,
    });
  } catch (error) {
    console.error('Error fetching squad summary:', error);
    res.status(500).json({ error: 'Erro ao carregar resumo dos elencos.' });
  }
});

app.get('/api/squads', async (req, res) => {
  try {
    await ensureInitialExampleData();
    const search =
      typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const allSquads = await db
      .select()
      .from(squads)
      .orderBy(squads.isFinalOnly, squads.name, squads.id);

    const allPlayers = await db.select().from(players);

    const playersBySquad = new Map<number, typeof allPlayers>();
    for (const p of allPlayers) {
      if (!playersBySquad.has(p.squadId)) playersBySquad.set(p.squadId, []);
      playersBySquad.get(p.squadId)!.push(p);
    }

    const showcase = allSquads
      .map((sq) => {
        const sqPlayers = (playersBySquad.get(sq.id) || [])
          .slice()
          .sort(comparePlayersByPositionAndName)
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

    res.json({ squads: showcase });
  } catch (error) {
    console.error('Error listing public squads:', error);
    res.status(500).json({ error: 'Erro ao carregar elencos.' });
  }
});

const DEFAULT_CREDITS_PAYLOAD = {
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
  ] satisfies CreditEntry[],
  footerNote:
    'Administradores logados podem editar todos os textos, funções, links e cartões desta página.',
};

function sanitizeCreditUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return '';
}

async function getOrInitSiteCredits() {
  const existing = await db.select().from(siteCredits).limit(1);
  if (existing.length > 0) return existing[0];

  const [created] = await db
    .insert(siteCredits)
    .values({
      title: DEFAULT_CREDITS_PAYLOAD.title,
      subtitle: DEFAULT_CREDITS_PAYLOAD.subtitle,
      intro: DEFAULT_CREDITS_PAYLOAD.intro,
      entries: DEFAULT_CREDITS_PAYLOAD.entries,
      footerNote: DEFAULT_CREDITS_PAYLOAD.footerNote,
    })
    .returning();
  return created;
}

app.get('/api/credits', async (_req, res) => {
  try {
    const credits = await getOrInitSiteCredits();
    res.json({ credits });
  } catch (error) {
    console.error('Error loading credits:', error);
    res.status(500).json({ error: 'Erro ao carregar créditos.' });
  }
});

app.put('/api/credits', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const current = await getOrInitSiteCredits();
    const { title, subtitle, intro, entries, footerNote } = req.body || {};

    const cleanTitle =
      typeof title === 'string' && title.trim()
        ? title.trim()
        : 'Créditos & Agradecimentos';
    const cleanSubtitle = typeof subtitle === 'string' ? subtitle.trim() : '';
    const cleanIntro = typeof intro === 'string' ? intro.trim() : '';
    const cleanFooter = typeof footerNote === 'string' ? footerNote.trim() : '';

    const rawEntries = Array.isArray(entries) ? entries : [];
    const cleanEntries: CreditEntry[] = rawEntries
      .filter((item) => item && typeof item === 'object')
      .map((item, idx) => ({
        id:
          typeof item.id === 'string' && item.id.trim()
            ? item.id.trim()
            : `credit-${Date.now()}-${idx}`,
        role: typeof item.role === 'string' ? item.role.trim() : '',
        name: typeof item.name === 'string' ? item.name.trim() : '',
        description:
          typeof item.description === 'string' ? item.description.trim() : '',
        linkLabel:
          typeof item.linkLabel === 'string' ? item.linkLabel.trim() : '',
        linkUrl: sanitizeCreditUrl(item.linkUrl),
      }))
      .filter((entry) => entry.name.length > 0 || entry.role.length > 0);

    const [updated] = await db
      .update(siteCredits)
      .set({
        title: cleanTitle,
        subtitle: cleanSubtitle,
        intro: cleanIntro,
        entries: cleanEntries,
        footerNote: cleanFooter,
        updatedBy: req.dbUser?.email || 'admin',
        updatedAt: new Date(),
      })
      .where(eq(siteCredits.id, current.id))
      .returning();

    res.json({ credits: updated });
  } catch (error) {
    console.error('Error updating credits:', error);
    res.status(500).json({ error: 'Erro ao salvar créditos.' });
  }
});

app.get('/api/campaigns', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const guestToken =
      typeof req.query.guestToken === 'string' ? req.query.guestToken : null;

    const recent = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.status, 'completed'))
      .orderBy(desc(campaigns.completedAt))
      .limit(10);

    const best = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.status, 'completed'))
      .orderBy(
        desc(campaigns.isPerfectSevenZero),
        desc(campaigns.isChampion),
        desc(campaigns.wins),
        campaigns.goalsAgainst,
        desc(campaigns.goalsFor)
      )
      .limit(10);

    let activeDraft: typeof campaigns.$inferSelect | null = null;
    if (req.dbUser) {
      const drafts = await db
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.userId, req.dbUser.id),
            inArray(campaigns.status, ['drafting', 'ready', 'simulating'])
          )
        )
        .orderBy(desc(campaigns.createdAt))
        .limit(1);
      activeDraft = drafts[0] || null;
    } else if (guestToken) {
      const drafts = await db
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.guestToken, guestToken),
            inArray(campaigns.status, ['drafting', 'ready', 'simulating'])
          )
        )
        .orderBy(desc(campaigns.createdAt))
        .limit(1);
      activeDraft = drafts[0] || null;
    }

    res.json({ recent, best, activeDraft });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Erro ao carregar histórico de campanhas.' });
  }
});

app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Campanha inválida.' });
    }
    const payload = await buildCampaignPayload(id);
    if (!payload) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    res.json(payload);
  } catch (error) {
    console.error('Error getting campaign:', error);
    res.status(500).json({ error: 'Erro ao carregar campanha.' });
  }
});

app.post('/api/campaigns', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureInitialExampleData();
    const { formation, style, difficulty, coachName, guestToken } = req.body;

    const formationDef = getFormation(formation || '4-3-3');
    const validStyle: PlayStyle = ['ofensivo', 'equilibrado', 'defensivo'].includes(
      style
    )
      ? style
      : 'equilibrado';
    const validDifficulty =
      difficulty === 'almanaque' ? 'almanaque' : 'classico';

    const shareCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const [created] = await db
      .insert(campaigns)
      .values({
        userId: req.dbUser?.id ?? null,
        guestToken: typeof guestToken === 'string' ? guestToken : null,
        coachName:
          typeof coachName === 'string' && coachName.trim()
            ? coachName.trim().slice(0, 40)
            : req.dbUser?.displayName || 'Treinador',
        formation: formationDef.id,
        style: validStyle,
        difficulty: validDifficulty,
        status: 'drafting',
        skipsRemaining: 3,
        drawnSquadIds: [],
        shareCode,
      })
      .returning();

    await db.insert(lineups).values(
      formationDef.slots.map((slot) => ({
        campaignId: created.id,
        slotIndex: slot.slotIndex,
        slotPosition: slot.position,
        slotLabel: slot.label,
        playerId: null,
        playerSnapshot: null,
      }))
    );

    await drawCompatibleSquadForCampaign(created.id);
    const payload = await buildCampaignPayload(created.id);
    res.status(201).json(payload);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Erro ao iniciar nova campanha.' });
  }
});

app.post('/api/campaigns/:id/skip', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    if (campaign.status !== 'drafting') {
      return res.status(400).json({ error: 'O draft já foi encerrado.' });
    }
    if (campaign.skipsRemaining <= 0) {
      return res
        .status(400)
        .json({ error: 'Você já utilizou todas as 3 trocas de elenco.' });
    }

    const previousSquadId = campaign.currentSquadId;
    await db
      .update(campaigns)
      .set({ skipsRemaining: campaign.skipsRemaining - 1 })
      .where(eq(campaigns.id, id));

    await drawCompatibleSquadForCampaign(id, previousSquadId);
    const payload = await buildCampaignPayload(id);
    res.json(payload);
  } catch (error) {
    console.error('Error skipping squad:', error);
    res.status(500).json({ error: 'Erro ao trocar elenco sorteado.' });
  }
});

app.post('/api/campaigns/:id/pick', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { playerId, slotIndex } = req.body;

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);
    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    if (campaign.status !== 'drafting') {
      return res.status(400).json({ error: 'O draft desta campanha já terminou.' });
    }

    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, Number(playerId)))
      .limit(1);

    if (!player) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    if (campaign.currentSquadId && player.squadId !== campaign.currentSquadId) {
      return res
        .status(400)
        .json({ error: 'Escolha um jogador do elenco atualmente sorteado.' });
    }

    const [squad] = await db
      .select()
      .from(squads)
      .where(eq(squads.id, player.squadId))
      .limit(1);

    const campaignSlots = await db
      .select()
      .from(lineups)
      .where(eq(lineups.campaignId, id));

    if (campaignSlots.some((s) => s.playerId === player.id)) {
      return res
        .status(400)
        .json({ error: 'Não é permitido repetir jogadores na mesma escalação.' });
    }

    const normPlayerNick = normalizeNickname(player.nickname);
    if (
      campaignSlots.some(
        (s) =>
          s.playerSnapshot?.nickname &&
          normalizeNickname(s.playerSnapshot.nickname) === normPlayerNick
      )
    ) {
      return res.status(400).json({
        error: `Já existe um jogador com o apelido "${player.nickname}" no seu time.`,
      });
    }

    const targetSlot = campaignSlots.find(
      (s) => s.slotIndex === Number(slotIndex)
    );
    if (!targetSlot) {
      return res.status(400).json({ error: 'Posição tática inválida.' });
    }
    if (targetSlot.playerId) {
      return res.status(400).json({ error: 'Essa posição já está preenchida.' });
    }

    if (
      !isPlayerCompatibleWithSlot(
        player.primaryPosition,
        targetSlot.slotPosition
      )
    ) {
      return res.status(400).json({
        error: `${player.nickname} (${player.primaryPosition}) não atua como ${targetSlot.slotPosition}.`,
      });
    }

    const snapshot: PlayerSnapshot = {
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

    await db
      .update(lineups)
      .set({
        playerId: player.id,
        playerSnapshot: snapshot,
        pickedAt: new Date(),
      })
      .where(eq(lineups.id, targetSlot.id));

    const updatedSlots = await db
      .select()
      .from(lineups)
      .where(eq(lineups.campaignId, id));

    const filledSlots = updatedSlots.filter((s) => s.playerSnapshot !== null);

    if (filledSlots.length === 11) {
      const avgRating = Math.round(
        filledSlots.reduce((acc, s) => acc + (s.playerSnapshot?.rating || 75), 0) /
          11
      );
      await db
        .update(campaigns)
        .set({
          status: 'ready',
          currentSquadId: null,
          avgRating,
        })
        .where(eq(campaigns.id, id));
    } else {
      await drawCompatibleSquadForCampaign(id);
    }

    const payload = await buildCampaignPayload(id);
    res.json(payload);
  } catch (error) {
    console.error('Error picking player:', error);
    res.status(500).json({ error: 'Erro ao escalar jogador.' });
  }
});

app.post('/api/campaigns/:id/remove-slot', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { slotIndex } = req.body;

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    if (!['drafting', 'ready'].includes(campaign.status)) {
      return res.status(400).json({
        error: 'Não é possível alterar a escalação após o início da competição.',
      });
    }

    const [targetSlot] = await db
      .select()
      .from(lineups)
      .where(
        and(
          eq(lineups.campaignId, id),
          eq(lineups.slotIndex, Number(slotIndex))
        )
      )
      .limit(1);

    if (!targetSlot || !targetSlot.playerId) {
      return res.status(400).json({ error: 'Nenhum jogador nesta vaga.' });
    }

    await db
      .update(lineups)
      .set({ playerId: null, playerSnapshot: null })
      .where(eq(lineups.id, targetSlot.id));

    await db
      .update(campaigns)
      .set({ status: 'drafting', avgRating: 0 })
      .where(eq(campaigns.id, id));

    if (!campaign.currentSquadId) {
      await drawCompatibleSquadForCampaign(id);
    }

    const payload = await buildCampaignPayload(id);
    res.json(payload);
  } catch (error) {
    console.error('Error removing slot player:', error);
    res.status(500).json({ error: 'Erro ao remover jogador da escalação.' });
  }
});

async function runMatchStep(campaignId: number) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw new Error('Campanha não encontrada.');

  const slotRows = await db
    .select()
    .from(lineups)
    .where(eq(lineups.campaignId, campaignId));
  const filled = slotRows.filter((s) => s.playerSnapshot !== null);
  if (filled.length < 11) {
    throw new Error('Complete as 11 posições antes de iniciar a competição.');
  }

  const existingMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.campaignId, campaignId));

  if (campaign.status === 'completed' || existingMatches.length >= 7) {
    return buildCampaignPayload(campaignId);
  }

  const nextOrder = existingMatches.length + 1;

  const allSquads = await db.select().from(squads);
  const allPlayers = await db.select().from(players);
  const opponentPool = allSquads.map((sq) => {
    const sqP = allPlayers.filter((p) => p.squadId === sq.id);
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

  await db.insert(matches).values({
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
  });

  const wins = campaign.wins + (result.homeScore > result.awayScore ? 1 : 0);
  const draws = campaign.draws + (result.homeScore === result.awayScore ? 1 : 0);
  const losses = campaign.losses + (result.homeScore < result.awayScore ? 1 : 0);
  const goalsFor = campaign.goalsFor + result.homeScore;
  const goalsAgainst = campaign.goalsAgainst + result.awayScore;

  let eliminatedInGroups = false;
  if (nextOrder === 3) {
    const groupPts = wins * 3 + draws;
    if (groupPts < 3) {
      eliminatedInGroups = true;
    }
  }

  const isEliminated = result.eliminated || eliminatedInGroups;
  const isFinalWon = nextOrder === 7 && !isEliminated;
  const isCompleted = isFinalWon || isEliminated || nextOrder >= 7;
  const isPerfectSevenZero =
    isFinalWon && wins === 7 && draws === 0 && losses === 0 && goalsAgainst === 0;

  await db
    .update(campaigns)
    .set({
      status: isCompleted ? 'completed' : 'simulating',
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      isChampion: isFinalWon,
      isPerfectSevenZero,
      completedAt: isCompleted ? new Date() : null,
    })
    .where(eq(campaigns.id, campaignId));

  if (isCompleted) {
    const unlocked = evaluateCampaignAchievements({
      wins,
      draws,
      losses,
      goalsAgainst,
      isChampion: isFinalWon,
      isPerfectSevenZero,
      avgRating: campaign.avgRating,
      lineupSnapshots: filled.map((s) => s.playerSnapshot!),
    });

    for (const ach of unlocked) {
      await db.insert(achievements).values({
        userId: campaign.userId,
        guestToken: campaign.guestToken,
        campaignId: campaign.id,
        code: ach.code,
        title: ach.title,
        description: ach.description,
      });
    }
  }

  return buildCampaignPayload(campaignId);
}

app.post('/api/campaigns/:id/simulate-next', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const payload = await runMatchStep(id);
    res.json(payload);
  } catch (error: any) {
    console.error('Error simulating next match:', error);
    const safeMsg =
      error?.message === 'Campanha não encontrada.' ||
      error?.message === 'Complete as 11 posições antes de iniciar a competição.'
        ? error.message
        : 'Erro ao simular partida.';
    res.status(safeMsg === 'Erro ao simular partida.' ? 500 : 400).json({ error: safeMsg });
  }
});

app.post('/api/campaigns/:id/simulate-all', async (req, res) => {
  try {
    const id = Number(req.params.id);
    let payload = await buildCampaignPayload(id);
    if (!payload) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    let guard = 0;
    while (payload && payload.campaign.status !== 'completed' && guard < 7) {
      payload = await runMatchStep(id);
      guard += 1;
    }
    res.json(payload);
  } catch (error: any) {
    console.error('Error simulating full campaign:', error);
    const safeMsg =
      error?.message === 'Campanha não encontrada.' ||
      error?.message === 'Complete as 11 posições antes de iniciar a competição.'
        ? error.message
        : 'Erro ao simular competição.';
    res.status(safeMsg === 'Erro ao simular competição.' ? 500 : 400).json({ error: safeMsg });
  }
});

app.post('/api/campaigns/:id/simulate-bonus', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Campanha inválida.' });
    }

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    if (campaign.status !== 'completed' || !campaign.isChampion || campaign.wins !== 7) {
      return res.status(403).json({
        error: 'O Time de Lendas só é desbloqueado após vencer todos os 7 jogos.',
      });
    }

    const slotRows = await db
      .select()
      .from(lineups)
      .where(eq(lineups.campaignId, id));
    const filled = slotRows.filter((s) => s.playerSnapshot !== null);
    if (filled.length < 11) {
      return res.status(400).json({ error: 'Escalação incompleta.' });
    }

    const bossCandidates = await db
      .select()
      .from(squads)
      .where(eq(squads.isFinalOnly, true));
    const chosenBoss = bossCandidates[0];
    if (!chosenBoss) {
      return res.status(404).json({ error: 'Nenhum Time de Lendas cadastrado.' });
    }

    const bossPlayers = await db
      .select()
      .from(players)
      .where(eq(players.squadId, chosenBoss.id));

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

    res.json({
      opponentName: result.opponentName,
      opponentCrestUrl: result.opponentCrestUrl,
      opponentStrength: result.opponentStrength,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      events: result.events,
    });
  } catch (error) {
    console.error('Error simulating bonus match:', error);
    res.status(500).json({ error: 'Erro ao simular confronto bônus.' });
  }
});

app.get('/api/achievements', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const guestToken =
      typeof req.query.guestToken === 'string' ? req.query.guestToken : null;

    let userRows: (typeof achievements.$inferSelect)[] = [];
    if (req.dbUser) {
      userRows = await db
        .select()
        .from(achievements)
        .where(eq(achievements.userId, req.dbUser.id));
    } else if (guestToken) {
      userRows = await db
        .select()
        .from(achievements)
        .where(eq(achievements.guestToken, guestToken));
    } else {
      userRows = await db.select().from(achievements).limit(50);
    }

    const globalCounts = await db
      .select({
        code: achievements.code,
        count: sql<number>`count(*)::int`,
      })
      .from(achievements)
      .groupBy(achievements.code);

    res.json({
      unlocked: userRows,
      globalCounts,
    });
  } catch (error) {
    console.error('Error loading achievements:', error);
    res.status(500).json({ error: 'Erro ao carregar conquistas.' });
  }
});

// ADMIN ROUTES (RBAC)
app.get('/api/admin/squads', requireAdmin, async (req, res) => {
  try {
    await ensureInitialExampleData();
    const search =
      typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const allSquads = await db
      .select()
      .from(squads)
      .orderBy(desc(squads.updatedAt), desc(squads.id));

    const allPlayers = await db.select().from(players);

    const enriched = allSquads
      .map((sq) => {
        const sqPlayers = allPlayers
          .filter((p) => p.squadId === sq.id)
          .sort(comparePlayersByPositionAndName);
        return {
          ...sq,
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

    res.json({ squads: enriched });
  } catch (error) {
    console.error('Admin error listing squads:', error);
    res.status(500).json({ error: 'Erro ao listar elencos.' });
  }
});

app.post('/api/admin/squads', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      season,
      country,
      serie,
      competition,
      crestUrl,
      isExample,
      isFinalOnly,
    } = req.body;
    if (!name || !String(name).trim()) {
      return res
        .status(400)
        .json({ error: 'O nome do clube ou seleção é obrigatório.' });
    }

    const serieValue = serie ?? competition;
    const [created] = await db
      .insert(squads)
      .values({
        name: String(name).trim(),
        season: season ? String(season).trim() : '',
        country: country ? String(country).trim() : '',
        competition: serieValue && String(serieValue).trim() ? String(serieValue).trim() : null,
        crestUrl: crestUrl ? String(crestUrl).trim() : null,
        isExample: Boolean(isExample),
        isFinalOnly: Boolean(isFinalOnly),
      })
      .returning();

    res.status(201).json({ squad: { ...created, players: [] } });
  } catch (error) {
    console.error('Admin error creating squad:', error);
    res.status(500).json({ error: 'Erro ao criar elenco.' });
  }
});

app.put('/api/admin/squads/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      name,
      season,
      country,
      serie,
      competition,
      crestUrl,
      isExample,
      isFinalOnly,
    } = req.body;
    if (!name || !String(name).trim()) {
      return res
        .status(400)
        .json({ error: 'O nome do clube ou seleção é obrigatório.' });
    }

    const serieValue = serie ?? competition;
    const [updated] = await db
      .update(squads)
      .set({
        name: String(name).trim(),
        season: season ? String(season).trim() : '',
        country: country ? String(country).trim() : '',
        competition: serieValue && String(serieValue).trim() ? String(serieValue).trim() : null,
        crestUrl: crestUrl ? String(crestUrl).trim() : null,
        isExample: typeof isExample === 'boolean' ? isExample : undefined,
        isFinalOnly: typeof isFinalOnly === 'boolean' ? isFinalOnly : undefined,
        updatedAt: new Date(),
      })
      .where(eq(squads.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Elenco não encontrado.' });
    }

    const sqPlayers = await db
      .select()
      .from(players)
      .where(eq(players.squadId, id));

    res.json({ squad: { ...updated, players: sqPlayers } });
  } catch (error) {
    console.error('Admin error updating squad:', error);
    res.status(500).json({ error: 'Erro ao atualizar elenco.' });
  }
});

app.delete('/api/admin/squads/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(squads).where(eq(squads.id, id));
    res.json({ ok: true });
  } catch (error) {
    console.error('Admin error deleting squad:', error);
    res.status(500).json({ error: 'Erro ao excluir elenco.' });
  }
});

app.post('/api/admin/squads/:squadId/players', requireAdmin, async (req, res) => {
  try {
    const squadId = Number(req.params.squadId);
    const {
      fullName,
      nickname,
      shirtNumber,
      primaryPosition,
      rating,
      isLegendary,
      photoUrl,
    } = req.body;

    if (!nickname || !primaryPosition) {
      return res
        .status(400)
        .json({ error: 'Apelido e posição principal são obrigatórios.' });
    }
    const normPrimary = normalizePosition(primaryPosition);
    if (!normPrimary) {
      return res.status(400).json({ error: 'Posição principal inválida. Use GOL, DEF, MEI ou ATQ.' });
    }

    const cleanNickname = String(nickname).trim();

    const parsedRating = Math.max(1, Math.min(100, Number(rating) || 75));
    const parsedShirt = Math.max(1, Math.min(99, Number(shirtNumber) || 10));
    const cleanFullName = fullName && String(fullName).trim()
      ? String(fullName).trim()
      : cleanNickname;

    const [created] = await db
      .insert(players)
      .values({
        squadId,
        fullName: cleanFullName,
        nickname: cleanNickname,
        shirtNumber: parsedShirt,
        primaryPosition: normPrimary,
        secondaryPositions: [],
        rating: parsedRating,
        isLegendary: Boolean(isLegendary),
        photoUrl: photoUrl ? String(photoUrl).trim() : null,
      })
      .returning();

    res.status(201).json({ player: created });
  } catch (error) {
    console.error('Admin error creating player:', error);
    res.status(500).json({ error: 'Erro ao adicionar jogador.' });
  }
});

app.put('/api/admin/players/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      fullName,
      nickname,
      shirtNumber,
      primaryPosition,
      rating,
      isLegendary,
      photoUrl,
    } = req.body;

    if (!nickname || !primaryPosition) {
      return res
        .status(400)
        .json({ error: 'Apelido e posição principal são obrigatórios.' });
    }
    const normPrimary = normalizePosition(primaryPosition);
    if (!normPrimary) {
      return res.status(400).json({ error: 'Posição principal inválida. Use GOL, DEF, MEI ou ATQ.' });
    }

    const cleanNickname = String(nickname).trim();

    const parsedRating = Math.max(1, Math.min(100, Number(rating) || 75));
    const parsedShirt = Math.max(1, Math.min(99, Number(shirtNumber) || 10));
    const cleanFullName = fullName && String(fullName).trim()
      ? String(fullName).trim()
      : cleanNickname;

    const [updated] = await db
      .update(players)
      .set({
        fullName: cleanFullName,
        nickname: cleanNickname,
        shirtNumber: parsedShirt,
        primaryPosition: normPrimary,
        secondaryPositions: [],
        rating: parsedRating,
        isLegendary: Boolean(isLegendary),
        photoUrl: photoUrl ? String(photoUrl).trim() : null,
      })
      .where(eq(players.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }
    res.json({ player: updated });
  } catch (error) {
    console.error('Admin error updating player:', error);
    res.status(500).json({ error: 'Erro ao atualizar jogador.' });
  }
});

app.delete('/api/admin/players/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(players).where(eq(players.id, id));
    res.json({ ok: true });
  } catch (error) {
    console.error('Admin error deleting player:', error);
    res.status(500).json({ error: 'Erro ao excluir jogador.' });
  }
});

app.post('/api/admin/import', requireAdmin, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: 'Nenhum elenco válido encontrado para importação.' });
    }

    let importedSquads = 0;
    let importedPlayers = 0;

    for (const item of items) {
      if (!item || !item.name || !String(item.name).trim()) continue;
      const serieValue = item.serie ?? item.competition;
      const [insertedSquad] = await db
        .insert(squads)
        .values({
          name: String(item.name).trim(),
          season: item.season ? String(item.season).trim() : '',
          country: item.country ? String(item.country).trim() : '',
          competition:
            serieValue && String(serieValue).trim()
              ? String(serieValue).trim()
              : null,
          crestUrl: item.crestUrl ? String(item.crestUrl).trim() : null,
          isExample: false,
          isFinalOnly: Boolean(item.isFinalOnly),
        })
        .returning();

      importedSquads += 1;

      if (Array.isArray(item.players) && item.players.length > 0) {
        const validPlayers = item.players
          .map((p: any) => {
            const normPrimary = normalizePosition(p.primaryPosition);
            if (!p.nickname || !normPrimary) return null;
            return {
              squadId: insertedSquad.id,
              fullName: String(p.fullName || p.nickname).trim(),
              nickname: String(p.nickname).trim(),
              shirtNumber: Math.max(1, Math.min(99, Number(p.shirtNumber) || 10)),
              primaryPosition: normPrimary,
              secondaryPositions: [],
              rating: Math.max(1, Math.min(100, Number(p.rating) || 75)),
              isLegendary: Boolean(p.isLegendary),
              photoUrl: p.photoUrl ? String(p.photoUrl).trim() : null,
            };
          })
          .filter((p: any): p is NonNullable<typeof p> => p !== null);

        if (validPlayers.length > 0) {
          await db.insert(players).values(validPlayers);
          importedPlayers += validPlayers.length;
        }
      }
    }

    res.json({ importedSquads, importedPlayers });
  } catch (error) {
    console.error('Admin error importing squads:', error);
    res.status(500).json({ error: 'Erro durante a importação em massa.' });
  }
});

app.get('/api/admin/export', requireAdmin, async (_req, res) => {
  try {
    const allSquads = await db.select().from(squads);
    const allPlayers = await db.select().from(players);

    const payload = allSquads.map((sq) => ({
      name: sq.name,
      serie: sq.competition,
      crestUrl: sq.crestUrl,
      isFinalOnly: Boolean(sq.isFinalOnly),
      players: allPlayers
        .filter((p) => p.squadId === sq.id)
        .sort(comparePlayersByPositionAndName)
        .map((p) => ({
          fullName: p.fullName,
          nickname: p.nickname,
          primaryPosition: p.primaryPosition,
          rating: p.rating,
          isLegendary: p.isLegendary,
          photoUrl: p.photoUrl,
        })),
    }));

    res.json({ squads: payload });
  } catch (error) {
    console.error('Admin error exporting squads:', error);
    res.status(500).json({ error: 'Erro ao exportar elencos.' });
  }
});

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  try {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    res.json({ users: allUsers });
  } catch (error) {
    console.error('Admin error listing users:', error);
    res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
});

app.put('/api/admin/users/:id/role', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const role = req.body.role === 'admin' ? 'admin' : 'user';
    if (req.dbUser?.id === id && role !== 'admin') {
      return res
        .status(400)
        .json({ error: 'Você não pode remover seu próprio acesso administrativo.' });
    }
    const [updated] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning();
    res.json({ user: updated });
  } catch (error) {
    console.error('Admin error updating role:', error);
    res.status(500).json({ error: 'Erro ao alterar permissão.' });
  }
});

function resolveServerPort(): number {
  const portFlagIdx = process.argv.indexOf('--port');
  if (portFlagIdx !== -1 && process.argv[portFlagIdx + 1]) {
    const parsed = Number(process.argv[portFlagIdx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const portEqArg = process.argv.find((arg) => arg.startsWith('--port='));
  if (portEqArg) {
    const parsed = Number(portEqArg.split('=')[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return Number(process.env.PORT) || 3000;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint da API não encontrado.' });
});

async function startServer() {
  const PORT = resolveServerPort();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SETE A ZERO server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
