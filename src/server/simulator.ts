import type {
  MatchEvent,
  PlayerSnapshot,
} from '../db/schema.ts';
import {
  ACHIEVEMENT_CATALOG,
  getFormation,
  normalizePosition,
  type PlayStyle,
  TOURNAMENT_STAGES,
} from '../shared/gameLogic.ts';

export interface TeamStrengthBreakdown {
  overall: number;
  attack: number;
  midfield: number;
  defense: number;
  goalkeeper: number;
  legendaryCount: number;
  styleAttackBonus: number;
  styleDefenseBonus: number;
}

export interface SimulatedMatchResult {
  matchOrder: number;
  stage: string;
  opponentName: string;
  opponentCrestUrl: string | null;
  opponentStrength: number;
  homeScore: number;
  awayScore: number;
  penaltyNote: string | null;
  events: MatchEvent[];
  eliminated: boolean;
}

export interface OpponentPlayerInput {
  id?: number;
  fullName?: string;
  nickname: string;
  shirtNumber?: number;
  primaryPosition: string;
  secondaryPositions: string[];
  rating: number;
  isLegendary: boolean;
  photoUrl?: string | null;
}

export interface OpponentSquadInput {
  id?: number;
  name: string;
  season: string;
  crestUrl: string | null;
  isFinalOnly?: boolean;
  avgRating?: number;
  players: OpponentPlayerInput[];
}

export interface OpponentBreakdown {
  overall: number;
  attack: number;
  midfield: number;
  defense: number;
  goalkeeper: number;
  legendaryCount: number;
}

