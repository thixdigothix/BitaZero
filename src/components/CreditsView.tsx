import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Award,
  Check,
  Edit3,
  ExternalLink,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { CreditEntry } from '../db/schema.ts';
import { apiFetch } from '../lib/api.ts';

interface SiteCreditsData {
  id: number;
  title: string;
  subtitle: string;
  intro: string;
  entries: CreditEntry[];
  footerNote: string;
  updatedBy: string | null;
  updatedAt: string;
}

export function CreditsView() {
  const { dbUser, idToken } = useAuth();
  const isAdmin = dbUser?.role === 'admin';

  const [credits, setCredits] = useState<SiteCreditsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftSubtitle, setDraftSubtitle] = useState('');
  const [draftIntro, setDraftIntro] = useState('');
  const [draftFooterNote, setDraftFooterNote] = useState('');
  const [draftEntries, setDraftEntries] = useState<CreditEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ credits: SiteCreditsData }>('/api/credits');
        if (!cancelled) {
          setCredits(res.credits);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Não foi possível carregar os créditos.');
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

  const startEditing = () => {
    if (!credits) return;
    setDraftTitle(credits.title);
    setDraftSubtitle(credits.subtitle);
    setDraftIntro(credits.intro);
    setDraftFooterNote(credits.footerNote);
    setDraftEntries(
      credits.entries.map((e) => ({
        id: e.id,
        role: e.role,
        name: e.name,
        description: e.description,
        linkLabel: e.linkLabel || '',
        linkUrl: e.linkUrl || '',
      }))
    );
    setNotice(null);
    setEditing(true);
  };

  const handleAddEntry = () => {
    setDraftEntries((prev) => [
      ...prev,
      {
        id: `credit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: '',
        name: '',
        description: '',
        linkLabel: '',
        linkUrl: '',
      },
    ]);
  };

  const handleUpdateEntry = (
    index: number,
    field: keyof CreditEntry,
    value: string
  ) => {
    setDraftEntries((prev) =>
      prev.map((entry, idx) =>
        idx === index ? { ...entry, [field]: value } : entry
      )
    );
  };

  const handleMoveEntry = (index: number, direction: -1 | 1) => {
    setDraftEntries((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const handleRemoveEntry = (index: number) => {
    setDraftEntries((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !idToken) return;

    setSaving(true);
    setNotice(null);
    try {
      const res = await apiFetch<{ credits: SiteCreditsData }>(
        '/api/credits',
        {
          method: 'PUT',
          body: JSON.stringify({
            title: draftTitle,
            subtitle: draftSubtitle,
            intro: draftIntro,
            entries: draftEntries,
            footerNote: draftFooterNote,
          }),
        },
        idToken
      );
      setCredits(res.credits);
      setEditing(false);
      setNotice({ type: 'ok', text: 'Créditos salvos com sucesso.' });
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err.message || 'Erro ao salvar os créditos.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#0E1626] p-12 text-center text-sm text-slate-400">
        Carregando créditos...
      </div>
    );
  }

  if (error || !credits) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {error || 'Créditos indisponíveis no momento.'}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="max-w-3xl space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
            {credits.subtitle || 'BIT A ZERO · Reconhecimento'}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-tight text-white">
            {credits.title}
          </h1>
          {credits.intro && (
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {credits.intro}
            </p>
          )}
        </div>

        {isAdmin && !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/25 cursor-pointer shrink-0"
          >
            <Edit3 className="h-4 w-4" />
            <span>Editar Créditos</span>
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {editing && isAdmin ? (
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-emerald-500/40 bg-[#0E1626] p-5 sm:p-6 space-y-6 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="font-display text-2xl font-extrabold uppercase text-white">
                Editar Página de Créditos
              </h2>
              <p className="text-xs text-slate-400">
                As alterações são salvas no banco oficial e ficam visíveis para todos os jogadores.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">
                Título Principal *
              </label>
              <input
                required
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Ex.: Créditos & Agradecimentos"
                className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">
                Subtítulo
              </label>
              <input
                value={draftSubtitle}
                onChange={(e) => setDraftSubtitle(e.target.value)}
                placeholder="Ex.: BIT A ZERO · Draft de elencos do canal Bit Fut"
                className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-300">
              Texto de Apresentação
            </label>
            <textarea
              rows={3}
              value={draftIntro}
              onChange={(e) => setDraftIntro(e.target.value)}
              placeholder="Escreva uma introdução ou mensagem para a aba de créditos..."
              className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Credit Entries Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Cartões de Créditos ({draftEntries.length})
              </h3>
              <button
                type="button"
                onClick={handleAddEntry}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Adicionar Crédito</span>
              </button>
            </div>

            {draftEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 bg-[#070B14]/60 p-6 text-center text-xs text-slate-400">
                Nenhum cartão cadastrado. Clique em &ldquo;Adicionar Crédito&rdquo; para criar um.
              </div>
            ) : (
              <div className="space-y-3">
                {draftEntries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-slate-800 bg-[#070B14]/80 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-num text-xs font-bold text-emerald-400">
                        #{idx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveEntry(idx, -1)}
                          disabled={idx === 0}
                          title="Mover para cima"
                          className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveEntry(idx, 1)}
                          disabled={idx === draftEntries.length - 1}
                          title="Mover para baixo"
                          className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveEntry(idx)}
                          title="Remover crédito"
                          className="rounded-lg border border-rose-500/30 p-1.5 text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-400">
                          Função / Categoria
                        </label>
                        <input
                          value={entry.role}
                          onChange={(e) =>
                            handleUpdateEntry(idx, 'role', e.target.value)
                          }
                          placeholder="Ex.: Criador, Pesquisa, Canal"
                          className="w-full rounded-lg border border-slate-700 bg-[#0B1220] px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-400">
                          Nome / Título
                        </label>
                        <input
                          value={entry.name}
                          onChange={(e) =>
                            handleUpdateEntry(idx, 'name', e.target.value)
                          }
                          placeholder="Ex.: Bit Fut"
                          className="w-full rounded-lg border border-slate-700 bg-[#0B1220] px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-400">
                        Descrição
                      </label>
                      <textarea
                        rows={2}
                        value={entry.description}
                        onChange={(e) =>
                          handleUpdateEntry(idx, 'description', e.target.value)
                        }
                        placeholder="Descreva a participação ou agradecimento..."
                        className="w-full rounded-lg border border-slate-700 bg-[#0B1220] px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-400">
                          Texto do Link (opcional)
                        </label>
                        <input
                          value={entry.linkLabel || ''}
                          onChange={(e) =>
                            handleUpdateEntry(idx, 'linkLabel', e.target.value)
                          }
                          placeholder="Ex.: Acessar canal"
                          className="w-full rounded-lg border border-slate-700 bg-[#0B1220] px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-400">
                          URL do Link (opcional, https://...)
                        </label>
                        <input
                          value={entry.linkUrl || ''}
                          onChange={(e) =>
                            handleUpdateEntry(idx, 'linkUrl', e.target.value)
                          }
                          placeholder="https://..."
                          className="w-full rounded-lg border border-slate-700 bg-[#0B1220] px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-300">
              Nota de Rodapé (opcional)
            </label>
            <input
              value={draftFooterNote}
              onChange={(e) => setDraftFooterNote(e.target.value)}
              placeholder="Mensagem final de rodapé..."
              className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Créditos'}</span>
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Credits Cards */}
          {credits.entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0E1626]/60 p-10 text-center text-sm text-slate-400">
              Nenhum crédito adicionado ainda.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {credits.entries.map((entry) => (
                <article
                  key={entry.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#0E1626] p-6 shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                        <Award className="h-3.5 w-3.5" />
                        <span>{entry.role || 'Crédito'}</span>
                      </span>
                    </div>

                    <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-white">
                      {entry.name}
                    </h2>

                    {entry.description && (
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                        {entry.description}
                      </p>
                    )}
                  </div>

                  {entry.linkUrl && /^https?:\/\//i.test(entry.linkUrl) && (
                    <div className="mt-5 border-t border-slate-800/80 pt-4">
                      <a
                        href={entry.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 transition"
                      >
                        <span>{entry.linkLabel || 'Acessar link'}</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {credits.footerNote && (
            <div className="rounded-2xl border border-slate-800 bg-[#0E1626]/80 px-6 py-4 text-center text-xs sm:text-sm text-slate-400">
              {credits.footerNote}
            </div>
          )}
        </>
      )}
    </div>
  );
}
