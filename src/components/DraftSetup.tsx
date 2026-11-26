import { useState } from 'react';
import { Play, Shield, Eye, EyeOff, Flame, Scale } from 'lucide-react';
import {
  DIFFICULTIES,
  FORMATIONS,
  GameDifficulty,
  PlayStyle,
  STYLES,
} from '../shared/gameLogic.ts';

interface DraftSetupProps {
  defaultCoachName: string;
  totalSquads: number;
  creating: boolean;
  error: string | null;
  onCreateCampaign: (params: {
    formation: string;
    style: PlayStyle;
    difficulty: GameDifficulty;
    coachName: string;
  }) => void;
}

export function DraftSetup({
  defaultCoachName,
  totalSquads,
  creating,
  error,
  onCreateCampaign,
}: DraftSetupProps) {
  const [formation, setFormation] = useState<string>('4-3-3');
  const [style, setStyle] = useState<PlayStyle>('equilibrado');
  const [difficulty, setDifficulty] = useState<GameDifficulty>('classico');
  const [coachName, setCoachName] = useState<string>(defaultCoachName || 'Treinador');

  const selectedFormation =
    FORMATIONS.find((f) => f.id === formation) || FORMATIONS[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-[#0E1626] p-6 sm:p-8 shadow-xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Preparação Tática
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase text-white mt-1">
              Configurar Nova Campanha
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Escolha o esquema tático, a postura de jogo e o nível de informação durante o draft.
            </p>
          </div>
          <p className="font-mono-num text-xs font-semibold text-slate-300">
            {totalSquads} elencos no banco de dados
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Form Controls */}
          <div className="space-y-6 lg:col-span-8">
            {/* Coach Name */}
            <div>
              <label
                htmlFor="coach-name-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2"
              >
                Nome do Treinador / Time
              </label>
              <input
                id="coach-name-input"
                type="text"
                maxLength={40}
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
                placeholder="Ex.: Seleção do Profeta"
                className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Formation Selection */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5">
                Formação Tática
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {FORMATIONS.map((f) => {
                  const active = formation === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormation(f.id)}
                      className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                        active
                          ? 'border-emerald-500 bg-emerald-500/15 shadow-sm'
                          : 'border-slate-800 bg-[#070B14]/70 hover:border-slate-700'
                      }`}
                    >
                      <p className="font-display text-xl font-extrabold text-white">
                        {f.name}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-slate-400">
                        {f.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Style Selection */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5">
                Estilo de Jogo
              </span>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {STYLES.map((s) => {
                  const active = style === s.id;
                  const Icon =
                    s.id === 'ofensivo'
                      ? Flame
                      : s.id === 'defensivo'
                      ? Shield
                      : Scale;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyle(s.id)}
                      className={`rounded-xl border p-3.5 text-left transition cursor-pointer ${
                        active
                          ? 'border-emerald-500 bg-emerald-500/15'
                          : 'border-slate-800 bg-[#070B14]/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`h-4 w-4 ${
                            active ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        />
                        <span className="text-sm font-bold text-white">
                          {s.name}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-snug text-slate-400">
                        {s.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty Selection */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5">
                Modo de Jogo
              </span>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {DIFFICULTIES.map((d) => {
                  const active = difficulty === d.id;
                  const Icon = d.id === 'classico' ? Eye : EyeOff;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id)}
                      className={`rounded-xl border p-4 text-left transition cursor-pointer ${
                        active
                          ? 'border-amber-400 bg-amber-500/10'
                          : 'border-slate-800 bg-[#070B14]/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`h-4 w-4 ${
                            active ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        />
                        <span className="text-sm font-bold text-white">
                          {d.name}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-snug text-slate-400">
                        {d.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Mini Tactical Preview */}
          <div className="flex flex-col justify-between gap-5 lg:col-span-4">
            <div className="rounded-xl border border-emerald-500/30 bg-[#072A19] p-4">
              <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-300">
                <span>Esquema {selectedFormation.name}</span>
                <span className="font-mono-num">11 vagas</span>
              </div>

              <div className="relative aspect-[4/5] w-full rounded-lg border border-white/20 pitch-surface overflow-hidden">
                <svg
                  viewBox="0 0 100 125"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  <line
                    x1="0"
                    y1="62.5"
                    x2="100"
                    y2="62.5"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="0.8"
                  />
                  <circle
                    cx="50"
                    cy="62.5"
                    r="11"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="0.8"
                  />
                </svg>

                {selectedFormation.slots.map((slot) => (
                  <div
                    key={slot.slotIndex}
                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md border border-emerald-300/70 bg-[#070B14]/85 text-[9px] font-bold text-emerald-300"
                  >
                    {slot.label}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={creating || totalSquads === 0}
              onClick={() =>
                onCreateCampaign({
                  formation,
                  style,
                  difficulty,
                  coachName: coachName.trim() || 'Treinador',
                })
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 text-sm font-extrabold uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{creating ? 'Sorteando Elenco...' : 'Iniciar Draft (11 Rodadas)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