const FALLBACK_OPPONENTS: OpponentSquadInput[] = [
  {
    name: 'Real Madrid Clássico',
    season: '',
    crestUrl: null,
    avgRating: 89,
    players: [
      { nickname: 'Casillas', primaryPosition: 'GOL', secondaryPositions: [], rating: 90, isLegendary: true },
      { nickname: 'Ramos', primaryPosition: 'DEF', secondaryPositions: [], rating: 90, isLegendary: true },
      { nickname: 'Pepe', primaryPosition: 'DEF', secondaryPositions: [], rating: 87, isLegendary: false },
      { nickname: 'Marcelo', primaryPosition: 'DEF', secondaryPositions: [], rating: 88, isLegendary: true },
      { nickname: 'Carvajal', primaryPosition: 'DEF', secondaryPositions: [], rating: 86, isLegendary: false },
      { nickname: 'Modric', primaryPosition: 'MEI', secondaryPositions: [], rating: 91, isLegendary: true },
      { nickname: 'Kroos', primaryPosition: 'MEI', secondaryPositions: [], rating: 90, isLegendary: true },
      { nickname: 'Casemiro', primaryPosition: 'MEI', secondaryPositions: [], rating: 88, isLegendary: false },
      { nickname: 'Bale', primaryPosition: 'ATQ', secondaryPositions: [], rating: 89, isLegendary: false },
      { nickname: 'Benzema', primaryPosition: 'ATQ', secondaryPositions: [], rating: 90, isLegendary: true },
      { nickname: 'Cristiano', primaryPosition: 'ATQ', secondaryPositions: [], rating: 95, isLegendary: true },
    ],
  },
  {
    name: 'Milan Histórico',
    season: '',
    crestUrl: null,
    avgRating: 88,
    players: [
      { nickname: 'Dida', primaryPosition: 'GOL', secondaryPositions: [], rating: 88, isLegendary: true },
      { nickname: 'Cafu', primaryPosition: 'DEF', secondaryPositions: [], rating: 90, isLegendary: true },
      { nickname: 'Nesta', primaryPosition: 'DEF', secondaryPositions: [], rating: 91, isLegendary: true },
      { nickname: 'Maldini', primaryPosition: 'DEF', secondaryPositions: [], rating: 94, isLegendary: true },
      { nickname: 'Costacurta', primaryPosition: 'DEF', secondaryPositions: [], rating: 86, isLegendary: false },
      { nickname: 'Pirlo', primaryPosition: 'MEI', secondaryPositions: [], rating: 91, isLegendary: true },
      { nickname: 'Gattuso', primaryPosition: 'MEI', secondaryPositions: [], rating: 87, isLegendary: false },
      { nickname: 'Seedorf', primaryPosition: 'MEI', secondaryPositions: [], rating: 89, isLegendary: true },
      { nickname: 'Kaká', primaryPosition: 'ATQ', secondaryPositions: [], rating: 93, isLegendary: true },
      { nickname: 'Shevchenko', primaryPosition: 'ATQ', secondaryPositions: [], rating: 92, isLegendary: true },
      { nickname: 'Inzaghi', primaryPosition: 'ATQ', secondaryPositions: [], rating: 87, isLegendary: false },
    ],
  },
  {
    name: 'Bayern Munique',
    season: '',
    crestUrl: null,
    avgRating: 88,
    players: [
      { nickname: 'Neuer', primaryPosition: 'GOL', secondaryPositions: [], rating: 92, isLegendary: true },
      { nickname: 'Lahm', primaryPosition: 'DEF', secondaryPositions: [], rating: 90, isLegendary: true },
      { nickname: 'Boateng', primaryPosition: 'DEF', secondaryPositions: [], rating: 87, isLegendary: false },
      { nickname: 'Alaba', primaryPosition: 'DEF', secondaryPositions: [], rating: 88, isLegendary: false },
      { nickname: 'Davies', primaryPosition: 'DEF', secondaryPositions: [], rating: 85, isLegendary: false },
      { nickname: 'Schweinsteiger', primaryPosition: 'MEI', secondaryPositions: [], rating: 89, isLegendary: true },
      { nickname: 'Kimmich', primaryPosition: 'MEI', secondaryPositions: [], rating: 89, isLegendary: false },
      { nickname: 'Müller', primaryPosition: 'ATQ', secondaryPositions: [], rating: 89, isLegendary: true },
      { nickname: 'Robben', primaryPosition: 'ATQ', secondaryPositions: [], rating: 91, isLegendary: true },
      { nickname: 'Ribéry', primaryPosition: 'ATQ', secondaryPositions: [], rating: 90, isLegendary: true },
      { nickname: 'Lewandowski', primaryPosition: 'ATQ', secondaryPositions: [], rating: 93, isLegendary: true },
    ],
  },
  {
    name: 'Ajax Total',
    season: '',
    crestUrl: null,
    avgRating: 86,
    players: [
      { nickname: 'Van der Sar', primaryPosition: 'GOL', secondaryPositions: [], rating: 89, isLegendary: true },
      { nickname: 'Reiziger', primaryPosition: 'DEF', secondaryPositions: [], rating: 84, isLegendary: false },
      { nickname: 'De Boer', primaryPosition: 'DEF', secondaryPositions: [], rating: 87, isLegendary: true },
      { nickname: 'Blind', primaryPosition: 'DEF', secondaryPositions: [], rating: 85, isLegendary: false },
      { nickname: 'Rijkaard', primaryPosition: 'DEF', secondaryPositions: [], rating: 91, isLegendary: true },
      { nickname: 'Seedorf', primaryPosition: 'MEI', secondaryPositions: [], rating: 88, isLegendary: true },
      { nickname: 'Davids', primaryPosition: 'MEI', secondaryPositions: [], rating: 87, isLegendary: true },
      { nickname: 'Litmanen', primaryPosition: 'MEI', secondaryPositions: [], rating: 87, isLegendary: false },
      { nickname: 'Overmars', primaryPosition: 'ATQ', secondaryPositions: [], rating: 86, isLegendary: false },
      { nickname: 'Kluivert', primaryPosition: 'ATQ', secondaryPositions: [], rating: 87, isLegendary: false },
      { nickname: 'Cruyff', primaryPosition: 'ATQ', secondaryPositions: [], rating: 95, isLegendary: true },
    ],
  },
];

