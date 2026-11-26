import { useMemo, useState } from 'react';
import {
  Crown,
  RefreshCw,
  CheckCircle2,
  Play,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { CampaignPayload, LineupSlot, Player } from '../types/game.ts';
import {
  isPlayerCompatibleWithSlot,
  normalizeNickname,
  POSITION_NAMES,
  PositionCode,
} from '../shared/gameLogic.ts';
import { TacticalPitch } from './TacticalPitch.tsx';
import { CrestAvatar } from './CrestAvatar.tsx';

interface DraftWorkspaceProps {
  payload: CampaignPayload;
  busy: boolean;
  error: string | null;
  onPickPlayer: (playerId: number, slotIndex: number) => void;
  onSkipSquad: () => void;
  onStartTournament: () => void;
  onNewDraft: () => void;
}

export function DraftWorkspace({
  payload,
  busy,
  error,
  onPickPlayer,
  onSkipSquad,
  onStartTournament,
  onNewDraft,
}: DraftWorkspaceProps) {
  const { campaign, lineup, currentSquad } = payload;
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  const filledCount = lineup.filter((s) => s.playerSnapshot !== null).length;
  const pickedPlayerIds = useMemo(
    () => new Set(lineup.map((s) => s.playerId).filter((id): id is number => !!id)),
    [lineup]
  );

  const pickedNicknames = useMemo(
    () =>
      new Set(
        lineup
          .map((s) => s.playerSnapshot?.nickname)
          .filter((nick): nick is string => Boolean(nick))
          .map((nick) => normalizeNickname(nick))
      ),
    [lineup]
  );

  const emptySlots = useMemo(
    () => lineup.filter((s) => !s.playerSnapshot),
    [lineup]
  );

  const getCompatibleSlotsForPlayer = (player: Player): LineupSlot[] => {
    if (pickedPlayerIds.has(player.id)) return [];
    if (pickedNicknames.has(normalizeNickname(player.nickname))) return [];
    return emptySlots.filter((slot) =>
      isPlayerCompatibleWithSlot(player.primaryPosition, slot.slotPosition)
    );
  };

  const selectedPlayer = useMemo(() => {
    if (!currentSquad || !selectedPlayerId) return null;
    return currentSquad.players.find((p) => p.id === selectedPlayerId) || null;
  }, [currentSquad, selectedPlayerId]);

  const highlightedSlotIndices = useMemo(() => {
    if (!selectedPlayer) return [];
    return getCompatibleSlotsForPlayer(selectedPlayer).map((s) => s.slotIndex);
  }, [selectedPlayer, emptySlots, pickedPlayerIds, pickedNicknames]);

  const handlePlayerClick = (player: Player) => {
    if (busy || campaign.status !== 'drafting') return;
    const compatible = getCompatibleSlotsForPlayer(player);
    if (compatible.length === 0) return;

    if (compatible.length === 1) {
      setSelectedPlayerId(null);
      onPickPlayer(player.id, compatible[0].slotIndex);
      return;
    }

    setSelectedPlayerId((prev) => (prev === player.id ? null : player.id));
  };

  const handleSlotSelect = (slotIndex: number) => {
    if (busy || !selectedPlayer) return;
    if (!highlightedSlotIndices.includes(slotIndex)) return;
    setSelectedPlayerId(null);
    onPickPlayer(selectedPlayer.id, slotIndex);
  };

  const hideRatings =
    campaign.difficulty === 'almanaque' && campaign.status === 'drafting';

  const partialAvg = useMemo(() => {
    const filled = lineup.filter((s) => s.playerSnapshot && s.playerSnapshot.rating > 0);
    if (filled.length === 0) return 0;
    return Math.round(
      filled.reduce((acc, s) => acc + (s.playerSnapshot?.rating || 0), 0) /
        filled.length
    );
  }, [lineup]);

  return (
    <div className="space-y-5">
      {/* Top Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#0E1626] px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Treinador
            </p>
            <p className="text-sm font-bold text-white">{campaign.coachName}</p>
          </div>
          <div className="h-7 w-px bg-slate-800" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Formação · Estilo
            </p>
            <p className="text-sm font-bold text-emerald-400">
              {campaign.formation} ·{' '}
              <span className="capitalize text-slate-200">{campaign.style}</span>
            </p>
          </div>
          <div className="h-7 w-px bg-slate-800" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Modo
            </p>
            <p className="text-sm font-bold text-amber-300">
              {campaign.difficulty === 'almanaque' ? 'Almanaque' : 'Clássico'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Escalação
            </p>
            <p className="font-mono-num text-base font-extrabold text-white">
              {filledCount}/11{' '}
              {!hideRatings && partialAvg > 0 && (
                <span className="text-xs font-semibold text-emerald-400">
                  · Média {partialAvg}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onNewDraft}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
          >
            Reiniciar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main 2-Column Split: Tactical Pitch Left + Drawn Squad Right */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left: Tactical Pitch */}
        <div className="lg:col-span-5 space-y-3">
          <TacticalPitch
            formationId={campaign.formation}
            lineup={lineup}
            difficulty={campaign.difficulty}
            campaignStatus={campaign.status}
            highlightedSlotIndices={highlightedSlotIndices}
            onSelectSlot={handleSlotSelect}
          />
        </div>

        {/* Right: Current Drawn Squad OR Ready Screen */}
        <div className="lg:col-span-7">
          {campaign.status === 'ready' || filledCount === 11 ? (
            <div className="rounded-2xl border border-emerald-500/40 bg-[#0E1626] p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle2 className="h-7 w-7" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest">
                    Time Fechado
                  </p>
                  <h2 className="font-display text-3xl font-extrabold uppercase text-white">
                    11 Titulares Escalados
                  </h2>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                Seu elenco está pronto para enfrentar as 7 partidas da competição:
                3 jogos da fase de grupos, oitavas, quartas, semifinal e a grande final.
              </p>

              <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-800 bg-[#070B14] p-4 text-center">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">
                    Força Média
                  </p>
                  <p className="font-mono-num text-2xl font-extrabold text-emerald-400">
                    {campaign.avgRating || partialAvg}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">
                    Formação
                  </p>
                  <p className="font-mono-num text-2xl font-extrabold text-white">
                    {campaign.formation}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">
                    Trocas Restantes
                  </p>
                  <p className="font-mono-num text-2xl font-extrabold text-amber-300">
                    {campaign.skipsRemaining}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={onStartTournament}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 text-base font-extrabold uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>Iniciar Competição (7 Partidas)</span>
              </button>
            </div>
          ) : currentSquad ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0E1626] p-5 sm:p-6 space-y-5 shadow-xl">
              {/* Drawn Squad Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <CrestAvatar
                    src={currentSquad.crestUrl}
                    alt={currentSquad.name}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                        Elenco Sorteado · Rodada {filledCount + 1}/11
                      </span>
                      {currentSquad.isExample && (
                        <span className="text-[11px] font-medium text-amber-300">
                          · Exemplo inicial
                        </span>
                      )}
                    </div>
                    <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase text-white truncate">
                      {currentSquad.name}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {currentSquad.competition || 'Elenco disponível para o draft'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy || campaign.skipsRemaining <= 0}
                  onClick={() => {
                    setSelectedPlayerId(null);
                    onSkipSquad();
                  }}
                  className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-40 cursor-pointer shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Trocar Elenco ({campaign.skipsRemaining}/3)</span>
                </button>
              </div>

              {/* Multi-slot selection prompt */}
              {selectedPlayer && highlightedSlotIndices.length > 1 && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 space-y-2.5">
                  <p className="text-xs font-semibold text-emerald-200">
                    Selecione em qual vaga do campo escalar{' '}
                    <strong className="text-white">{selectedPlayer.nickname}</strong>:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {getCompatibleSlotsForPlayer(selectedPlayer).map((slot) => (
                      <button
                        key={slot.slotIndex}
                        type="button"
                        disabled={busy}
                        onClick={() => handleSlotSelect(slot.slotIndex)}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                      >
                        Escalar em {slot.slotLabel} (Vaga #{slot.slotIndex + 1})
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedPlayerId(null)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Squad Players Grid */}
              <div className="grid gap-2.5 sm:grid-cols-2">
                {currentSquad.players.map((player) => {
                  const alreadyPicked = pickedPlayerIds.has(player.id);
                  const duplicateNickname =
                    !alreadyPicked &&
                    pickedNicknames.has(normalizeNickname(player.nickname));
                  const compatibleSlots = getCompatibleSlotsForPlayer(player);
                  const canPick =
                    !alreadyPicked &&
                    !duplicateNickname &&
                    compatibleSlots.length > 0;
                  const isSelected = selectedPlayerId === player.id;

                  return (
                    <button
                      key={player.id}
                      type="button"
                      disabled={busy || !canPick}
                      onClick={() => handlePlayerClick(player)}
                      className={`group flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-400'
                          : canPick
                          ? 'border-slate-800 bg-[#070B14]/80 hover:border-emerald-500/60 hover:bg-slate-900 cursor-pointer'
                          : 'border-slate-800/50 bg-[#070B14]/35 opacity-45 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-[#0E1626]">
                          {player.photoUrl ? (
                            <img
                              src={player.photoUrl}
                              alt={player.nickname}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="font-mono-num text-xs font-extrabold text-emerald-400">
                              {player.primaryPosition}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-bold text-white">
                              {player.nickname}
                            </span>
                            {player.isLegendary && (
                              <Crown
                                className="h-3.5 w-3.5 shrink-0 text-amber-400"
                                aria-label="Jogador lendário"
                              />
                            )}
                          </div>

                          <p className="truncate text-[11px] text-slate-400">
                            <span className="font-semibold text-emerald-400">
                              {player.primaryPosition}
                            </span>
                          </p>

                          {!canPick && (
                            <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                              {alreadyPicked
                                ? 'Já escalado no time'
                                : duplicateNickname
                                ? 'Apelido já escalado no time'
                                : `Sem vaga para ${
                                    POSITION_NAMES[player.primaryPosition as PositionCode] ||
                                    player.primaryPosition
                                  }`}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {hideRatings || player.rating === null ? (
                          <span className="font-mono-num text-xs font-bold text-amber-300">
                            ??
                          </span>
                        ) : (
                          <span
                            className={`font-mono-num inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-extrabold ${
                              player.rating >= 90
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {player.rating}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>
                  Apenas a posição principal é aceita em cada vaga. Jogadores repetidos não podem ser escalados.
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-[#0E1626] p-8 text-center">
              <p className="text-sm text-slate-300">
                Nenhum elenco disponível para esta rodada. Tente iniciar uma nova campanha.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
