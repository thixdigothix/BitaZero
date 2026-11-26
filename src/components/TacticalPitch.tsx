import { useState } from 'react';
import { Crown, Plus } from 'lucide-react';
import { LineupSlot } from '../types/game.ts';
import { getFormation } from '../shared/gameLogic.ts';
import defaultCrestImg from '../assets/images/crest_default_club_1795098933771.jpg';

function PitchCrestImage({
  src,
  alt,
}: {
  src?: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = !failed && src && src.trim() ? src : defaultCrestImg;
  return (
    <img
      src={resolved}
      alt={alt}
      onError={() => setFailed(true)}
      className="h-full w-full rounded-[10px] object-contain p-1"
    />
  );
}

interface TacticalPitchProps {
  formationId: string;
  lineup: LineupSlot[];
  difficulty: 'classico' | 'almanaque';
  campaignStatus: string;
  highlightedSlotIndices?: number[];
  selectedSlotIndex?: number | null;
  interactive?: boolean;
  onSelectSlot?: (slotIndex: number) => void;
}

export function TacticalPitch({
  formationId,
  lineup,
  difficulty,
  campaignStatus,
  highlightedSlotIndices = [],
  selectedSlotIndex = null,
  interactive = true,
  onSelectSlot,
}: TacticalPitchProps) {
  const formation = getFormation(formationId);
  const hideRatings = difficulty === 'almanaque' && campaignStatus === 'drafting';
  const canEdit =
    interactive && (campaignStatus === 'drafting' || campaignStatus === 'ready');

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-emerald-500/30 bg-[#072A19] shadow-2xl">
      {/* Top-down Football Pitch Aspect Ratio */}
      <div className="relative w-full aspect-[4/5] sm:aspect-[5/6] pitch-surface select-none">
        {/* Crisp SVG Pitch Lines */}
        <svg
          viewBox="0 0 400 500"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {/* Outer Touchline */}
          <rect
            x="16"
            y="16"
            width="368"
            height="468"
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="2"
          />
          {/* Halfway Line */}
          <line
            x1="16"
            y1="250"
            x2="384"
            y2="250"
            stroke="rgba(255,255,255,0.24)"
            strokeWidth="2"
          />
          {/* Center Circle */}
          <circle
            cx="200"
            cy="250"
            r="46"
            fill="none"
            stroke="rgba(255,255,255,0.24)"
            strokeWidth="2"
          />
          <circle cx="200" cy="250" r="3" fill="rgba(255,255,255,0.35)" />

          {/* Top Penalty Area (Attack) */}
          <rect
            x="105"
            y="16"
            width="190"
            height="72"
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="2"
          />
          <rect
            x="148"
            y="16"
            width="104"
            height="28"
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="2"
          />
          <path
            d="M 164 88 A 42 42 0 0 0 236 88"
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="2"
          />

          {/* Bottom Penalty Area (Defense / Goalkeeper) */}
          <rect
            x="105"
            y="412"
            width="190"
            height="72"
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="2"
          />
          <rect
            x="148"
            y="456"
            width="104"
            height="28"
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="2"
          />
          <path
            d="M 164 412 A 42 42 0 0 1 236 412"
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="2"
          />
        </svg>

        {/* 11 Formation Nodes */}
        {formation.slots.map((slotDef) => {
          const slotData = lineup.find((l) => l.slotIndex === slotDef.slotIndex);
          const player = slotData?.playerSnapshot || null;
          const isHighlighted = highlightedSlotIndices.includes(slotDef.slotIndex);
          const isSelected = selectedSlotIndex === slotDef.slotIndex;

          return (
            <div
              key={slotDef.slotIndex}
              style={{
                left: `${slotDef.x}%`,
                top: `${slotDef.y}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
            >
              {player ? (
                <div className="relative flex flex-col items-center">
                  {/* Player Token */}
                  <div
                    title={`${player.nickname} · ${player.squadName}`}
                    className={`relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl border-2 transition ${
                      player.isLegendary
                        ? 'border-amber-400 bg-[#1A1508]/95 shadow-[0_0_16px_rgba(245,158,11,0.35)]'
                        : 'border-emerald-400/90 bg-[#0B1422]/95 shadow-lg'
                    }`}
                  >
                    {player.photoUrl ? (
                      <img
                        src={player.photoUrl}
                        alt={player.nickname}
                        className="h-full w-full rounded-[10px] object-cover"
                      />
                    ) : (
                      <PitchCrestImage
                        src={player.squadCrestUrl}
                        alt={player.squadName || player.nickname}
                      />
                    )}

                    {/* Rating corner badge */}
                    {!hideRatings && player.rating > 0 && (
                      <span
                        className={`font-mono-num absolute -top-1.5 -left-1.5 rounded px-1 py-0.5 text-[10px] font-bold leading-none border ${
                          player.rating >= 90
                            ? 'border-amber-400 bg-amber-500 text-slate-950'
                            : 'border-emerald-500/60 bg-slate-950 text-emerald-300'
                        }`}
                      >
                        {player.rating}
                      </span>
                    )}

                    {player.isLegendary && (
                      <Crown className="absolute -bottom-1 -right-1 h-3.5 w-3.5 text-amber-400 drop-shadow" />
                    )}
                  </div>

                  {/* Player Nameplate */}
                  <div className="mt-1 rounded bg-[#070B14]/90 px-1.5 py-0.5 text-center border border-slate-800/90 shadow-md max-w-[92px]">
                    <p className="truncate text-[11px] font-bold leading-tight text-slate-100">
                      {player.nickname}
                    </p>
                    <p className="text-[9px] font-semibold tracking-wider text-emerald-400 leading-none mt-0.5">
                      {slotDef.label}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!canEdit || !onSelectSlot}
                  onClick={() => onSelectSlot && onSelectSlot(slotDef.slotIndex)}
                  className={`flex flex-col items-center transition ${
                    canEdit && isHighlighted ? 'cursor-pointer scale-105' : ''
                  }`}
                >
                  <div
                    className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl border-2 border-dashed transition ${
                      isSelected
                        ? 'border-amber-300 bg-amber-400/25 text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.45)]'
                        : isHighlighted
                        ? 'border-emerald-300 bg-emerald-400/25 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.45)] hover:bg-emerald-400/35'
                        : 'border-white/30 bg-slate-950/45 text-slate-300 hover:border-white/60'
                    }`}
                  >
                    {isHighlighted ? (
                      <Plus className="h-4 w-4" />
                    ) : (
                      <span className="font-mono-num text-[11px] font-bold">
                        {slotDef.label}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 rounded bg-slate-950/75 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                    {slotDef.label}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