export function computeOpponentBreakdown(
  players: OpponentPlayerInput[],
  fallbackAvg = 82
): OpponentBreakdown {
  if (!players || players.length === 0) {
    const base = Math.max(60, Math.min(98, Math.round(fallbackAvg || 82)));
    return {
      overall: base,
      attack: base,
      midfield: base,
      defense: base,
      goalkeeper: base,
      legendaryCount: 0,
    };
  }

  const scored = players.map((p, idx) => {
    const pos = normalizePosition(p.primaryPosition) || 'MEI';
    const effective = Math.max(
      45,
      Math.min(100, (p.rating || fallbackAvg || 80) + (p.isLegendary ? 1.2 : 0))
    );
    return { idx, pos, effective, isLegendary: Boolean(p.isLegendary) };
  });

  const used = new Set<number>();
  const pickBest = (targetPos: 'GOL' | 'DEF' | 'MEI' | 'ATQ', count: number) => {
    const picked: typeof scored = [];
    for (let i = 0; i < count; i++) {
      const candidate = scored
        .filter((p) => !used.has(p.idx))
        .map((p) => {
          let fitScore = p.effective;
          if (p.pos === targetPos) fitScore += 15;
          else fitScore -= 12;
          return { p, fitScore };
        })
        .sort((a, b) => b.fitScore - a.fitScore)[0];

      if (!candidate) break;
      used.add(candidate.p.idx);
      const actualRating =
        candidate.p.pos === targetPos
          ? candidate.p.effective
          : Math.max(45, candidate.p.effective - 5);
      picked.push({ ...candidate.p, effective: actualRating });
    }
    return picked;
  };

  const gks = pickBest('GOL', 1);
  const defs = pickBest('DEF', 4);
  const mids = pickBest('MEI', 3);
  const atks = pickBest('ATQ', 3);

  const starters = [...gks, ...defs, ...mids, ...atks];
  const avgOf = (arr: typeof scored, fallback: number) =>
    arr.length ? arr.reduce((sum, item) => sum + item.effective, 0) / arr.length : fallback;

  const overall = Math.round(avgOf(starters, fallbackAvg));
  const goalkeeper = Math.round(avgOf(gks, overall));
  const defense = Math.round(avgOf(defs, overall));
  const midfield = Math.round(avgOf(mids, overall));
  const attack = Math.round(avgOf(atks, overall));
  const legendaryCount = starters.filter((p) => p.isLegendary).length;

  return {
    overall,
    attack,
    midfield,
    defense,
    goalkeeper,
    legendaryCount,
  };
}

export function buildOpponentBestXI(
  opp: OpponentSquadInput,
  formationId = '4-3-3',
  campaignId = 0
) {
  const formation = getFormation(formationId);
  const pool = opp.players || [];
  const breakdown = computeOpponentBreakdown(pool, opp.avgRating ?? 85);
  const used = new Set<number>();

  const slotLineup = formation.slots.map((slotDef) => {
    const targetPos = normalizePosition(slotDef.position) || 'MEI';
    const candidate = pool
      .map((p, idx) => ({ p, idx }))
      .filter(({ idx }) => !used.has(idx))
      .map(({ p, idx }) => {
        const normPrimary = normalizePosition(p.primaryPosition) || 'MEI';
        let fitScore = (p.rating || opp.avgRating || 80) + (p.isLegendary ? 1.2 : 0);
        if (normPrimary === targetPos) fitScore += 15;
        else fitScore -= 12;
        return { p, idx, fitScore };
      })
      .sort((a, b) => b.fitScore - a.fitScore)[0];

    if (!candidate) {
      return {
        id: -(slotDef.slotIndex + 1),
        campaignId,
        slotIndex: slotDef.slotIndex,
        slotPosition: slotDef.position,
        slotLabel: slotDef.label,
        playerId: null,
        playerSnapshot: null,
      };
    }

    used.add(candidate.idx);
    const chosen = candidate.p;
    const playerSnapshot: PlayerSnapshot = {
      id: chosen.id ?? -(candidate.idx + 1),
      squadId: opp.id ?? 0,
      squadName: opp.name,
      squadSeason: opp.season || '',
      squadCrestUrl: opp.crestUrl || null,
      fullName: chosen.fullName || chosen.nickname,
      nickname: chosen.nickname,
      shirtNumber: chosen.shirtNumber ?? 10,
      primaryPosition: normalizePosition(chosen.primaryPosition) || slotDef.position,
      secondaryPositions: [],
      rating: chosen.rating,
      isLegendary: Boolean(chosen.isLegendary),
      photoUrl: chosen.photoUrl || null,
    };

    return {
      id: -(slotDef.slotIndex + 1),
      campaignId,
      slotIndex: slotDef.slotIndex,
      slotPosition: slotDef.position,
      slotLabel: slotDef.label,
      playerId: playerSnapshot.id,
      playerSnapshot,
    };
  });

  const reserves = pool.filter((_, idx) => !used.has(idx));

  return {
    formation: formation.id,
    breakdown,
    lineup: slotLineup,
    reserves,
  };
}

