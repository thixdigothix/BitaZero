import {
  Crown,
  HelpCircle,
  Play,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { ACHIEVEMENT_CATALOG, FORMATIONS } from '../shared/gameLogic.ts';

interface HowItWorksViewProps {
  onStartPlay: () => void;
}

const STEPS = [
  {
    number: '01',
    title: 'Defina sua Tática e Dificuldade',
    description:
      'Antes de começar o draft, escolha o nome do treinador, uma das 6 formações disponíveis, o estilo de jogo e o nível de informação.',
    icon: SlidersHorizontal,
    highlights: [
      'Formações: 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 3-4-3 e 4-5-1.',
      'Estilos: Ofensivo (mais ataque), Equilibrado ou Defensivo (mais proteção lá atrás).',
      'Modo Clássico mostra as notas dos atletas; modo Almanaque oculta os ratings durante o draft.',
    ],
  },
  {
    number: '02',
    title: 'Monte os 11 Titulares no Draft',
    description:
      'A cada rodada um elenco cadastrado é sorteado. Selecione apenas 1 jogador por rodada respeitando a posição principal de cada vaga.',
    icon: Users,
    highlights: [
      'Posições principais: GOL (Goleiro), DEF (Defesa), MEI (Meio-Campo) e ATQ (Ataque).',
      'Você possui até 3 trocas por campanha para pular um elenco sorteado.',
      'Não é permitido repetir jogadores com o mesmo apelido no mesmo elenco do draft.',
    ],
  },
  {
    number: '03',
    title: 'Supere 7 Partidas Até a Taça',
    description:
      'Com os 11 escolhidos, começa a competição oficial em duas fases: grupos e mata-mata em jogo único.',
    icon: Swords,
    highlights: [
      'Jogos 1 a 3 (Fase de Grupos): some pelo menos 3 pontos para avançar às oitavas.',
      'Jogos 4 a 7 (Oitavas, Quartas, Semifinal e Final): empate leva para os pênaltis.',
      'Overall médio, setores, estilo tático e jogadores lendários influenciam os placares, mantendo a imprevisibilidade do futebol.',
    ],
  },
  {
    number: '04',
    title: 'Desbloqueie o Time de Lendas',
    description:
      'Quem consegue fechar uma campanha impecável recebe uma recompensa especial fora do torneio comum.',
    icon: Crown,
    highlights: [
      'Jogadores lendários (coroa dourada) aumentam suas chances de vitória e de avançar nos pênaltis.',
      'Vença todos os 7 jogos no tempo normal para liberar a tela bônus com a sua escalação frente a frente com o Time de Lendas.',
      'Na tela bônus, você também pode simular um confronto extra contra o Time de Lendas.',
    ],
  },
];

export function HowItWorksView({ onStartPlay }: HowItWorksViewProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header Banner */}
      <section className="rounded-2xl border border-slate-800 bg-[#0E1626] p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2 max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400">
              <HelpCircle className="h-4 w-4" />
              <span>Guia do Jogo · Regras Oficiais</span>
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white [text-wrap:balance]">
              Como funciona o BIT A ZERO
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Monte uma seleção em 11 rodadas de draft com elencos reais do canal,
              equilibre ataque e defesa e tente vencer os sete jogos da competição.
            </p>
          </div>

          <button
            type="button"
            onClick={onStartPlay}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3.5 text-sm font-extrabold uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Começar a Jogar</span>
          </button>
        </div>
      </section>

      {/* 4-Step Walkthrough */}
      <section className="grid gap-5 md:grid-cols-2">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.number}
              className="rounded-2xl border border-slate-800 bg-[#0E1626] p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-mono-num text-xs font-bold text-emerald-400">
                    Passo {step.number}
                  </p>
                  <h2 className="font-display text-2xl font-extrabold uppercase text-white">
                    {step.title}
                  </h2>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                {step.description}
              </p>

              <ul className="space-y-2 border-t border-slate-800/80 pt-3.5 text-xs text-slate-300">
                {step.highlights.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="font-mono-num mt-0.5 text-emerald-400 font-bold">
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {/* Quick Reference Strip: Tournament Rules & Formations */}
      <section className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#0E1626] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2 className="font-display text-2xl font-bold uppercase text-white">
              Conquistas e Desafio 7×0
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-300">
            Além da taça, cada campanha avalia objetivos especiais que ficam registrados
            na sua Sala de Troféus:
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {ACHIEVEMENT_CATALOG.map((ach) => (
              <div
                key={ach.code}
                className="rounded-xl border border-slate-800 bg-[#070B14]/80 p-3"
              >
                <p className="text-xs font-bold text-amber-300">{ach.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {ach.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#0E1626] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            <h2 className="font-display text-2xl font-bold uppercase text-white">
              Formações & Regras Rápidas
            </h2>
          </div>

          <div className="space-y-2">
            {FORMATIONS.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#070B14]/80 px-3.5 py-2.5 text-xs"
              >
                <span className="font-mono-num font-extrabold text-emerald-400 shrink-0">
                  {f.name}
                </span>
                <span className="text-slate-300 truncate">{f.description}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-[#070B14]/80 px-3.5 py-3 text-xs text-slate-300">
            <RefreshCw className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              Dica: durante o draft, clique em qualquer jogador escalado no campo se
              quiser remover e trocar antes de iniciar o torneio.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
