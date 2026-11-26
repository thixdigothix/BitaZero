export const POSITIONS = ['GOL', 'DEF', 'MEI', 'ATQ'] as const;

export type PositionCode = (typeof POSITIONS)[number];

export const POSITION_NAMES: Record<PositionCode, string> = {
  GOL: 'Goleiro',
  DEF: 'Defesa',
  MEI: 'Meio-Campo',
  ATQ: 'Ataque',
};

export function normalizePosition(raw: string): PositionCode | null {
  const upper = String(raw || '').trim().toUpperCase();
  if (upper === 'GOL' || upper === 'GOLEIRO' || upper === 'GK') {
    return 'GOL';
  }
  if (
    upper === 'DEF' ||
    upper === 'DEFESA' ||
    upper === 'ZAG' ||
    upper === 'LD' ||
    upper === 'LE'
  ) {
    return 'DEF';
  }
  if (
    upper === 'MEI' ||
    upper === 'MEIO' ||
    upper === 'MEIO-CAMPO' ||
    upper === 'MC' ||
    upper === 'VOL'
  ) {
    return 'MEI';
  }
  if (
    upper === 'ATQ' ||
    upper === 'ATA' ||
    upper === 'ATAQUE' ||
    upper === 'PD' ||
    upper === 'PE'
  ) {
    return 'ATQ';
  }
  return null;
}

export interface FormationSlot {
  slotIndex: number;
  position: PositionCode;
  label: string;
  x: number;
  y: number;
}

export interface FormationDefinition {
  id: string;
  name: string;
  description: string;
  slots: FormationSlot[];
}