export function computeTeamStrength(
  lineupPlayers: Array<{
    slotPosition: string;
    player: PlayerSnapshot;
  }>,
  formation: string,
  style: PlayStyle
): TeamStrengthBreakdown {
  if (lineupPlayers.length === 0) {
    return {
      overall: 60,
      attack: 60,
      midfield: 60,
      defense: 60,
      goalkeeper: 60,
      legendaryCount: 0,
      styleAttackBonus: 0,
      styleDefenseBonus: 0,
    };
  }

  const effectiveRating = (slotPos: string, p: PlayerSnapshot) => {
    const normSlot = normalizePosition(slotPos) || slotPos;
    const normPrimary = normalizePosition(p.primaryPosition) || p.primaryPosition;
    const posPenalty = normPrimary === normSlot ? 0 : -4;
    const legendBoost = p.isLegendary ? 1.0 : 0;
    return Math.max(40, Math.min(100, p.rating + posPenalty + legendBoost));
  };

  const atkList: number[] = [];
  const midList: number[] = [];
  const defList: number[] = [];
  let gk = 75;
  let total = 0;
  let legendaryCount = 0;

  for (const item of lineupPlayers) {
    const normSlot = normalizePosition(item.slotPosition) || 'DEF';
    const score = effectiveRating(item.slotPosition, item.player);
    total += score;
    if (item.player.isLegendary) legendaryCount += 1;

    if (normSlot === 'GOL') {
      gk = score;
    } else if (normSlot === 'DEF') {
      defList.push(score);
    } else if (normSlot === 'MEI') {
      midList.push(score);
    } else {
      atkList.push(score);
    }
  }

  const avg = (arr: number[], fallback: number) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : fallback;

  const overall = Math.round(total / lineupPlayers.length);
  let attack = avg(atkList, overall);
  let midfield = avg(midList, overall);
  let defense = avg(defList, overall);

  if (formation === '3-4-3' || formation === '4-3-3') attack += 1.5;
  if (formation === '4-5-1' || formation === '3-5-2') midfield += 1.5;
  if (formation === '4-2-3-1' || formation === '4-5-1') defense += 1.5;

  let styleAttackBonus = 0;
  let styleDefenseBonus = 0;
  if (style === 'ofensivo') {
    styleAttackBonus = 4.0;
    styleDefenseBonus = -3.0;
  } else if (style === 'defensivo') {
    styleAttackBonus = -2.5;
    styleDefenseBonus = 4.5;
  }

  return {
    overall,
    attack: Math.round(attack + styleAttackBonus),
    midfield: Math.round(midfield),
    defense: Math.round(defense * 0.65 + gk * 0.35 + styleDefenseBonus),
    goalkeeper: Math.round(gk),
    legendaryCount,
    styleAttackBonus,
    styleDefenseBonus,
  };
}

