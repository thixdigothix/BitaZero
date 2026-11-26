import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Download,
  Copy,
  Check,
  Sparkles,
  FileJson,
  Database,
  ClipboardPaste,
  Edit3,
  Layers,
  Crown,
  Upload,
} from 'lucide-react';
import {
  normalizePosition,
  POSITIONS,
  PositionCode,
} from '../shared/gameLogic.ts';
import { compressImageFileToDataUri } from '../lib/api.ts';
import { CrestAvatar } from './CrestAvatar.tsx';

export interface QuickPlayerDraft {
  tempId: string;
  nickname: string;
  fullName: string;
  primaryPosition: PositionCode;
  rating: number;
  isLegendary: boolean;
  photoUrl: string;
}

export interface QuickSquadDraft {
  tempId: string;
  name: string;
  serie: string;
  crestUrl: string;
  isFinalOnly: boolean;
  players: QuickPlayerDraft[];
}

interface QuickSquadBuilderProps {
  isAdmin: boolean;
  savingToDb: boolean;
  onSaveToDatabase?: (items: Array<ReturnType<typeof toExportSquad>>) => Promise<void>;
}

const STORAGE_KEY = 'sete_a_zero_quick_squads_v1';

const BASE_ELEVEN_TEMPLATE: PositionCode[] = [
  'GOL',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'MEI',
  'MEI',
  'MEI',
  'ATQ',
  'ATQ',
  'ATQ',
];

function makeTempId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyPlayer(
  primaryPosition: PositionCode = 'MEI'
): QuickPlayerDraft {
  return {
    tempId: makeTempId(),
    nickname: '',
    fullName: '',
    primaryPosition,
    rating: 82,
    isLegendary: false,
    photoUrl: '',
  };
}

function createEmptySquad(): QuickSquadDraft {
  return {
    tempId: makeTempId(),
    name: '',
    serie: '',
    crestUrl: '',
    isFinalOnly: false,
    players: [
      createEmptyPlayer('GOL'),
      createEmptyPlayer('DEF'),
      createEmptyPlayer('MEI'),
      createEmptyPlayer('ATQ'),
    ],
  };
}

export function toExportSquad(squad: QuickSquadDraft) {
  return {
    name: squad.name.trim(),
    serie: squad.serie.trim() || null,
    crestUrl: squad.crestUrl.trim() || null,
    isFinalOnly: Boolean(squad.isFinalOnly),
    players: squad.players
      .filter((p) => p.nickname.trim().length > 0)
      .map((p) => ({
        fullName: p.fullName.trim() || p.nickname.trim(),
        nickname: p.nickname.trim(),
        primaryPosition: p.primaryPosition,
        rating: Math.max(1, Math.min(100, Number(p.rating) || 80)),
        isLegendary: Boolean(p.isLegendary),
        photoUrl: p.photoUrl.trim() || null,
      })),
  };
}

function parseQuickTextLines(text: string): QuickPlayerDraft[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: QuickPlayerDraft[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const clean = raw.replace(/^[-•*]\s*/, '');
    const parts = clean
      .split(/\s*[—–;|,]\s*|\s+-\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length === 0) continue;

    let nickname = '';
    let primaryPosition: PositionCode = 'MEI';
    let rating = 82;
    let isLegendary = false;

    const remaining: string[] = [];
    for (const token of parts) {
      if (/^\d{1,3}$/.test(token)) {
        const num = Number(token);
        if (num >= 1 && num <= 100) {
          if (num >= 40 || remaining.length > 0) {
            rating = num;
          }
          continue;
        }
      }

      const normPos = normalizePosition(token);
      if (normPos) {
        primaryPosition = normPos;
        continue;
      }

      if (['lenda', 'lendario', 'lendário', 'true', 'star', '★'].includes(token.toLowerCase())) {
        isLegendary = true;
        continue;
      }

      remaining.push(token);
    }

    nickname = remaining[0] || '';
    if (!nickname) continue;

    parsed.push({
      tempId: makeTempId(),
      nickname,
      fullName: remaining[1] || '',
      primaryPosition,
      rating,
      isLegendary,
      photoUrl: '',
    });
  }

  return parsed;
}

