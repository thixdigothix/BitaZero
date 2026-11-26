import { useEffect, useMemo, useState } from 'react';
import { Crown, Search, Shield, Swords, UserRound, Users } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { POSITIONS, PositionCode } from '../shared/gameLogic.ts';
import { CrestAvatar } from './CrestAvatar.tsx';

interface ShowcasePlayer {
  id: number;
  squadId: number;
  fullName: string;
  nickname: string;
  shirtNumber: number;
  primaryPosition: string;
  isLegendary: boolean;
  photoUrl: string | null;
}

interface ShowcaseSquad {
  id: number;
  name: string;
  season: string;
  country: string;
  competition: string | null;
  crestUrl: string | null;
  isFinalOnly: boolean;
  players: ShowcasePlayer[];
}

type SquadFilter = 'all' | 'draft' | 'boss';

const POSITION_BADGE_STYLES: Record<PositionCode, string> = {
  GOL: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  DEF: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
  MEI: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  ATQ: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
};

const POSITION_GROUP_TITLES: Record<PositionCode, string> = {
  GOL: 'Goleiros',
  DEF: 'Defensores',
  MEI: 'Meio-campistas',
  ATQ: 'Atacantes',
};

function PlayerAvatar({
  src,
  alt,
  isLegendary,
}: {
  src: string | null;
  alt: string;
  isLegendary: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border ${
        isLegendary
          ? 'border-amber-400/50 bg-amber-500/10'
          : 'border-slate-700/80 bg-[#070B14]'
      }`}
    >
      {!failed && src && src.trim() ? (
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <UserRound
          className={`h-5 w-5 ${
            isLegendary ? 'text-amber-300' : 'text-slate-500'
          }`}
        />
      )}
    </div>
  );
}

export function SquadsShowcaseView() {
  const [squads, setSquads] = useState<ShowcaseSquad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SquadFilter>('all');
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ squads: ShowcaseSquad[] }>('/api/squads');
        if (!cancelled) {
          setSquads(res.squads);
          if (res.squads.length > 0) {
            setSelectedSquadId((prev) =>
              prev && res.squads.some((s) => s.id === prev)
                ? prev
                : res.squads[0].id
            );
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Não foi possível carregar os elencos.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const draftSquadsCount = useMemo(
    () => squads.filter((s) => !s.isFinalOnly).length,
    [squads]
  );
  const bossSquadsCount = useMemo(
    () => squads.filter((s) => s.isFinalOnly).length,
    [squads]
  );
  const totalPlayersCount = useMemo(
    () => squads.reduce((acc, sq) => acc + sq.players.length, 0),
    [squads]
  );

  const filteredSquads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return squads.filter((sq) => {
      if (filter === 'draft' && sq.isFinalOnly) return false;
      if (filter === 'boss' && !sq.isFinalOnly) return false;
      if (!q) return true;
      const squadMatch =
        sq.name.toLowerCase().includes(q) ||
        sq.country.toLowerCase().includes(q) ||
        sq.season.toLowerCase().includes(q) ||
        (sq.competition || '').toLowerCase().includes(q);
      const playerMatch = sq.players.some(
        (p) =>
          p.nickname.toLowerCase().includes(q) ||
          p.fullName.toLowerCase().includes(q)
      );
      return squadMatch || playerMatch;
    });
  }, [squads, filter, search]);

  const selectedSquad = useMemo(() => {
    if (filteredSquads.length === 0) return null;
    return (
      filteredSquads.find((s) => s.id === selectedSquadId) || filteredSquads[0]
    );
  }, [filteredSquads, selectedSquadId]);

  const groupedPlayers = useMemo(() => {
    if (!selectedSquad) return [];
    return POSITIONS.map((pos) => ({
      code: pos,
      title: POSITION_GROUP_TITLES[pos],
      players: selectedSquad.players.filter(
        (p) => p.primaryPosition === pos
      ),
    })).filter((g) => g.players.length > 0);
  }, [selectedSquad]);

  const selectedLegendsCount = useMemo(
    () =>
      selectedSquad
        ? selectedSquad.players.filter((p) => p.isLegendary).length
        : 0,
    [selectedSquad]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
            Acervo Oficial · BIT A ZERO
          </p>
          <h1 className="mt-1 font-display text-4xl font-extrabold uppercase tracking-tight text-white">
            Elencos Participantes
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Conheça todos os times sorteáveis no Draft e suas escalações completas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-[#0E1626] px-4 py-2.5 text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Times no Draft
            </p>
            <p className="font-mono-num text-xl font-extrabold text-emerald-400">
              {draftSquadsCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0E1626] px-4 py-2.5 text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Atletas Cadastrados
            </p>
            <p className="font-mono-num text-xl font-extrabold text-white">
              {totalPlayersCount}
            </p>
          </div>
        </div>
      </div>

      {/* Search + Category Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar clube, série ou jogador..."
            className="w-full rounded-xl border border-slate-800 bg-[#0E1626] py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-[#0E1626] p-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              filter === 'all'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Todos ({squads.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('draft')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              filter === 'draft'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Times do Draft ({draftSquadsCount})
          </button>
          {bossSquadsCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter('boss')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                filter === 'boss'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-amber-300 hover:text-amber-200'
              }`}
            >
              <Swords className="h-3.5 w-3.5" />
              <span>Chefão Final ({bossSquadsCount})</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0E1626] p-12 text-center text-sm text-slate-400">
          Carregando elencos participantes...
        </div>
      ) : filteredSquads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0E1626]/60 p-12 text-center space-y-2">
          <Users className="mx-auto h-8 w-8 text-slate-500" />
          <p className="text-sm font-semibold text-slate-300">
            Nenhum elenco encontrado para essa busca.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Pane: Teams Directory */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#0E1626] p-3">
            <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
              {filteredSquads.map((sq) => {
                const isSelected = selectedSquad?.id === sq.id;
                const legendCount = sq.players.filter((p) => p.isLegendary).length;
                return (
                  <button
                    key={sq.id}
                    type="button"
                    onClick={() => setSelectedSquadId(sq.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition cursor-pointer ${
                      isSelected
                        ? sq.isFinalOnly
                          ? 'border-amber-400/80 bg-amber-500/10'
                          : 'border-emerald-500/80 bg-emerald-500/10'
                        : 'border-slate-800/90 bg-[#070B14]/70 hover:border-slate-700 hover:bg-[#0B1220]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CrestAvatar src={sq.crestUrl} alt={sq.name} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-white">
                            {sq.name}
                          </p>
                          {sq.isFinalOnly && (
                            <span className="shrink-0 rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                              Lendas
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-400">
                          {sq.competition || 'Elenco oficial'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-mono-num text-xs font-bold text-slate-200">
                        {sq.players.length} atletas
                      </p>
                      {legendCount > 0 && (
                        <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-semibold text-amber-300">
                          <Crown className="h-3 w-3" />
                          <span>{legendCount}</span>
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Selected Squad Exhibition */}
          {selectedSquad && (
            <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#0E1626] p-5 sm:p-6 space-y-6">
              {/* Team Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center gap-4 min-w-0">
                  <CrestAvatar
                    src={selectedSquad.crestUrl}
                    alt={selectedSquad.name}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-3xl font-extrabold uppercase tracking-tight text-white">
                        {selectedSquad.name}
                      </h2>
                      {selectedSquad.isFinalOnly ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                          <Swords className="h-3 w-3" />
                          <span>Chefão Final</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                          <Shield className="h-3 w-3" />
                          <span>Elenco do Draft</span>
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs sm:text-sm text-slate-400">
                      {[
                        selectedSquad.competition,
                        selectedSquad.season,
                        selectedSquad.country,
                      ]
                        .filter((v) => v && v.trim())
                        .join(' · ') || 'Elenco histórico oficial'}
                    </p>
                  </div>
                </div>

                {/* Position & Legend Counts (NO overalls) */}
                <div className="flex flex-wrap items-center gap-2">
                  {POSITIONS.map((pos) => {
                    const count = selectedSquad.players.filter(
                      (p) => p.primaryPosition === pos
                    ).length;
                    return (
                      <div
                        key={pos}
                        className="rounded-lg border border-slate-800 bg-[#070B14] px-2.5 py-1.5 text-center min-w-[50px]"
                      >
                        <span className="block text-[10px] font-bold uppercase text-slate-400">
                          {pos}
                        </span>
                        <span className="font-mono-num text-sm font-extrabold text-white">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                  {selectedLegendsCount > 0 && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-center min-w-[58px]">
                      <span className="block text-[10px] font-bold uppercase text-amber-300">
                        Lendas
                      </span>
                      <span className="font-mono-num text-sm font-extrabold text-amber-200">
                        {selectedLegendsCount}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Roster by Position (NO overalls) */}
              <div className="space-y-5">
                {groupedPlayers.map((group) => (
                  <div key={group.code} className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded border px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${POSITION_BADGE_STYLES[group.code]}`}
                        >
                          {group.code}
                        </span>
                        <h3 className="font-display text-lg font-bold uppercase tracking-wide text-slate-100">
                          {group.title}
                        </h3>
                      </div>
                      <span className="font-mono-num text-xs font-semibold text-slate-400">
                        {group.players.length}{' '}
                        {group.players.length === 1 ? 'jogador' : 'jogadores'}
                      </span>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {group.players.map((p) => (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                            p.isLegendary
                              ? 'border-amber-500/40 bg-amber-500/5'
                              : 'border-slate-800/90 bg-[#070B14]/70'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <PlayerAvatar
                              src={p.photoUrl}
                              alt={p.nickname}
                              isLegendary={p.isLegendary}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-white">
                                {p.nickname}
                              </p>
                              <p className="truncate text-[11px] text-slate-400">
                                {p.primaryPosition}
                                {p.isLegendary ? ' · Jogador Lendário' : ''}
                              </p>
                            </div>
                          </div>

                          {p.isLegendary && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                              <Crown className="h-3 w-3" />
                              <span>Lenda</span>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