function sampleWeightedScorer(
  lineupPlayers: Array<{ slotPosition: string; player: PlayerSnapshot }>
): PlayerSnapshot {
  const weights = lineupPlayers.map(({ slotPosition, player }) => {
    const normSlot = normalizePosition(slotPosition) || 'DEF';
    let base = 1;
    if (normSlot === 'ATQ') base = 38;
    else if (normSlot === 'MEI') base = 16;
    else if (normSlot === 'DEF') base = 4;
    else if (normSlot === 'GOL') base = 0.1;

    const ratingFactor = Math.max(0.5, (player.rating - 60) / 25);
    return base * ratingFactor * (player.isLegendary ? 1.2 : 1);
  });

  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < lineupPlayers.length; i++) {
    r -= weights[i];
    if (r <= 0) return lineupPlayers[i].player;
  }
  return lineupPlayers[lineupPlayers.length - 1].player;
}

function sampleWeightedOpponentScorer(
  opponentPlayers: OpponentPlayerInput[]
): OpponentPlayerInput | null {
  if (!opponentPlayers || opponentPlayers.length === 0) return null;

  const weights = opponentPlayers.map((player) => {
    const normPrimary = normalizePosition(player.primaryPosition) || 'MEI';
    let base = 4;
    if (normPrimary === 'ATQ') base = 42;
    else if (normPrimary === 'MEI') base = 18;
    else if (normPrimary === 'DEF') base = 4;
    else if (normPrimary === 'GOL') base = 0.08;

    const ratingFactor = Math.max(0.45, (player.rating - 55) / 25);
    return base * ratingFactor * (player.isLegendary ? 1.25 : 1);
  });

  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < opponentPlayers.length; i++) {
    r -= weights[i];
    if (r <= 0) return opponentPlayers[i];
  }
  return opponentPlayers[opponentPlayers.length - 1];
}

function poissonSample(lambda: number): number {
  const L = Math.exp(-Math.max(0.05, lambda));
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L && k < 8);
  return k - 1;
}

function pickOpponentForStage(
  pool: Array<OpponentSquadInput & { breakdown: OpponentBreakdown }>,
  matchOrder: number,
  alreadyFacedNames: string[]
) {
  const facedSet = new Set(alreadyFacedNames.map((n) => n.toLowerCase()));
  const regularSquads = pool.filter((s) => !s.isFinalOnly);

  if (matchOrder === 7) {
    const baseCandidates = regularSquads.length > 0 ? regularSquads : pool;
    const unFaced = baseCandidates.filter((s) => !facedSet.has(s.name.toLowerCase()));
    const ranked = [...(unFaced.length > 0 ? unFaced : baseCandidates)].sort(
      (a, b) => b.breakdown.overall - a.breakdown.overall
    );
    return ranked[0];
  }

  const baseRegular = regularSquads.length > 0 ? regularSquads : pool;
  const unFaced = baseRegular.filter((s) => !facedSet.has(s.name.toLowerCase()));
  const candidates = (unFaced.length > 0 ? unFaced : baseRegular).sort(
    (a, b) => a.breakdown.overall - b.breakdown.overall
  );

  if (candidates.length === 1) return candidates[0];

  if (matchOrder <= 3) {
    // Fase de Grupos: times da faixa inicial/intermediária
    const cap = Math.max(1, Math.ceil(candidates.length * 0.65));
    const slice = candidates.slice(0, cap);
    return slice[Math.floor(Math.random() * slice.length)];
  }

  if (matchOrder <= 5) {
    // Oitavas e Quartas: metade superior dos times cadastrados
    const start = Math.floor(candidates.length * 0.35);
    const slice = candidates.slice(start);
    return slice[Math.floor(Math.random() * slice.length)];
  }

  // Semifinal: entre os 3 times regulares mais fortes disponíveis
  const topSlice = candidates.slice(Math.max(0, candidates.length - 3));
  return topSlice[Math.floor(Math.random() * topSlice.length)];
}