export const FORMATIONS: FormationDefinition[] = [
  {
    id: '4-3-3',
    name: '4-3-3',
    description: '1 GOL · 4 DEF · 3 MEI · 3 ATQ para equilíbrio e pressão alta.',
    slots: [
      { slotIndex: 0, position: 'GOL', label: 'GOL', x: 50, y: 89 },
      { slotIndex: 1, position: 'DEF', label: 'DEF', x: 16, y: 71 },
      { slotIndex: 2, position: 'DEF', label: 'DEF', x: 38, y: 74 },
      { slotIndex: 3, position: 'DEF', label: 'DEF', x: 62, y: 74 },
      { slotIndex: 4, position: 'DEF', label: 'DEF', x: 84, y: 71 },
      { slotIndex: 5, position: 'MEI', label: 'MEI', x: 50, y: 55 },
      { slotIndex: 6, position: 'MEI', label: 'MEI', x: 29, y: 46 },
      { slotIndex: 7, position: 'MEI', label: 'MEI', x: 71, y: 46 },
      { slotIndex: 8, position: 'ATQ', label: 'ATQ', x: 19, y: 22 },
      { slotIndex: 9, position: 'ATQ', label: 'ATQ', x: 50, y: 15 },
      { slotIndex: 10, position: 'ATQ', label: 'ATQ', x: 81, y: 22 },
    ],
  },
  {
    id: '4-4-2',
    name: '4-4-2',
    description: '1 GOL · 4 DEF · 4 MEI · 2 ATQ em duas linhas compactas.',
    slots: [
      { slotIndex: 0, position: 'GOL', label: 'GOL', x: 50, y: 89 },
      { slotIndex: 1, position: 'DEF', label: 'DEF', x: 16, y: 72 },
      { slotIndex: 2, position: 'DEF', label: 'DEF', x: 38, y: 75 },
      { slotIndex: 3, position: 'DEF', label: 'DEF', x: 62, y: 75 },
      { slotIndex: 4, position: 'DEF', label: 'DEF', x: 84, y: 72 },
      { slotIndex: 5, position: 'MEI', label: 'MEI', x: 17, y: 46 },
      { slotIndex: 6, position: 'MEI', label: 'MEI', x: 39, y: 52 },
      { slotIndex: 7, position: 'MEI', label: 'MEI', x: 61, y: 52 },
      { slotIndex: 8, position: 'MEI', label: 'MEI', x: 83, y: 46 },
      { slotIndex: 9, position: 'ATQ', label: 'ATQ', x: 37, y: 18 },
      { slotIndex: 10, position: 'ATQ', label: 'ATQ', x: 63, y: 18 },
    ],
  },
  {
    id: '4-2-3-1',
    name: '4-2-3-1',
    description: '1 GOL · 4 DEF · 5 MEI · 1 ATQ com dupla proteção e armadores.',
    slots: [
      { slotIndex: 0, position: 'GOL', label: 'GOL', x: 50, y: 89 },
      { slotIndex: 1, position: 'DEF', label: 'DEF', x: 16, y: 72 },
      { slotIndex: 2, position: 'DEF', label: 'DEF', x: 38, y: 75 },
      { slotIndex: 3, position: 'DEF', label: 'DEF', x: 62, y: 75 },
      { slotIndex: 4, position: 'DEF', label: 'DEF', x: 84, y: 72 },
      { slotIndex: 5, position: 'MEI', label: 'MEI', x: 36, y: 56 },
      { slotIndex: 6, position: 'MEI', label: 'MEI', x: 64, y: 56 },
      { slotIndex: 7, position: 'MEI', label: 'MEI', x: 20, y: 35 },
      { slotIndex: 8, position: 'MEI', label: 'MEI', x: 50, y: 36 },
      { slotIndex: 9, position: 'MEI', label: 'MEI', x: 80, y: 35 },
      { slotIndex: 10, position: 'ATQ', label: 'ATQ', x: 50, y: 15 },
    ],
  },
  {
    id: '3-5-2',
    name: '3-5-2',
    description: '1 GOL · 3 DEF · 5 MEI · 2 ATQ com domínio do meio-campo.',
    slots: [
      { slotIndex: 0, position: 'GOL', label: 'GOL', x: 50, y: 89 },
      { slotIndex: 1, position: 'DEF', label: 'DEF', x: 26, y: 73 },
      { slotIndex: 2, position: 'DEF', label: 'DEF', x: 50, y: 75 },
      { slotIndex: 3, position: 'DEF', label: 'DEF', x: 74, y: 73 },
      { slotIndex: 4, position: 'MEI', label: 'MEI', x: 14, y: 49 },
      { slotIndex: 5, position: 'MEI', label: 'MEI', x: 37, y: 55 },
      { slotIndex: 6, position: 'MEI', label: 'MEI', x: 63, y: 55 },
      { slotIndex: 7, position: 'MEI', label: 'MEI', x: 50, y: 38 },
      { slotIndex: 8, position: 'MEI', label: 'MEI', x: 86, y: 49 },
      { slotIndex: 9, position: 'ATQ', label: 'ATQ', x: 37, y: 18 },
      { slotIndex: 10, position: 'ATQ', label: 'ATQ', x: 63, y: 18 },
    ],
  },
  {
    id: '3-4-3',
    name: '3-4-3',
    description: '1 GOL · 3 DEF · 4 MEI · 3 ATQ em modelo agressivo.',
    slots: [
      { slotIndex: 0, position: 'GOL', label: 'GOL', x: 50, y: 89 },
      { slotIndex: 1, position: 'DEF', label: 'DEF', x: 26, y: 74 },
      { slotIndex: 2, position: 'DEF', label: 'DEF', x: 50, y: 75 },
      { slotIndex: 3, position: 'DEF', label: 'DEF', x: 74, y: 74 },
      { slotIndex: 4, position: 'MEI', label: 'MEI', x: 35, y: 54 },
      { slotIndex: 5, position: 'MEI', label: 'MEI', x: 20, y: 43 },
      { slotIndex: 6, position: 'MEI', label: 'MEI', x: 65, y: 54 },
      { slotIndex: 7, position: 'MEI', label: 'MEI', x: 80, y: 43 },
      { slotIndex: 8, position: 'ATQ', label: 'ATQ', x: 20, y: 21 },
      { slotIndex: 9, position: 'ATQ', label: 'ATQ', x: 50, y: 15 },
      { slotIndex: 10, position: 'ATQ', label: 'ATQ', x: 80, y: 21 },
    ],
  },
  {
    id: '4-5-1',
    name: '4-5-1',
    description: '1 GOL · 4 DEF · 5 MEI · 1 ATQ buscando baliza zerada.',
    slots: [
      { slotIndex: 0, position: 'GOL', label: 'GOL', x: 50, y: 89 },
      { slotIndex: 1, position: 'DEF', label: 'DEF', x: 16, y: 72 },
      { slotIndex: 2, position: 'DEF', label: 'DEF', x: 38, y: 75 },
      { slotIndex: 3, position: 'DEF', label: 'DEF', x: 62, y: 75 },
      { slotIndex: 4, position: 'DEF', label: 'DEF', x: 84, y: 72 },
      { slotIndex: 5, position: 'MEI', label: 'MEI', x: 50, y: 58 },
      { slotIndex: 6, position: 'MEI', label: 'MEI', x: 18, y: 41 },
      { slotIndex: 7, position: 'MEI', label: 'MEI', x: 37, y: 46 },
      { slotIndex: 8, position: 'MEI', label: 'MEI', x: 63, y: 46 },
      { slotIndex: 9, position: 'MEI', label: 'MEI', x: 82, y: 41 },
      { slotIndex: 10, position: 'ATQ', label: 'ATQ', x: 50, y: 16 },
    ],
  },
];

