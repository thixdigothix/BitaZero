import { useState } from 'react';
import {
  ArrowLeft,
  Crown,
  Goal,
  Play,
  RotateCcw,
  Swords,
  Trophy,
} from 'lucide-react';
import {
  BonusMatchResult,
  CampaignPayload,
  FinalBossBreakdown,
  LineupSlot,
} from '../types/game.ts';
import { CrestAvatar } from './CrestAvatar.tsx';
import { TacticalPitch } from './TacticalPitch.tsx';

interface LegendsBonusViewProps {
  payload: CampaignPayload;
  bonusMatch: BonusMatchResult | null;
  simulatingBonus: boolean;
  bonusError: string | null;
  onSimulateBonus: () => void;
  onBackToTournament: () => void;
  onNewCampaign: () => void;
}

function computeClientFallbackBreakdown(
  lineup: LineupSlot[],
  avgRating: number
): FinalBossBreakdown {
  const filled = lineup.filter((s) => s.playerSnapshot !== null);
  if (filled.length === 0) {
    return {
      overall: avgRating || 80,
      attack: avgRating || 80,
      midfield: avgRating || 80,
      defense: avgRating || 80,
      goalkeeper: avgRating || 80,
      legendaryCount: 0,
    };
  }

  const byPos = (pos: string) =>
    filled
      .filter((s) => s.slotPosition === pos)
      .map((s) => s.playerSnapshot!.rating || 80);

  const avg = (vals: number[], fallback: number) =>
    vals.length
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      : fallback;

  const overall = avg(
    filled.map((s) => s.playerSnapshot!.rating || 80),
    avgRating || 80
  );

  return {
    overall,
    attack: avg(byPos('ATQ'), overall),
    midfield: avg(byPos('MEI'), overall),
    defense: avg(byPos('DEF'), overall),
    goalkeeper: avg(byPos('GOL'), overall),
    legendaryCount: filled.filter((s) => s.playerSnapshot?.isLegendary).length,
  };
}