export function simulateSingleMatch(params: {
  matchOrder: number;
  lineupPlayers: Array<{ slotPosition: string; player: PlayerSnapshot }>;
  formation: string;
  style: PlayStyle;
  availableOpponents: OpponentSquadInput[];
  alreadyFacedNames?: string[];
}): SimulatedMatchResult {
  const stageDef =
    TOURNAMENT_STAGES.find((s) => s.order === params.matchOrder) ||
    TOURNAMENT_STAGES[0];

  const strength = computeTeamStrength(
    params.lineupPlayers,
    params.formation,
    params.style
  );

  const rawPool =
    params.availableOpponents.length > 0
      ? params.availableOpponents
      : FALLBACK_OPPONENTS;

  const measuredPool = rawPool.map((opp) => ({
    ...opp,
    breakdown: computeOpponentBreakdown(opp.players || [], opp.avgRating ?? 82),
  }));

  const oppPick = pickOpponentForStage(
    measuredPool,
    params.matchOrder,
    params.alreadyFacedNames || []
  );

  // Força oficial baseada diretamente no overall médio medido do elenco rival
  const oppOverall = oppPick.breakdown.overall;
  const oppDisplayStrength = Math.max(40, Math.min(99, Math.round(oppOverall)));

  // Diferença de overall médio: positiva = jogo mais fácil; negativa = jogo mais difícil
  const overallDiff = strength.overall - oppOverall;

  // Nuance tática secundária por setor e estilo (Ofensivo abre o jogo; Defensivo fecha o jogo)
  const userAtkPower = strength.attack * 0.62 + strength.midfield * 0.38;
  const oppAtkPower =
    oppPick.breakdown.attack * 0.62 + oppPick.breakdown.midfield * 0.38;
  const oppDefPower =
    oppPick.breakdown.defense * 0.65 + oppPick.breakdown.goalkeeper * 0.35;

  const sectorAtkNuance = (userAtkPower - oppDefPower - overallDiff) * 0.025;
  const sectorDefNuance = (oppAtkPower - strength.defense + overallDiff) * 0.025;

  const styleOpenness =
    params.style === 'ofensivo' ? 0.14 : params.style === 'defensivo' ? -0.14 : 0;

  // Bônus por jogadores lendários no seu time titular (quanto mais lendas, maior a chance de vitória)
  const legendAtkBonus = strength.legendaryCount * 0.03;
  const legendDefBonus = strength.legendaryCount * 0.02;

  // Aleatoriedade natural do futebol (distribuição em sino: maioria fiel ao overall, com margem para zebras)
  const userMatchDaySwing = (Math.random() + Math.random() - 1) * 0.65;
  const oppMatchDaySwing = (Math.random() + Math.random() - 1) * 0.5;

  const overallEdge = overallDiff * 0.075;

  const userLambda = Math.max(
    0.25,
    Math.min(
      3.5,
      1.2 +
        overallEdge +
        sectorAtkNuance +
        styleOpenness +
        legendAtkBonus +
        userMatchDaySwing
    )
  );
  const oppLambda = Math.max(
    0.25,
    Math.min(
      3.6,
      1.26 -
        overallEdge +
        sectorDefNuance +
        styleOpenness * 0.7 -
        legendDefBonus +
        oppMatchDaySwing
    )
  );

  const homeScore = poissonSample(userLambda);
  const awayScore = poissonSample(oppLambda);

  let penaltyNote: string | null = null;
  let eliminated = false;

  if (stageDef.knockout) {
    if (homeScore === awayScore) {
      const userPenWinProb = Math.max(
        0.18,
        Math.min(
          0.78,
          0.48 +
            overallDiff * 0.018 +
            (strength.goalkeeper - oppPick.breakdown.goalkeeper) * 0.007 +
            strength.legendaryCount * 0.008
        )
      );
      const userWinsPens = Math.random() < userPenWinProb;
      const penWinner = userWinsPens ? 4 + Math.floor(Math.random() * 2) : 3;
      const penLoser = userWinsPens
        ? 2 + Math.floor(Math.random() * 2)
        : 4 + Math.floor(Math.random() * 2);
      if (userWinsPens) {
        penaltyNote = `Avançou nos pênaltis (${penWinner} x ${penLoser})`;
      } else {
        penaltyNote = `Eliminado nos pênaltis (${penLoser} x ${penWinner})`;
        eliminated = true;
      }
    } else if (homeScore < awayScore) {
      eliminated = true;
    }
  }

  const events: MatchEvent[] = [];
  const gkPlayer =
    params.lineupPlayers.find(
      (p) => (normalizePosition(p.slotPosition) || p.slotPosition) === 'GOL'
    )?.player || params.lineupPlayers[0].player;

  const usedMinutes = new Set<number>();
  const pickMinute = (min: number, max: number) => {
    for (let t = 0; t < 15; t++) {
      const m = min + Math.floor(Math.random() * (max - min + 1));
      if (!usedMinutes.has(m)) {
        usedMinutes.add(m);
        return m;
      }
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  for (let i = 0; i < homeScore; i++) {
    const scorer = sampleWeightedScorer(params.lineupPlayers);
    events.push({
      minute: pickMinute(4, 90),
      type: 'goal',
      playerName: scorer.nickname,
      detail: `Gol de ${scorer.nickname}`,
    });
  }

  for (let i = 0; i < awayScore; i++) {
    const oppScorer = sampleWeightedOpponentScorer(oppPick.players || []);
    if (oppScorer) {
      events.push({
        minute: pickMinute(6, 89),
        type: 'opponent_goal',
        playerName: oppScorer.nickname,
        detail: `Gol de ${oppPick.name} (${oppScorer.primaryPosition})`,
      });
    } else {
      events.push({
        minute: pickMinute(6, 89),
        type: 'opponent_goal',
        playerName: oppPick.name,
        detail: `Gol sofrido para ${oppPick.name}`,
      });
    }
  }

  if (awayScore === 0 || Math.random() < 0.7) {
    events.push({
      minute: pickMinute(18, 84),
      type: 'save',
      playerName: gkPlayer.nickname,
      detail: `Grande defesa de ${gkPlayer.nickname} garante segurança lá atrás`,
    });
  }

  if (Math.random() < 0.45) {
    const cardTarget =
      params.lineupPlayers[Math.floor(Math.random() * params.lineupPlayers.length)]
        .player;
    events.push({
      minute: pickMinute(22, 87),
      type: 'yellow_card',
      playerName: cardTarget.nickname,
      detail: `Cartão amarelo para ${cardTarget.nickname}`,
    });
  }

  events.sort((a, b) => a.minute - b.minute);

  return {
    matchOrder: params.matchOrder,
    stage: stageDef.stage,
    opponentName: oppPick.name,
    opponentCrestUrl: oppPick.crestUrl,
    opponentStrength: oppDisplayStrength,
    homeScore,
    awayScore,
    penaltyNote,
    events,
    eliminated,
  };
}

export function evaluateCampaignAchievements(params: {
  wins: number;
  draws: number;
  losses: number;
  goalsAgainst: number;
  isChampion: boolean;
  isPerfectSevenZero: boolean;
  avgRating: number;
  lineupSnapshots: PlayerSnapshot[];
}) {
  const unlockedCodes: string[] = [];

  if (params.wins >= 1) unlockedCodes.push('first_win');
  if (params.isChampion) {
    unlockedCodes.push('first_title');
    if (params.losses === 0) unlockedCodes.push('unbeaten_champion');
    if (params.goalsAgainst === 0) unlockedCodes.push('perfect_defense');
    if (params.isPerfectSevenZero) unlockedCodes.push('perfect_7_0');
    if (params.avgRating > 0 && params.avgRating < 80) {
      unlockedCodes.push('underdog_champion');
    }
  }

  return ACHIEVEMENT_CATALOG.filter((a) => unlockedCodes.includes(a.code));
}
