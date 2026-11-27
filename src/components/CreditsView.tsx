import { useEffect, useState } from 'react';
import { Award, ExternalLink } from 'lucide-react';
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
  const [credits, setCredits] = useState<SiteCreditsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="border-b border-slate-800 pb-6">
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
      </div>

      {credits.entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0E1626]/60 p-10 text-center text-sm text-slate-400">
          Nenhum crédito cadastrado.
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
    </div>
  );
}