export function QuickSquadBuilder({
  isAdmin,
  savingToDb,
  onSaveToDatabase,
}: QuickSquadBuilderProps) {
  const [draft, setDraft] = useState<QuickSquadDraft>(() => createEmptySquad());
  const [queue, setQueue] = useState<QuickSquadDraft[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item: any) => ({
        tempId: item.tempId || makeTempId(),
        name: String(item.name || ''),
        serie: String(item.serie ?? item.competition ?? ''),
        crestUrl: String(item.crestUrl || ''),
        isFinalOnly: Boolean(item.isFinalOnly),
        players: Array.isArray(item.players) ? item.players : [],
      }));
    } catch {
      return [];
    }
  });

  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // Ignore storage quota errors
    }
  }, [queue]);

  const validPlayersCount = draft.players.filter(
    (p) => p.nickname.trim().length > 0
  ).length;

  const updatePlayer = (
    tempId: string,
    patch: Partial<QuickPlayerDraft>
  ) => {
    setDraft((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.tempId === tempId ? { ...p, ...patch } : p
      ),
    }));
  };

  const removePlayer = (tempId: string) => {
    setDraft((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.tempId !== tempId),
    }));
  };

  const handleAddEmptyRow = () => {
    setDraft((prev) => ({
      ...prev,
      players: [...prev.players, createEmptyPlayer('MEI')],
    }));
  };

  const handleFillBaseEleven = () => {
    setDraft((prev) => {
      const existingNonEmpty = prev.players.filter((p) => p.nickname.trim().length > 0);
      if (existingNonEmpty.length > 0) {
        const existingCount = existingNonEmpty.length;
        const extra = BASE_ELEVEN_TEMPLATE.slice(existingCount).map((pos) =>
          createEmptyPlayer(pos)
        );
        return {
          ...prev,
          players: [...existingNonEmpty, ...extra],
        };
      }
      return {
        ...prev,
        players: BASE_ELEVEN_TEMPLATE.map((pos) => createEmptyPlayer(pos)),
      };
    });
    setFeedback({
      type: 'ok',
      text: '11 posições titulares preenchidas na tabela. Agora digite apelidos e notas.',
    });
  };

  const handleApplyPaste = () => {
    const converted = parseQuickTextLines(pasteText);
    if (converted.length === 0) {
      setFeedback({
        type: 'err',
        text: 'Nenhuma linha válida encontrada. Use o formato: Neymar — ATQ — 96',
      });
      return;
    }
    setDraft((prev) => {
      const existingNonEmpty = prev.players.filter((p) => p.nickname.trim().length > 0);
      return {
        ...prev,
        players: [...existingNonEmpty, ...converted],
      };
    });
    setPasteText('');
    setPasteMode(false);
    setFeedback({
      type: 'ok',
      text: `${converted.length} jogador(es) adicionado(s) a partir da lista.`,
    });
  };

  const validateCurrentDraft = (): string | null => {
    if (!draft.name.trim()) {
      return 'Preencha o Nome do Clube/Seleção antes de exportar ou salvar.';
    }
    if (validPlayersCount === 0) {
      return 'Adicione pelo menos um jogador com apelido preenchido.';
    }
    return null;
  };

  const handleAddToQueue = () => {
    const err = validateCurrentDraft();
    if (err) {
      setFeedback({ type: 'err', text: err });
      return;
    }
    const existingIdx = queue.findIndex((q) => q.tempId === draft.tempId);
    if (existingIdx >= 0) {
      setQueue((prev) => prev.map((q) => (q.tempId === draft.tempId ? draft : q)));
      setFeedback({
        type: 'ok',
        text: `Elenco "${draft.name}" atualizado na fila de exportação.`,
      });
    } else {
      setQueue((prev) => [draft, ...prev]);
      setFeedback({
        type: 'ok',
        text: `Elenco "${draft.name}" adicionado à fila. Formulário pronto para o próximo.`,
      });
    }
    setDraft(createEmptySquad());
  };

  const downloadJson = (data: unknown, filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSingleJson = () => {
    const err = validateCurrentDraft();
    if (err) {
      setFeedback({ type: 'err', text: err });
      return;
    }
    const exported = [toExportSquad(draft)];
    const slug = draft.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    downloadJson(exported, `${slug || 'elenco'}.json`);
    setFeedback({ type: 'ok', text: `JSON de "${draft.name}" baixado.` });
  };

  const handleCopySingleJson = async () => {
    const err = validateCurrentDraft();
    if (err) {
      setFeedback({ type: 'err', text: err });
      return;
    }
    const json = JSON.stringify([toExportSquad(draft)], null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopiedKey('single');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setFeedback({ type: 'err', text: 'Não foi possível copiar automaticamente.' });
    }
  };

  const handleExportQueueJson = () => {
    if (queue.length === 0) {
      setFeedback({ type: 'err', text: 'A fila de exportação está vazia.' });
      return;
    }
    const payload = queue.map(toExportSquad);
    downloadJson(payload, 'sete-a-zero-elencos-criados.json');
    setFeedback({
      type: 'ok',
      text: `${queue.length} elenco(s) exportado(s) em JSON.`,
    });
  };

  const handleCopyQueueJson = async () => {
    if (queue.length === 0) return;
    const json = JSON.stringify(queue.map(toExportSquad), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopiedKey('queue');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setFeedback({ type: 'err', text: 'Não foi possível copiar automaticamente.' });
    }
  };

  const handleImportJsonToQueue = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : parsed.squads || [];
      const loaded: QuickSquadDraft[] = arr
        .filter((item: any) => item && item.name)
        .map((item: any) => ({
          tempId: makeTempId(),
          name: String(item.name),
          serie: item.serie
            ? String(item.serie)
            : item.competition
            ? String(item.competition)
            : '',
          crestUrl: item.crestUrl ? String(item.crestUrl) : '',
          isFinalOnly: Boolean(item.isFinalOnly),
          players: Array.isArray(item.players)
            ? item.players.map((p: any) => ({
                tempId: makeTempId(),
                nickname: String(p.nickname || ''),
                fullName: String(p.fullName || ''),
                primaryPosition: normalizePosition(p.primaryPosition) || 'MEI',
                rating: Number(p.rating) || 80,
                isLegendary: Boolean(p.isLegendary),
                photoUrl: p.photoUrl ? String(p.photoUrl) : '',
              }))
            : [],
        }));

      if (loaded.length === 0) {
        throw new Error('Nenhum elenco válido encontrado no JSON.');
      }

      setQueue((prev) => [...loaded, ...prev]);
      setDraft(loaded[0]);
      setFeedback({
        type: 'ok',
        text: `${loaded.length} elenco(s) carregado(s) do JSON para edição rápida.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.message || 'JSON inválido.' });
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveCurrentToDb = async () => {
    if (!onSaveToDatabase) return;
    const err = validateCurrentDraft();
    if (err) {
      setFeedback({ type: 'err', text: err });
      return;
    }
    await onSaveToDatabase([toExportSquad(draft)]);
  };

  const handleSaveQueueToDb = async () => {
    if (!onSaveToDatabase || queue.length === 0) return;
    await onSaveToDatabase(queue.map(toExportSquad));
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Main Easy Squad Builder */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-[#0E1626] p-5 sm:p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Modo Fácil · Criação em Planilha
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase text-white">
                Montar Elenco e Exportar JSON
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setDraft(createEmptySquad())}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
            >
              Limpar Formulário
            </button>
          </div>

          {/* Squad Metadata Inputs */}
          <div className="grid gap-3 sm:grid-cols-12">
            <div className="sm:col-span-7">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Clube ou Seleção *
              </label>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex.: Santos 2011"
                className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Série (opcional)
              </label>
              <input
                value={draft.serie}
                onChange={(e) => setDraft({ ...draft, serie: e.target.value })}
                placeholder="Ex.: Série A"
                className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-12 flex flex-wrap items-center gap-3 pt-1">
              <CrestAvatar
                src={draft.crestUrl}
                alt={draft.name || 'Escudo'}
                size="sm"
              />
              <input
                value={draft.crestUrl}
                onChange={(e) => setDraft({ ...draft, crestUrl: e.target.value })}
                placeholder="URL do escudo ou envie uma imagem ao lado (opcional)"
                className="flex-1 min-w-[200px] rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <label className="rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-500 cursor-pointer shrink-0">
                Enviar Escudo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const uri = await compressImageFileToDataUri(file, 180);
                    setDraft({ ...draft, crestUrl: uri });
                  }}
                />
              </label>
            </div>

            <label className="sm:col-span-12 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-100 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.isFinalOnly}
                onChange={(e) =>
                  setDraft({ ...draft, isFinalOnly: e.target.checked })
                }
                className="h-4 w-4 rounded accent-amber-400"
              />
              <span>
                <strong className="text-amber-200">
                  Time de Lendas · Bônus (não entra no Draft)
                </strong>{' '}
                — Desbloqueado apenas ao vencer todos os 7 jogos.
              </span>
            </label>
          </div>

          {/* Quick Player Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Jogadores ({validPlayersCount} preenchidos / {draft.players.length} linhas)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleFillBaseEleven}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Base 11 Titulares</span>
              </button>
              <button
                type="button"
                onClick={() => setPasteMode((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/20 cursor-pointer"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                <span>Colar Lista Rápida</span>
              </button>
              <button
                type="button"
                onClick={handleAddEmptyRow}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Linha</span>
              </button>
            </div>
          </div>

          {/* Paste List Drawer */}
          {pasteMode && (
            <div className="rounded-xl border border-amber-500/30 bg-[#070B14] p-4 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Cole um jogador por linha usando as siglas <strong className="text-white">GOL</strong>,{' '}
                <strong className="text-white">DEF</strong>, <strong className="text-white">MEI</strong> ou{' '}
                <strong className="text-white">ATQ</strong>.
                Exemplos: <code className="text-amber-300">Neymar — ATQ — 96</code> ou{' '}
                <code className="text-amber-300">Ganso, MEI, 91, lenda</code>.
              </p>
              <textarea
                rows={5}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`Rafael — GOL — 84\nDanilo — DEF — 85\nArouca — MEI — 88\nGanso — MEI — 91 — lenda\nNeymar — ATQ — 96 — lenda`}
                className="w-full rounded-xl border border-slate-700 bg-[#0B1220] p-3 font-mono text-xs text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasteMode(false)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleApplyPaste}
                  className="rounded-lg bg-amber-400 px-4 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-amber-300 cursor-pointer"
                >
                  Converter em Jogadores
                </button>
              </div>
            </div>
          )}

          {/* Inline Spreadsheet Rows */}
          <div className="space-y-2">
            {draft.players.map((p) => {
              return (
                <div
                  key={p.tempId}
                  className="rounded-xl border border-slate-800 bg-[#070B14]/80 p-2.5 space-y-2"
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6 sm:col-span-4">
                      <input
                        value={p.nickname}
                        onChange={(e) =>
                          updatePlayer(p.tempId, { nickname: e.target.value })
                        }
                        placeholder="Apelido *"
                        className="w-full rounded-lg border border-slate-700 bg-[#0B1220] px-2.5 py-1.5 text-xs font-semibold text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="col-span-4 sm:col-span-3 hidden sm:block">
                      <input
                        value={p.fullName}
                        onChange={(e) =>
                          updatePlayer(p.tempId, { fullName: e.target.value })
                        }
                        placeholder="Nome completo (opcional)"
                        className="w-full rounded-lg border border-slate-700 bg-[#0B1220] px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="col-span-3 sm:col-span-2">
                      <select
                        value={p.primaryPosition}
                        onChange={(e) => {
                          const nextPos = e.target.value as PositionCode;
                          updatePlayer(p.tempId, {
                            primaryPosition: nextPos,
                          });
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-[#0B1220] px-2 py-1.5 text-xs font-bold text-emerald-400"
                      >
                        {POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3 sm:col-span-1">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={p.rating}
                        onChange={(e) =>
                          updatePlayer(p.tempId, {
                            rating: Number(e.target.value),
                          })
                        }
                        title="Nota 1-100"
                        className="font-mono-num w-full rounded-lg border border-slate-700 bg-[#0B1220] px-2 py-1.5 text-center text-xs font-extrabold text-emerald-300"
                      />
                    </div>

                    <div className="col-span-12 sm:col-span-2 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updatePlayer(p.tempId, { isLegendary: !p.isLegendary })
                        }
                        title="Marcar como lendário"
                        className={`rounded-lg border p-1.5 cursor-pointer ${
                          p.isLegendary
                            ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                            : 'border-slate-700 bg-[#0B1220] text-slate-500 hover:text-amber-300'
                        }`}
                      >
                        <Crown className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => removePlayer(p.tempId)}
                        title="Remover linha"
                        className="rounded-lg border border-rose-500/30 p-1.5 text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Primary Actions Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddToQueue}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                <Layers className="h-4 w-4" />
                <span>Guardar na Fila e Criar Próximo</span>
              </button>

              {isAdmin && onSaveToDatabase && (
                <button
                  type="button"
                  disabled={savingToDb}
                  onClick={handleSaveCurrentToDb}
                  className="flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 cursor-pointer"
                >
                  <Database className="h-4 w-4" />
                  <span>{savingToDb ? 'Salvando...' : 'Salvar no Banco'}</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopySingleJson}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2.5 text-xs font-bold text-slate-200 hover:border-slate-500 cursor-pointer"
              >
                {copiedKey === 'single' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                )}
                <span>{copiedKey === 'single' ? 'JSON Copiado' : 'Copiar JSON'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportSingleJson}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs font-bold text-amber-200 hover:bg-amber-500/20 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Baixar JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Export Queue */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-[#0E1626] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-display text-2xl font-bold uppercase text-white flex items-center gap-2">
                <FileJson className="h-5 w-5 text-emerald-400" />
                <span>Fila de Exportação ({queue.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Monte vários elencos e baixe todos juntos em um único JSON.
              </p>
            </div>
          </div>

          <label className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-[#070B14]/60 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:border-emerald-500/60 hover:text-white cursor-pointer">
            <Upload className="h-3.5 w-3.5 text-emerald-400" />
            <span>Carregar JSON existente para editar</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportJsonToQueue}
            />
          </label>

          {queue.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#070B14]/50 p-5 text-center text-xs text-slate-400 leading-relaxed">
              Nenhum elenco na fila ainda. Preencha o formulário ao lado e clique em{' '}
              <strong className="text-slate-200">Guardar na Fila</strong> ou exporte direto pelo botão{' '}
              <strong className="text-amber-300">Baixar JSON</strong>.
            </div>
          ) : (
            <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {queue.map((item) => {
                const count = item.players.filter(
                  (p) => p.nickname.trim().length > 0
                ).length;
                return (
                  <div
                    key={item.tempId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#070B14]/80 p-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CrestAvatar
                        src={item.crestUrl}
                        alt={item.name}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">
                          {item.name}
                        </p>
                        <p className="font-mono-num text-[11px] text-slate-400">
                          {item.serie ? `${item.serie} · ` : ''}
                          {count} atletas
                          {item.isFinalOnly ? (
                            <span className="text-amber-300 font-semibold">
                              {' '}· Final
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDraft(item)}
                        title="Carregar no editor"
                        className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-emerald-500 hover:text-white cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQueue((prev) =>
                            prev.filter((q) => q.tempId !== item.tempId)
                          )
                        }
                        title="Remover da fila"
                        className="rounded-lg border border-rose-500/30 p-1.5 text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {queue.length > 0 && (
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={handleExportQueueJson}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-amber-300 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Exportar Todos em JSON ({queue.length})</span>
              </button>

              <button
                type="button"
                onClick={handleCopyQueueJson}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#070B14] px-4 py-2.5 text-xs font-bold text-slate-200 hover:border-slate-500 cursor-pointer"
              >
                {copiedKey === 'queue' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                )}
                <span>
                  {copiedKey === 'queue'
                    ? 'JSON da Fila Copiado'
                    : 'Copiar JSON Completo'}
                </span>
              </button>

              {isAdmin && onSaveToDatabase && (
                <button
                  type="button"
                  disabled={savingToDb}
                  onClick={handleSaveQueueToDb}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 cursor-pointer"
                >
                  <Database className="h-4 w-4" />
                  <span>
                    {savingToDb
                      ? 'Enviando ao Banco...'
                      : `Salvar Fila no Banco (${queue.length})`}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
