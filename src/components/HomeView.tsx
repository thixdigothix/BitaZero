import { Play, Users, Trophy, ArrowRight, RotateCcw } from 'lucide-react';
import { Campaign, Squad } from '../types/game.ts';
import { CrestAvatar } from './CrestAvatar.tsx';
import heroStadiumImg from '../assets/images/hero_stadium_pitch_1795098933765.jpg';

interface HomeViewProps {
  totalSquads: number;
  totalPlayers: number;
  recentSquads: Squad[];
  recentCampaigns: Campaign[];
  bestCampaigns: Campaign[];
  activeDraft: Campaign | null;
  loading: boolean;
  onStartPlay: () => void;
  onResumeDraft: (campaignId: number) => void;
  onOpenSquads: () => void;
  onOpenCampaign: (campaignId: number) => void;
}

export function HomeView({
  totalSquads,
  totalPlayers,
  recentSquads,
  recentCampaigns,
  bestCampaigns,
  activeDraft,
  loading,
  onStartPlay,
  onResumeDraft,
  onOpenSquads,
  onOpenCampaign,
}: HomeViewProps) {
  return (
    <div className="space-y-8">
      {/* Stadium Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0E1626] shadow-2xl">
        <div className="absolute inset-0">
          <img
            src={heroStadiumImg}
            alt="Estádio Sete a Zero"
            className="h-full w-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070B14] via-[#070B14]/90 to-[#070B14]/55" />
        </div>

        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 space-y-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
              Desafio BitFut · 7 Vitórias com elencos lendários
            </p>
            <h1 className="font-display text-5xl sm:text-6xl font-extrabold uppercase tracking-tight text-white leading-[0.95]">
              Monte seu esquadrão. Busque o <span className="text-emerald-400">7 a 0</span>.
            </h1>
            <p className="max-w-xl text-sm sm:text-base text-slate-300 leading-relaxed">
              A cada rodada de draft um elenco histórico do banco de dados é sorteado.
              Escolha 1 jogador por vez respeitando a formação tática e enfrente sete
              partidas eliminatórias até o título perfeito.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onStartPlay}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm sm:text-base font-extrabold uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 cursor-pointer"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>Jogar Agora</span>
              </button>

              {activeDraft && (
                <button
                  type="button"
                  onClick={() => onResumeDraft(activeDraft.id)}
                  className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/15 px-5 py-3.5 text-sm font-bold text-amber-200 transition hover:bg-amber-500/25 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Retomar Campanha ({activeDraft.formation})</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenSquads}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0B1220]/90 px-5 py-3.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white cursor-pointer"
              >
                <Users className="h-4 w-4 text-emerald-400" />
                <span>Ver Elencos</span>
              </button>
            </div>
          </div>

          {/* Right Summary Card */}
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#070B14]/85 backdrop-blur-sm">
              <div className="flex items-center gap-4 border-b border-slate-800 p-4">
                <img
                  src="/assets/aistudio/trophy_clean_sheet_1795098934480__1__d7d7f4d0.png"
                  alt="Troféu BitFut"
                  className="h-16 w-16 rounded-lg object-cover border border-sky-500/30 bg-[#070B14] shrink-0"
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Acervo de Elencos
                  </p>
                  <p className="font-display text-2xl font-bold text-white">
                    <span className="font-mono-num">{totalSquads}</span> Elencos ·{' '}
                    <span className="font-mono-num">{totalPlayers}</span> Atletas
                  </p>
                  <p className="text-xs text-slate-400">
                    Elencos históricos selecionados para o Draft
                  </p>
                </div>
              </div>

              <div className="p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Elencos disponíveis no sorteio
                </p>
                {loading ? (
                  <p className="text-xs text-slate-500">Carregando acervo...</p>
                ) : recentSquads.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Nenhum elenco disponível no momento.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {recentSquads.slice(0, 4).map((sq) => (
                      <div
                        key={sq.id}
                        className="flex items-center gap-2.5 rounded-lg border border-slate-800/90 bg-[#0E1626]/80 p-2"
                      >
                        <CrestAvatar src={sq.crestUrl} alt={sq.name} size="xs" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-100">
                            {sq.name}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {sq.competition || 'Elenco oficial'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Two-Column Campaign History: Recent & Best */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Recent Campaigns */}
        <div className="rounded-xl border border-slate-800 bg-[#0E1626] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
                Últimas Campanhas
              </h2>
              <p className="text-xs text-slate-400">
                Resultados recentes registrados na competição
              </p>
            </div>
          </div>

          {recentCampaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 bg-[#070B14]/60 p-6 text-center">
              <p className="text-sm text-slate-400">
                Nenhuma campanha finalizada ainda. Seja o primeiro a completar os 7 jogos.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {recentCampaigns.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOpenCampaign(c.id)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-slate-800/30 px-2 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {c.coachName} ·{' '}
                      <span className="text-slate-400 font-normal">
                        {c.formation} · {c.difficulty === 'almanaque' ? 'Almanaque' : 'Clássico'}
                      </span>
                    </p>
                    <p className="font-mono-num text-xs text-slate-400 mt-0.5">
                      {c.wins}V {c.draws}E {c.losses}D · Gols {c.goalsFor}:{c.goalsAgainst} · Força{' '}
                      {c.avgRating}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-bold ${
                        c.isPerfectSevenZero
                          ? 'text-amber-400'
                          : c.isChampion
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {c.isPerfectSevenZero
                        ? '7 a 0 Perfeito'
                        : c.isChampion
                        ? 'Campeão'
                        : 'Eliminado'}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Best Results */}
        <div className="rounded-xl border border-slate-800 bg-[#0E1626] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                <span>Melhores Resultados</span>
              </h2>
              <p className="text-xs text-slate-400">
                Ranking por títulos, vitórias e baliza zerada
              </p>
            </div>
          </div>

          {bestCampaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 bg-[#070B14]/60 p-6 text-center">
              <p className="text-sm text-slate-400">
                O pódio aguarda o primeiro campeão da temporada.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {bestCampaigns.slice(0, 6).map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOpenCampaign(c.id)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-slate-800/30 px-2 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`font-mono-num flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold shrink-0 ${
                        idx === 0
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {c.coachName}
                      </p>
                      <p className="font-mono-num text-xs text-slate-400">
                        {c.formation} · {c.wins} vitórias · {c.goalsAgainst} sofridos
                      </p>
                    </div>
                  </div>

                  <span
                    className={`font-mono-num text-xs font-bold shrink-0 ${
                      c.isPerfectSevenZero
                        ? 'text-amber-400'
                        : c.isChampion
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {c.isPerfectSevenZero
                      ? '7-0'
                      : c.isChampion
                      ? 'TAÇA'
                      : `${c.wins}V`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
