import { useState } from 'react';
import {
  Play,
  FastForward,
  Trophy,
  Share2,
  Check,
  RotateCcw,
  Shield,
  Goal,
  Crown,
  Swords,
  ArrowRight,
} from 'lucide-react';
import { CampaignPayload } from '../types/game.ts';
import { TOURNAMENT_STAGES } from '../shared/gameLogic.ts';
import { TacticalPitch } from './TacticalPitch.tsx';
import { CrestAvatar } from './CrestAvatar.tsx';

interface TournamentViewProps {
  payload: CampaignPayload;
  busy: boolean;
  error: string | null;
  onSimulateNext: () => void;
  onSimulateAll: () => void;
  onOpenLegendsBonus: () => void;
  onNewCampaign: () => void;
}

export function TournamentView({
  payload,
  busy,
  error,
  onSimulateNext,
  onSimulateAll,
  onOpenLegendsBonus,
  onNewCampaign,
}: TournamentViewProps) {
  const { campaign, lineup, matches, achievements } = payload;
  const [copied, setCopied] = useState(false);

  const isCompleted = campaign.status === 'completed';
  const nextStage = TOURNAMENT_STAGES[matches.length] || null;

  const handleCopyShare = async () => {
    const statusText = campaign.isPerfectSevenZero
      ? '7 A 0 PERFEITO! Campeão invicto sem sofrer nenhum gol!'
      : campaign.isChampion
      ? 'Campeão do Sete a Zero!'
      : `Eliminado após ${matches.length} jogos`;

    const summary = [
      `SETE A ZERO · Código ${campaign.shareCode}`,
      `Treinador: ${campaign.coachName}`,
      `Resultado: ${statusText}`,
      `Campanha: ${campaign.wins}V ${campaign.draws}E ${campaign.losses}D · Gols ${campaign.goalsFor}:${campaign.goalsAgainst}`,
      `Esquema: ${campaign.formation} (${campaign.style}) · Força média ${campaign.avgRating}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard fallback if restricted
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Competition Banner */}
      <div className="rounded-2xl border border-slate-800 bg-[#0E1626] p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Competição Oficial · 7 Passos Até a Taça
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase text-white mt-0.5">
              {campaign.coachName}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Esquema {campaign.formation} · Estilo{' '}
              <span className="capitalize">{campaign.style}</span> · Modo{' '}
              {campaign.difficulty === 'almanaque' ? 'Almanaque' : 'Clássico'} · Força Média{' '}
              <span className="font-mono-num font-bold text-emerald-400">
                {campaign.avgRating}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isCompleted ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onSimulateNext}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>
                    {busy
                      ? 'Simulando...'
                      : nextStage
                      ? `Jogar ${nextStage.stage.split(' · ')[0]}`
                      : 'Simular Próximo Jogo'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onSimulateAll}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#070B14] px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:opacity-50 cursor-pointer"
                >
                  <FastForward className="h-4 w-4 text-amber-400" />
                  <span>Simular Tudo</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCopyShare}
                  className="flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/25 cursor-pointer"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                  <span>{copied ? 'Resumo Copiado' : 'Compartilhar Resultado'}</span>
                </button>
                <button
                  type="button"
                  onClick={onNewCampaign}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-slate-950 transition hover:bg-emerald-400 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Nova Campanha</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 7-Match Progress Bar */}
        <div className="mt-5 grid grid-cols-7 gap-1.5">
          {TOURNAMENT_STAGES.map((stage, idx) => {
            const match = matches[idx];
            const won = match && match.homeScore > match.awayScore;
            const lost = match && match.homeScore < match.awayScore;
            const draw = match && match.homeScore === match.awayScore;

            return (
              <div
                key={stage.order}
                className={`rounded-lg border px-2 py-2 text-center ${
                  won
                    ? 'border-emerald-500/60 bg-emerald-500/15'
                    : draw
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : lost
                    ? 'border-rose-500/50 bg-rose-500/15'
                    : 'border-slate-800 bg-[#070B14]/70'
                }`}
              >
                <p className="font-mono-num text-[10px] font-bold text-slate-400">
                  J{stage.order}
                </p>
                <p className="font-mono-num text-xs font-extrabold text-white mt-0.5">
                  {match ? `${match.homeScore}-${match.awayScore}` : '—'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Final Campaign Summary Banner */}
      {isCompleted && (
        <div
          className={`overflow-hidden rounded-2xl border p-6 shadow-2xl ${
            campaign.isPerfectSevenZero
              ? 'border-amber-400/60 bg-gradient-to-br from-[#1B1406] via-[#0E1626] to-[#070B14]'
              : campaign.isChampion
              ? 'border-emerald-500/50 bg-gradient-to-br from-[#072617] via-[#0E1626] to-[#070B14]'
              : 'border-slate-700 bg-[#0E1626]'
          }`}
        >
          <div className="grid gap-6 md:grid-cols-12 md:items-center">
            <div className="md:col-span-3 flex justify-center">
              <img
                src="/assets/aistudio/trophy_clean_sheet_1795098934480__1__d7d7f4d0.png"
                alt="Troféu da Campanha"
                className="h-36 w-36 rounded-xl object-cover border border-sky-500/30 bg-[#070B14] shadow-lg"
              />
            </div>

            <div className="md:col-span-5 space-y-2">
              <p
                className={`text-xs font-bold uppercase tracking-widest ${
                  campaign.isPerfectSevenZero
                    ? 'text-amber-400'
                    : campaign.isChampion
                    ? 'text-emerald-400'
                    : 'text-slate-400'
                }`}
              >
                {campaign.isPerfectSevenZero
                  ? 'Feito Histórico Alcançado'
                  : campaign.isChampion
                  ? 'Título Conquistado'
                  : 'Fim da Campanha'}
              </p>
              <h2 className="font-display text-4xl font-extrabold uppercase text-white">
                {campaign.isPerfectSevenZero
                  ? '7 a 0 Perfeito!'
                  : campaign.isChampion
                  ? 'Campeão do Torneio'
                  : 'Eliminado na Competição'}
              </h2>
              <p className="text-sm text-slate-300">
                Saldo final:{' '}
                <strong className="font-mono-num text-white">
                  {campaign.wins}V {campaign.draws}E {campaign.losses}D
                </strong>{' '}
                · {campaign.goalsFor} gols marcados · {campaign.goalsAgainst} sofridos.
              </p>
              <p className="font-mono-num text-xs text-slate-400">
                Código da campanha: {campaign.shareCode}
              </p>
            </div>

            <div className="md:col-span-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                <span>Conquistas Desbloqueadas ({achievements.length})</span>
              </p>
              {achievements.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhuma conquista desbloqueada nesta tentativa.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {achievements.map((ach) => (
                    <div
                      key={ach.id}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2"
                    >
                      <p className="text-xs font-bold text-amber-300">
                        {ach.title}
                      </p>
                      <p className="text-[11px] text-slate-300">
                        {ach.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bonus Unlock Banner (only when winning all 7 matches) */}
      {isCompleted && campaign.wins === 7 && payload.finalBoss && (
        <div className="rounded-2xl border border-amber-400/60 bg-gradient-to-r from-[#1F1208] via-[#0E1626] to-[#0E1626] p-5 sm:p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <CrestAvatar
                src={payload.finalBoss.crestUrl}
                alt={payload.finalBoss.name}
                size="md"
              />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-400">
                  <Crown className="h-4 w-4 shrink-0" />
                  <span>Bônus Desbloqueado · 7 Vitórias em 7 Jogos</span>
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase text-white mt-0.5 truncate">
                  {payload.finalBoss.name} Liberado!
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  Veja ambas as escalações frente a frente na tela especial do desafio bônus.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenLegendsBonus}
              className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Swords className="h-4 w-4" />
              <span>Abrir Tela Bônus · Ambas as Escalações</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {isCompleted && campaign.wins < 7 && (
        <div className="rounded-xl border border-slate-800 bg-[#0E1626] px-4 py-3 text-xs text-slate-400 flex items-center justify-between gap-3">
          <span>
            Bônus secreto <strong className="text-amber-300">Time de Lendas</strong>: vença todos os 7 jogos no tempo normal para desbloquear a tela especial com ambas as escalações.
          </span>
          <span className="font-mono-num font-bold text-slate-300 shrink-0">
            {campaign.wins}/7 vitórias
          </span>
        </div>
      )}

      {/* Split: Match Feed + Final Lineup Pitch */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-7 space-y-4">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
            Súmula das Partidas ({matches.length}/7)
          </h2>

          {matches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-[#0E1626] p-8 text-center">
              <p className="text-sm text-slate-400">
                Clique em <strong>Jogar Fase de Grupos</strong> para dar o pontapé inicial na competição.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...matches].reverse().map((m) => {
                const won = m.homeScore > m.awayScore;
                const draw = m.homeScore === m.awayScore;
                const cleanSheet = m.awayScore === 0;

                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-slate-800 bg-[#0E1626] p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span
                        className={`font-bold uppercase tracking-wider ${
                          m.matchOrder === 7 ? 'text-amber-300' : 'text-emerald-400'
                        }`}
                      >
                        Jogo {m.matchOrder} · {m.stage}
                      </span>
                      <div className="flex items-center gap-3">
                        {cleanSheet && (
                          <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                            <Shield className="h-3.5 w-3.5" />
                            Sem sofrer gols
                          </span>
                        )}
                        <span className="font-mono-num">
                          Força rival: {m.opponentStrength}
                        </span>
                      </div>
                    </div>

                    {/* Scoreboard */}
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800/80 bg-[#070B14] px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm sm:text-base font-bold text-white">
                          {campaign.coachName}
                        </p>
                        <p className="text-[11px] text-slate-400">Seu time</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`font-mono-num text-2xl sm:text-3xl font-extrabold ${
                            won
                              ? 'text-emerald-400'
                              : draw
                              ? 'text-amber-300'
                              : 'text-rose-400'
                          }`}
                        >
                          {m.homeScore}
                        </span>
                        <span className="text-slate-600 font-bold">×</span>
                        <span className="font-mono-num text-2xl sm:text-3xl font-extrabold text-slate-200">
                          {m.awayScore}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-2.5 min-w-0 flex-1 text-right">
                        <div className="min-w-0">
                          <p className="truncate text-sm sm:text-base font-bold text-white">
                            {m.opponentName}
                          </p>
                          <p className="text-[11px] text-slate-400">Adversário</p>
                        </div>
                        <CrestAvatar
                          src={m.opponentCrestUrl}
                          alt={m.opponentName}
                          size="sm"
                        />
                      </div>
                    </div>

                    {m.penaltyNote && (
                      <p className="text-xs font-semibold text-amber-300">
                        {m.penaltyNote}
                      </p>
                    )}

                    {/* Match Events Timeline */}
                    {m.events && m.events.length > 0 && (
                      <div className="space-y-1.5 border-t border-slate-800/80 pt-3">
                        {m.events.map((ev, idx) => (
                          <div
                            key={`${m.id}-${idx}`}
                            className="flex items-start gap-2.5 text-xs"
                          >
                            <span className="font-mono-num w-8 shrink-0 font-bold text-slate-400">
                              {ev.minute}&apos;
                            </span>
                            <span
                              className={
                                ev.type === 'goal'
                                  ? 'text-emerald-300 font-semibold'
                                  : ev.type === 'opponent_goal'
                                  ? 'text-rose-300 font-semibold'
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
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-3">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
            Escalação Titular
          </h2>
          <TacticalPitch
            formationId={campaign.formation}
            lineup={lineup}
            difficulty={campaign.difficulty}
            campaignStatus={campaign.status}
            interactive={false}
          />
        </div>
      </div>
    </div>
  );
}
