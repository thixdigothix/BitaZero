import { Trophy, Lock, CheckCircle2 } from 'lucide-react';
import { ACHIEVEMENT_CATALOG } from '../shared/gameLogic.ts';
import { UnlockedAchievement } from '../types/game.ts';

interface AchievementsViewProps {
  unlocked: UnlockedAchievement[];
  globalCounts: Array<{ code: string; count: number }>;
  loading: boolean;
}

export function AchievementsView({
  unlocked,
  globalCounts,
  loading,
}: AchievementsViewProps) {
  const unlockedCodes = new Set(unlocked.map((u) => u.code));
  const countMap = new Map(globalCounts.map((g) => [g.code, g.count]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-slate-800 bg-[#0E1626] p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <img
            src="/assets/aistudio/trophy_clean_sheet_1795098934480__1__d7d7f4d0.png"
            alt="Galeria de Conquistas"
            className="h-16 w-16 rounded-xl object-cover border border-sky-500/30 bg-[#070B14]"
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Sala de Troféus
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase text-white">
              Conquistas da Carreira
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Complete desafios táticos e alcance a marca lendária das 7 vitórias sem sofrer gols.
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Progresso
          </p>
          <p className="font-mono-num text-3xl font-extrabold text-emerald-400">
            {unlockedCodes.size}/{ACHIEVEMENT_CATALOG.length}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-[#0E1626] p-8 text-center text-sm text-slate-400">
          Carregando conquistas...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {ACHIEVEMENT_CATALOG.map((item) => {
            const isUnlocked = unlockedCodes.has(item.code);
            const totalGlobal = countMap.get(item.code) || 0;

            return (
              <div
                key={item.code}
                className={`flex items-start justify-between gap-4 rounded-xl border p-5 transition ${
                  isUnlocked
                    ? 'border-amber-400/50 bg-gradient-to-br from-[#191408] to-[#0E1626]'
                    : 'border-slate-800 bg-[#0E1626]/70 opacity-75'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                      isUnlocked
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-slate-700 bg-[#070B14] text-slate-500'
                    }`}
                  >
                    {isUnlocked ? (
                      <Trophy className="h-5 w-5" />
                    ) : (
                      <Lock className="h-5 w-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">
                        {item.title}
                      </h2>
                      {isUnlocked && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {item.description}
                    </p>
                    <p className="font-mono-num mt-2 text-[11px] text-slate-500">
                      {totalGlobal} desbloqueio{totalGlobal === 1 ? '' : 's'} registrados
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