export const STYLES = [
  {
    id: 'ofensivo',
    name: 'Ofensivo',
    description: 'Mais volume de ataque (+7% criação), porém cede mais espaços.',
  },
  {
    id: 'equilibrado',
    name: 'Equilibrado',
    description: 'Distribuição clássica entre controle de posse e recomposição.',
  },
  {
    id: 'defensivo',
    name: 'Defensivo',
    description: 'Prioriza baliza zerada (-9% chances sofridas) e contra-ataques.',
  },
] as const;

export type PlayStyle = (typeof STYLES)[number]['id'];

export const DIFFICULTIES = [
  {
    id: 'classico',
    name: 'Clássico',
    description: 'As notas de força dos jogadores ficam visíveis durante todo o draft.',
  },
  {
    id: 'almanaque',
    name: 'Almanaque',
    description: 'Notas ocultas. Escolha confiando apenas no seu conhecimento de futebol.',
  },
] as const;

export type GameDifficulty = (typeof DIFFICULTIES)[number]['id'];

export const ACHIEVEMENT_CATALOG = [
  {
    code: 'first_win',
    title: 'Primeira Vitória',
    description: 'Vencer sua primeira partida na competição.',
  },
  {
    code: 'first_title',
    title: 'Primeiro Título',
    description: 'Levantar a taça vencendo os sete passos até a final.',
  },
  {
    code: 'unbeaten_champion',
    title: 'Campeão Invicto',
    description: 'Conquistar o título sem sofrer nenhuma derrota.',
  },
  {
    code: 'perfect_defense',
    title: 'Defesa Perfeita',
    description: 'Ser campeão sem sofrer nenhum gol durante toda a campanha.',
  },
  {
    code: 'perfect_7_0',
    title: '7 a 0 Perfeito',
    description: 'Vencer todas as 7 partidas da campanha sem sofrer nenhum gol.',
  },
  {
    code: 'underdog_champion',
    title: 'Campeão Improvável',
    description: 'Vencer o torneio com média de força do elenco abaixo de 80.',
  },
] as const;

export function getFormation(formationId: string): FormationDefinition {
  return FORMATIONS.find((f) => f.id === formationId) || FORMATIONS[0];
}

export function normalizeNickname(nickname: string): string {
  return String(nickname || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function isPlayerCompatibleWithSlot(
  primaryPosition: string,
  slotPosition: string
): boolean {
  const normSlot = normalizePosition(slotPosition) || slotPosition;
  const normPrimary = normalizePosition(primaryPosition) || primaryPosition;
  return normPrimary === normSlot;
}

export const TOURNAMENT_STAGES = [
  { order: 1, stage: 'Fase de Grupos · Rodada 1', baseStrength: 75, knockout: false },
  { order: 2, stage: 'Fase de Grupos · Rodada 2', baseStrength: 78, knockout: false },
  { order: 3, stage: 'Fase de Grupos · Rodada 3', baseStrength: 81, knockout: false },
  { order: 4, stage: 'Oitavas de Final', baseStrength: 84, knockout: true },
  { order: 5, stage: 'Quartas de Final', baseStrength: 86, knockout: true },
  { order: 6, stage: 'Semifinal', baseStrength: 88, knockout: true },
  { order: 7, stage: 'Final', baseStrength: 91, knockout: true },
] as const;