function LineupRosterList({
  lineup,
  accent,
}: {
  lineup: LineupSlot[];
  accent: 'emerald' | 'amber';
}) {
  const sorted = [...lineup].sort((a, b) => a.slotIndex - b.slotIndex);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {sorted.map((slot) => {
        const player = slot.playerSnapshot;
        return (
          <div
            key={`${slot.slotIndex}-${player?.id ?? 'empty'}`}
            className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-800 bg-[#070B14]/85 px-3 py-2"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`font-mono-num w-9 shrink-0 rounded-lg border py-1 text-center text-[11px] font-extrabold ${
                  accent === 'amber'
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                    : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                }`}
              >
                {slot.slotLabel}
              </span>
              {player ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-white">
                      {player.nickname}
                    </span>
                    {player.isLegendary && (
                      <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <p className="truncate text-[11px] text-slate-400">
                    {player.squadName || player.fullName}
                  </p>
                </div>
              ) : (
                <span className="text-xs text-slate-500">Vaga aberta</span>
              )}
            </div>

            {player && (
              <span
                className={`font-mono-num rounded-lg border px-2 py-0.5 text-xs font-extrabold shrink-0 ${
                  accent === 'amber'
                    ? 'border-amber-400/40 bg-amber-500/10 text-amber-300'
                    : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {player.rating}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LegendsBonusView({
  payload,
  bonusMatch,
  simulatingBonus,
  bonusError,
  onSimulateBonus,
  onBackToTournament,
  onNewCampaign,
}: LegendsBonusViewProps) {
  const { campaign, lineup, finalBoss } = payload;
  const [showListView, setShowListView] = useState<'both' | 'pitch'>('both');

  if (!finalBoss) return null;

  const userBreakdown =
    payload.userBreakdown ||
    computeClientFallbackBreakdown(lineup, campaign.avgRating);

  const sectorStats = [
    {
      label: 'GERAL',
      userVal: userBreakdown.overall,
      bossVal: finalBoss.breakdown.overall,
    },
    {
      label: 'ATQ',
      userVal: userBreakdown.attack,
      bossVal: finalBoss.breakdown.attack,
    },
    {
      label: 'MEI',
      userVal: userBreakdown.midfield,
      bossVal: finalBoss.breakdown.midfield,
    },
    {
      label: 'DEF',
      userVal: userBreakdown.defense,
      bossVal: finalBoss.breakdown.defense,
    },
    {
      label: 'GOL',
      userVal: userBreakdown.goalkeeper,
      bossVal: finalBoss.breakdown.goalkeeper,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Action Navigation Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToTournament}
          className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0E1626] px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:border-slate-500 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar à Súmula do Torneio</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center rounded-xl border border-slate-800 bg-[#0E1626] p-1">
            <button
              type="button"
              onClick={() => setShowListView('both')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                showListView === 'both'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Campo + Lista
            </button>
            <button
              type="button"
              onClick={() => setShowListView('pitch')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                showListView === 'pitch'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Apenas Campos
            </button>
          </div>

          <button
            type="button"
            disabled={simulatingBonus}
            onClick={onSimulateBonus}
            className="flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>
              {simulatingBonus
                ? 'Simulando...'
                : bonusMatch
                ? 'Simular Novamente'
                : 'Jogar Desafio Bônus'}
            </span>
          </button>

          <button
            type="button"
            onClick={onNewCampaign}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Nova Campanha</span>
          </button>
        </div>
      </div>

      {/* Hero Header Banner */}
      <div className="overflow-hidden rounded-2xl border border-amber-400/50 bg-gradient-to-br from-[#1F1306] via-[#0E1626] to-[#070B14] p-6 shadow-2xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5 max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
              <Trophy className="h-4 w-4" />
              <span>Bônus Desbloqueado · 7 Vitórias em 7 Jogos</span>
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white [text-wrap:balance]">
              {campaign.coachName} <span className="text-amber-400">×</span>{' '}
              {finalBoss.name}
            </h1>
            <p className="text-sm text-slate-300">
              Você venceu todas as 7 partidas da campanha ({campaign.wins}V{' '}
              {campaign.draws}E {campaign.losses}D · {campaign.goalsFor}:
              {campaign.goalsAgainst} gols) e liberou o confronto especial com ambas
              as escalações frente a frente.
            </p>
          </div>

          {/* Sector Comparison Strip */}
          <div className="grid grid-cols-5 gap-2 shrink-0">
            {sectorStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-800 bg-[#070B14]/85 px-3 py-2.5 text-center min-w-[64px]"
              >
                <p className="text-[10px] font-bold tracking-wider text-slate-400">
                  {stat.label}
                </p>
                <div className="mt-1 flex items-baseline justify-center gap-1 font-mono-num text-sm font-extrabold">
                  <span className="text-emerald-400">{stat.userVal}</span>
                  <span className="text-[10px] text-slate-600">×</span>
                  <span className="text-amber-300">{stat.bossVal}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {bonusError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {bonusError}
        </div>
      )}

      {/* Optional Simulated Bonus Match Result */}
      {bonusMatch && (
        <div className="rounded-2xl border border-amber-400/50 bg-[#0E1626] p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-400">
              <Swords className="h-4 w-4" />
              <span>Confronto Bônus · Campeão 7/7 vs Time de Lendas</span>
            </span>
            <span className="font-mono-num">
              Força do Time de Lendas: {bonusMatch.opponentStrength}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#070B14] px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base sm:text-lg font-bold text-white">
                {campaign.coachName}
              </p>
              <p className="text-xs text-emerald-400">Seu Esquadrão Campeão</p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`font-mono-num text-3xl sm:text-4xl font-extrabold ${
                  bonusMatch.homeScore > bonusMatch.awayScore
                    ? 'text-emerald-400'
                    : bonusMatch.homeScore === bonusMatch.awayScore
                    ? 'text-amber-300'
                    : 'text-rose-400'
                }`}
              >
                {bonusMatch.homeScore}
              </span>
              <span className="text-slate-600 font-bold text-xl">×</span>
              <span className="font-mono-num text-3xl sm:text-4xl font-extrabold text-amber-300">
                {bonusMatch.awayScore}
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 min-w-0 flex-1 text-right">
              <div className="min-w-0">
                <p className="truncate text-base sm:text-lg font-bold text-white">
                  {bonusMatch.opponentName}
                </p>
                <p className="text-xs text-amber-400">Time de Lendas</p>
              </div>
              <CrestAvatar
                src={bonusMatch.opponentCrestUrl}
                alt={bonusMatch.opponentName}
                size="sm"
              />
            </div>
          </div>

          {bonusMatch.events && bonusMatch.events.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 border-t border-slate-800 pt-3">
              {bonusMatch.events.map((ev, idx) => (
                <div
                  key={`bonus-${idx}`}
                  className="flex items-start gap-2 text-xs"
                >
                  <span className="font-mono-num w-8 shrink-0 font-bold text-slate-400">
                    {ev.minute}&apos;
                  </span>
                  <span
                    className={
                      ev.type === 'goal'
                        ? 'text-emerald-300 font-semibold'
                        : ev.type === 'opponent_goal'
                        ? 'text-amber-300 font-semibold'
                        : ev.type === 'save'
                        ? 'text-sky-300'
                        : 'text-slate-400'
                    }
                  >
                    {(ev.type === 'goal' || ev.type === 'opponent_goal') && (
                      <Goal className="mr-1 inline h-3.5 w-3.5" />
                    )}
                    <strong className="text-white">{ev.playerName}</strong> —{' '}
                    {ev.detail}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dual Lineup Side-by-Side Comparison */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Column 1: User's 7/7 Squad */}
        <section className="rounded-2xl border border-emerald-500/40 bg-[#0E1626] p-5 space-y-5 shadow-xl">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Sua Escalação · Campeão 7/7
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase text-white truncate mt-0.5">
                {campaign.coachName}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Esquema {campaign.formation} · Estilo{' '}
                <span className="capitalize">{campaign.style}</span> ·{' '}
                <span className="font-mono-num text-emerald-300 font-semibold">
                  {userBreakdown.legendaryCount} Lenda(s)
                </span>
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-center shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Geral
              </p>
              <p className="font-mono-num text-xl font-extrabold text-white">
                {userBreakdown.overall}
              </p>
            </div>
          </div>

          <TacticalPitch
            formationId={campaign.formation}
            lineup={lineup}
            difficulty="classico"
            campaignStatus="completed"
            interactive={false}
          />

          {showListView === 'both' && (
            <div className="space-y-2.5 pt-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                11 Titulares · Seu Time
              </h3>
              <LineupRosterList lineup={lineup} accent="emerald" />
            </div>
          )}
        </section>

        {/* Column 2: Time de Lendas */}
        <section className="rounded-2xl border border-amber-400/50 bg-[#0E1626] p-5 space-y-5 shadow-xl">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <CrestAvatar
                src={finalBoss.crestUrl}
                alt={finalBoss.name}
                size="md"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                  Time de Lendas · Bônus Desbloqueado
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase text-white truncate mt-0.5">
                  {finalBoss.name}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {finalBoss.serie || 'Seleção Especial'} · Esquema{' '}
                  {finalBoss.formation} ·{' '}
                  <span className="font-mono-num text-amber-300 font-semibold">
                    {finalBoss.breakdown.legendaryCount} Lenda(s)
                  </span>
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-400/50 bg-amber-500/20 px-3.5 py-2 text-center shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Geral
              </p>
              <p className="font-mono-num text-xl font-extrabold text-amber-200">
                {finalBoss.breakdown.overall}
              </p>
            </div>
          </div>

          <TacticalPitch
            formationId={finalBoss.formation}
            lineup={finalBoss.lineup}
            difficulty="classico"
            campaignStatus="completed"
            interactive={false}
          />

          {showListView === 'both' && (
            <div className="space-y-2.5 pt-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                11 Titulares · {finalBoss.name}
              </h3>
              <LineupRosterList lineup={finalBoss.lineup} accent="amber" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
