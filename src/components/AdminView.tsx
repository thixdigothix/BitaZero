import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  Upload,
  Download,
  ShieldAlert,
  LogIn,
  Crown,
  Users,
  FileSpreadsheet,
  FileJson,
  X,
  Check,
  Swords,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, compressImageFileToDataUri } from '../lib/api.ts';
import {
  getFormation,
  normalizePosition,
  POSITIONS,
  PositionCode,
} from '../shared/gameLogic.ts';
import {
  AuthUser,
  LineupSlot,
  Player,
  SquadWithPlayers,
} from '../types/game.ts';
import { CrestAvatar } from './CrestAvatar.tsx';
import { QuickSquadBuilder } from './QuickSquadBuilder.tsx';
import { TacticalPitch } from './TacticalPitch.tsx';

interface AdminViewProps {
  onSquadsMutated: () => void;
}

interface SquadFormState {
  id?: number;
  name: string;
  serie: string;
  crestUrl: string;
  isFinalOnly: boolean;
}

interface PlayerFormState {
  id?: number;
  squadId: number;
  fullName: string;
  nickname: string;
  primaryPosition: PositionCode;
  rating: number;
  isLegendary: boolean;
  photoUrl: string;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseBulkCsvToImportItems(rawCsv: string) {
  const lines = rawCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('O arquivo CSV precisa ter cabeçalho e pelo menos uma linha de dados.');
  }

  const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.toLowerCase());

  const idx = (names: string[]) =>
    headers.findIndex((h) => names.includes(h));

  const iSquad = idx(['squad_name', 'squad', 'elenco', 'clube']);
  const iSerie = idx(['serie', 'série', 'competition', 'competicao', 'competição']);
  const iCrest = idx(['crest_url', 'escudo', 'crest']);
  const iFinalOnly = idx(['is_final_only', 'final_only', 'exclusivo_final']);
  const iFull = idx(['full_name', 'nome_completo', 'nome']);
  const iNick = idx(['nickname', 'apelido']);
  const iPos = idx(['primary_position', 'posicao', 'posição', 'pos']);
  const iRating = idx(['rating', 'nota', 'forca', 'força']);
  const iLegend = idx(['is_legendary', 'lendario', 'lendário']);
  const iPhoto = idx(['photo_url', 'foto', 'photo']);

  if (iSquad === -1 || iNick === -1 || iPos === -1) {
    throw new Error(
      'Cabeçalhos obrigatórios ausentes: squad_name, nickname, primary_position.'
    );
  }

  const grouped = new Map<string, any>();

  for (let r = 1; r < lines.length; r++) {
    const cols = parseCsvLine(lines[r], delimiter);
    const squadName = cols[iSquad] || '';
    if (!squadName) continue;

    const serieVal = iSerie !== -1 ? cols[iSerie] || null : null;
    const finalOnlyRaw =
      iFinalOnly !== -1 ? (cols[iFinalOnly] || '').toLowerCase() : '';
    const isFinalOnly = ['true', '1', 'sim', 's', 'yes'].includes(finalOnlyRaw);
    const key = `${squadName}__${serieVal || ''}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        name: squadName,
        serie: serieVal,
        crestUrl: iCrest !== -1 ? cols[iCrest] || null : null,
        isFinalOnly,
        players: [],
      });
    }

    const pos = normalizePosition(cols[iPos] || '');
    if (!pos) continue;

    const legendRaw = iLegend !== -1 ? (cols[iLegend] || '').toLowerCase() : '';
    const isLegendary = ['true', '1', 'sim', 's', 'yes'].includes(legendRaw);

    grouped.get(key).players.push({
      fullName: (iFull !== -1 && cols[iFull]) || cols[iNick],
      nickname: cols[iNick],
      primaryPosition: pos,
      rating: iRating !== -1 ? Number(cols[iRating]) || 80 : 80,
      isLegendary,
      photoUrl: iPhoto !== -1 ? cols[iPhoto] || null : null,
    });
  }

  return Array.from(grouped.values());
}

function buildClientBossPreview(squad: SquadWithPlayers): {
  lineup: LineupSlot[];
  avgRating: number;
  counts: Record<PositionCode, number>;
} {
  const formation = getFormation('4-3-3');
  const pool = squad.players || [];
  const used = new Set<number>();

  const counts: Record<PositionCode, number> = { GOL: 0, DEF: 0, MEI: 0, ATQ: 0 };
  for (const p of pool) {
    const pos = normalizePosition(p.primaryPosition) || 'MEI';
    counts[pos] = (counts[pos] || 0) + 1;
  }

  let ratingSum = 0;
  let starterCount = 0;

  const lineup: LineupSlot[] = formation.slots.map((slotDef) => {
    const targetPos = normalizePosition(slotDef.position) || 'MEI';
    const candidate = pool
      .filter((p) => !used.has(p.id))
      .map((p) => {
        const primary = normalizePosition(p.primaryPosition) || 'MEI';
        let fitScore = (p.rating ?? 80) + (p.isLegendary ? 1.2 : 0);
        if (primary === targetPos) fitScore += 15;
        else fitScore -= 12;
        return { p, fitScore };
      })
      .sort((a, b) => b.fitScore - a.fitScore)[0];

    if (!candidate) {
      return {
        id: -(slotDef.slotIndex + 1),
        campaignId: 0,
        slotIndex: slotDef.slotIndex,
        slotPosition: slotDef.position,
        slotLabel: slotDef.label,
        playerId: null,
        playerSnapshot: null,
      };
    }

    used.add(candidate.p.id);
    const chosen = candidate.p;
    ratingSum += chosen.rating ?? 80;
    starterCount += 1;

    return {
      id: -(slotDef.slotIndex + 1),
      campaignId: 0,
      slotIndex: slotDef.slotIndex,
      slotPosition: slotDef.position,
      slotLabel: slotDef.label,
      playerId: chosen.id,
      playerSnapshot: {
        id: chosen.id,
        squadId: squad.id,
        squadName: squad.name,
        squadSeason: squad.season || '',
        squadCrestUrl: squad.crestUrl || null,
        fullName: chosen.fullName,
        nickname: chosen.nickname,
        shirtNumber: chosen.shirtNumber ?? 10,
        primaryPosition: normalizePosition(chosen.primaryPosition) || slotDef.position,
        secondaryPositions: [],
        rating: chosen.rating ?? 80,
        isLegendary: Boolean(chosen.isLegendary),
        photoUrl: chosen.photoUrl || null,
      },
    };
  });

  return {
    lineup,
    avgRating: starterCount > 0 ? Math.round(ratingSum / starterCount) : 0,
    counts,
  };
}

export function AdminView({ onSquadsMutated }: AdminViewProps) {
  const { dbUser, firebaseUser, idToken, loading: authLoading, loginWithGoogle } =
    useAuth();

  const [subTab, setSubTab] = useState<
    'quick' | 'boss' | 'squads' | 'import' | 'users'
  >('quick');
  const [squads, setSquads] = useState<SquadWithPlayers[]>([]);
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null);
  const [selectedBossId, setSelectedBossId] = useState<number | null>(null);
  const [showCreateBossForm, setShowCreateBossForm] = useState(false);
  const [bossName, setBossName] = useState('');
  const [bossSerie, setBossSerie] = useState('');
  const [bossCrestUrl, setBossCrestUrl] = useState('');
  const [promoteSquadId, setPromoteSquadId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const [squadModal, setSquadModal] = useState<SquadFormState | null>(null);
  const [playerModal, setPlayerModal] = useState<PlayerFormState | null>(null);
  const [confirmDeleteSquadId, setConfirmDeleteSquadId] = useState<number | null>(
    null
  );

  const [bulkText, setBulkText] = useState('');
  const [usersList, setUsersList] = useState<AuthUser[]>([]);

  const isAdmin = dbUser?.role === 'admin';

  const fetchAdminSquads = useCallback(
    async (query = '') => {
      if (!idToken || !isAdmin) return;
      setLoading(true);
      try {
        const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
        const res = await apiFetch<{ squads: SquadWithPlayers[] }>(
          `/api/admin/squads${qs}`,
          {},
          idToken
        );
        setSquads(res.squads);
        setSelectedSquadId((prev) => {
          if (prev && res.squads.some((s) => s.id === prev)) return prev;
          return res.squads[0]?.id ?? null;
        });
        const bosses = res.squads.filter((s) => s.isFinalOnly);
        setSelectedBossId((prev) => {
          if (prev && bosses.some((b) => b.id === prev)) return prev;
          return bosses[0]?.id ?? null;
        });
      } catch (err: any) {
        setNotice({ type: 'err', text: err.message || 'Erro ao carregar elencos.' });
      } finally {
        setLoading(false);
      }
    },
    [idToken, isAdmin]
  );

  const fetchAdminUsers = useCallback(async () => {
    if (!idToken || !isAdmin) return;
    try {
      const res = await apiFetch<{ users: AuthUser[] }>(
        '/api/admin/users',
        {},
        idToken
      );
      setUsersList(res.users);
    } catch (err: any) {
      setNotice({ type: 'err', text: err.message || 'Erro ao carregar usuários.' });
    }
  }, [idToken, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminSquads(search);
    }
  }, [isAdmin, fetchAdminSquads, search]);

  useEffect(() => {
    if (isAdmin && subTab === 'users') {
      fetchAdminUsers();
    }
  }, [isAdmin, subTab, fetchAdminUsers]);

  const selectedSquad = useMemo(
    () => squads.find((s) => s.id === selectedSquadId) || null,
    [squads, selectedSquadId]
  );

  const bossSquads = useMemo(
    () => squads.filter((s) => s.isFinalOnly),
    [squads]
  );

  const nonBossSquads = useMemo(
    () => squads.filter((s) => !s.isFinalOnly),
    [squads]
  );

  const selectedBoss = useMemo(
    () => bossSquads.find((s) => s.id === selectedBossId) || bossSquads[0] || null,
    [bossSquads, selectedBossId]
  );

  const selectedBossPreview = useMemo(
    () => (selectedBoss ? buildClientBossPreview(selectedBoss) : null),
    [selectedBoss]
  );

  const handleSaveQuickToDatabase = async (items: any[]) => {
    if (!idToken || !isAdmin) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiFetch<{
        importedSquads: number;
        importedPlayers: number;
      }>(
        '/api/admin/import',
        {
          method: 'POST',
          body: JSON.stringify({ items }),
        },
        idToken
      );
      setNotice({
        type: 'ok',
        text: `Salvo no banco oficial: ${res.importedSquads} elenco(s) e ${res.importedPlayers} jogador(es).`,
      });
      await fetchAdminSquads(search);
      onSquadsMutated();
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err.message || 'Erro ao salvar elenco no banco.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleExportSingleSquadJson = (sq: SquadWithPlayers) => {
    const payload = [
      {
        name: sq.name,
        serie: sq.competition,
        crestUrl: sq.crestUrl,
        isFinalOnly: Boolean(sq.isFinalOnly),
        players: sq.players.map((p) => ({
          fullName: p.fullName,
          nickname: p.nickname,
          primaryPosition: p.primaryPosition,
          rating: p.rating,
          isLegendary: p.isLegendary,
          photoUrl: p.photoUrl,
        })),
      },
    ];
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = sq.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    a.download = `${slug || 'elenco'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!squadModal) return;
    setBusy(true);
    setNotice(null);
    try {
      if (squadModal.id) {
        await apiFetch(
          `/api/admin/squads/${squadModal.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(squadModal),
          },
          idToken
        );
        setNotice({ type: 'ok', text: 'Elenco atualizado com sucesso.' });
      } else {
        const res = await apiFetch<{ squad: SquadWithPlayers }>(
          '/api/admin/squads',
          {
            method: 'POST',
            body: JSON.stringify(squadModal),
          },
          idToken
        );
        setSelectedSquadId(res.squad.id);
        setNotice({ type: 'ok', text: 'Novo elenco cadastrado.' });
      }
      setSquadModal(null);
      await fetchAdminSquads(search);
      onSquadsMutated();
    } catch (err: any) {
      setNotice({ type: 'err', text: err.message || 'Erro ao salvar elenco.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSquad = async (id: number) => {
    setBusy(true);
    setNotice(null);
    try {
      await apiFetch(`/api/admin/squads/${id}`, { method: 'DELETE' }, idToken);
      setConfirmDeleteSquadId(null);
      setNotice({ type: 'ok', text: 'Elenco removido do banco de dados.' });
      await fetchAdminSquads(search);
      onSquadsMutated();
    } catch (err: any) {
      setNotice({ type: 'err', text: err.message || 'Erro ao excluir elenco.' });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateBossSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bossName.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiFetch<{ squad: SquadWithPlayers }>(
        '/api/admin/squads',
        {
          method: 'POST',
          body: JSON.stringify({
            name: bossName.trim(),
            serie: bossSerie.trim(),
            crestUrl: bossCrestUrl.trim(),
            isFinalOnly: true,
          }),
        },
        idToken
      );
      setBossName('');
      setBossSerie('');
      setBossCrestUrl('');
      setShowCreateBossForm(false);
      setSelectedBossId(res.squad.id);
      setNotice({
        type: 'ok',
        text: `Chefão Final "${res.squad.name}" criado! Agora adicione os 11+ jogadores do elenco.`,
      });
      await fetchAdminSquads(search);
      onSquadsMutated();
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err.message || 'Erro ao criar Chefão Final.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSetFinalOnlyFlag = async (
    sq: SquadWithPlayers,
    isFinalOnly: boolean
  ) => {
    setBusy(true);
    setNotice(null);
    try {
      await apiFetch(
        `/api/admin/squads/${sq.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: sq.name,
            serie: sq.competition || '',
            crestUrl: sq.crestUrl || '',
            isFinalOnly,
          }),
        },
        idToken
      );
      if (isFinalOnly) {
        setSelectedBossId(sq.id);
        setPromoteSquadId('');
      }
      setNotice({
        type: 'ok',
        text: isFinalOnly
          ? `"${sq.name}" agora é Chefão Final (exclusivo da Final).`
          : `"${sq.name}" voltou para o pool normal do Draft.`,
      });
      await fetchAdminSquads(search);
      onSquadsMutated();
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err.message || 'Erro ao atualizar status do elenco.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerModal) return;

    setBusy(true);
    setNotice(null);
    try {
      if (playerModal.id) {
        await apiFetch(
          `/api/admin/players/${playerModal.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(playerModal),
          },
          idToken
        );
        setNotice({ type: 'ok', text: 'Jogador atualizado.' });
      } else {
        await apiFetch(
          `/api/admin/squads/${playerModal.squadId}/players`,
          {
            method: 'POST',
            body: JSON.stringify(playerModal),
          },
          idToken
        );
        setNotice({ type: 'ok', text: 'Jogador adicionado ao elenco.' });
      }
      setPlayerModal(null);
      await fetchAdminSquads(search);
      onSquadsMutated();
    } catch (err: any) {
      setNotice({ type: 'err', text: err.message || 'Erro ao salvar jogador.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePlayer = async (playerId: number) => {
    setBusy(true);
    setNotice(null);
    try {
      await apiFetch(
        `/api/admin/players/${playerId}`,
        { method: 'DELETE' },
        idToken
      );
      setNotice({ type: 'ok', text: 'Jogador excluído do elenco.' });
      await fetchAdminSquads(search);
      onSquadsMutated();
    } catch (err: any) {
      setNotice({ type: 'err', text: err.message || 'Erro ao excluir jogador.' });
    } finally {
      setBusy(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      let items: any[] = [];
      const trimmed = bulkText.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        items = Array.isArray(parsed) ? parsed : parsed.squads || [];
      } else {
        items = parseBulkCsvToImportItems(trimmed);
      }

      if (!items.length) {
        throw new Error('Nenhum elenco válido encontrado no conteúdo enviado.');
      }

      const res = await apiFetch<{
        importedSquads: number;
        importedPlayers: number;
      }>(
        '/api/admin/import',
        {
          method: 'POST',
          body: JSON.stringify({ items }),
        },
        idToken
      );
      setBulkText('');
      setNotice({
        type: 'ok',
        text: `Importação concluída: ${res.importedSquads} elenco(s) e ${res.importedPlayers} jogador(es).`,
      });
      await fetchAdminSquads(search);
      onSquadsMutated();
      setSubTab('squads');
    } catch (err: any) {
      setNotice({ type: 'err', text: err.message || 'Falha na importação.' });
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiFetch<{ squads: any[] }>(
        '/api/admin/export',
        {},
        idToken
      );
      let content = '';
      let mime = 'application/json';
      let ext = 'json';

      if (format === 'json') {
        content = JSON.stringify(res.squads, null, 2);
      } else {
        mime = 'text/csv;charset=utf-8';
        ext = 'csv';
        const rows = [
          'squad_name,serie,crest_url,is_final_only,full_name,nickname,primary_position,rating,is_legendary,photo_url',
        ];
        for (const sq of res.squads) {
          for (const p of sq.players || []) {
            const esc = (v: any) =>
              `"${String(v ?? '').replace(/"/g, '""')}"`;
            rows.push(
              [
                esc(sq.name),
                esc(sq.serie ?? sq.competition ?? ''),
                esc(sq.crestUrl || ''),
                sq.isFinalOnly ? 'true' : 'false',
                esc(p.fullName),
                esc(p.nickname),
                p.primaryPosition,
                p.rating,
                p.isLegendary ? 'true' : 'false',
                esc(p.photoUrl || ''),
              ].join(',')
            );
          }
        }
        content = rows.join('\n');
      }

      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sete-a-zero-elencos.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice({ type: 'ok', text: `Exportação ${format.toUpperCase()} concluída.` });
    } catch (err: any) {
      setNotice({ type: 'err', text: err.message || 'Erro ao exportar elencos.' });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleUserRole = async (user: AuthUser) => {
    setBusy(true);
    setNotice(null);
    try {
      const nextRole = user.role === 'admin' ? 'user' : 'admin';
      await apiFetch(
        `/api/admin/users/${user.id}/role`,
        {
          method: 'PUT',
          body: JSON.stringify({ role: nextRole }),
        },
        idToken
      );
      await fetchAdminUsers();
      setNotice({
        type: 'ok',
        text: `Permissão de ${user.email} atualizada para ${nextRole}.`,
      });
    } catch (err: any) {
      setNotice({ type: 'err', text: err.message || 'Erro ao atualizar usuário.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#0E1626] p-5 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            Estúdio e Administração de Elencos
          </p>
          <h1 className="font-display text-3xl font-extrabold uppercase text-white">
            Criar, Gerenciar &amp; Exportar Elencos
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('quick')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              subTab === 'quick'
                ? 'bg-emerald-500 text-slate-950'
                : 'border border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <FileJson className="h-3.5 w-3.5" />
            <span>Criador Fácil (JSON)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('boss')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              subTab === 'boss'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
            }`}
          >
            <Swords className="h-3.5 w-3.5" />
            <span>Chefão Final{isAdmin ? ` (${bossSquads.length})` : ''}</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('squads')}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              subTab === 'squads'
                ? 'bg-emerald-500 text-slate-950'
                : 'border border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            Banco Oficial{isAdmin ? ` (${squads.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('import')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              subTab === 'import'
                ? 'bg-emerald-500 text-slate-950'
                : 'border border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Importar / Exportar</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('users')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              subTab === 'users'
                ? 'bg-emerald-500 text-slate-950'
                : 'border border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Usuários</span>
          </button>
        </div>
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

      {subTab === 'quick' && (
        <QuickSquadBuilder
          isAdmin={isAdmin}
          savingToDb={busy}
          onSaveToDatabase={handleSaveQuickToDatabase}
        />
      )}

      {subTab !== 'quick' && authLoading && (
        <div className="rounded-2xl border border-slate-800 bg-[#0E1626] p-10 text-center text-sm text-slate-400">
          Verificando permissões administrativas...
        </div>
      )}

      {subTab !== 'quick' && !authLoading && !firebaseUser && (
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-[#0E1626] p-8 text-center space-y-4 shadow-xl">
          <ShieldAlert className="mx-auto h-10 w-10 text-emerald-400" />
          <h2 className="font-display text-3xl font-extrabold uppercase text-white">
            {subTab === 'boss'
              ? 'Chefão Final (Administrador)'
              : 'Banco Oficial (Administrador)'}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Faça login com sua conta Google de administrador para cadastrar o{' '}
            <strong className="text-amber-300">Chefão Final</strong> e gerenciar o banco oficial do jogo, ou utilize o{' '}
            <strong className="text-emerald-400">Criador Fácil (JSON)</strong> para montar e baixar seus elencos agora mesmo.
          </p>
          <button
            type="button"
            onClick={loginWithGoogle}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-slate-950 transition hover:bg-emerald-400 cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            <span>Entrar com Google</span>
          </button>
        </div>
      )}

      {subTab !== 'quick' && !authLoading && firebaseUser && !isAdmin && (
        <div className="mx-auto max-w-xl rounded-2xl border border-rose-500/40 bg-[#0E1626] p-8 text-center space-y-3 shadow-xl">
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-400" />
          <h2 className="font-display text-3xl font-extrabold uppercase text-white">
            Acesso Restrito
          </h2>
          <p className="text-sm text-slate-300">
            A conta <strong className="text-white">{dbUser?.email || firebaseUser.email}</strong>{' '}
            possui permissão de jogador comum e não pode modificar o banco oficial de elencos.
          </p>
        </div>
      )}

      {isAdmin && subTab === 'boss' && (
        <div className="space-y-6">
          {/* Explainer Banner */}
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-[#1E1407] via-[#0E1626] to-[#0E1626] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 max-w-3xl">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
                  <Swords className="h-4 w-4" />
                  <span>Time de Lendas · Bônus 7 Vitórias</span>
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase text-white">
                  Time Bônus Desbloqueável
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Os times cadastrados aqui ficam fora do sorteio do Draft e dos 7 jogos normais. Quando o jogador{' '}
                  <strong className="text-amber-300">vencer todos os 7 jogos</strong>, esse Time de Lendas é desbloqueado como bônus em uma tela especial exibindo ambas as escalações!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateBossForm((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-amber-300 transition cursor-pointer shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Chefão Final</span>
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* Left Column: Create Boss + Boss List + Promote Existing */}
            <div className="lg:col-span-5 space-y-4">
              {(showCreateBossForm || bossSquads.length === 0) && (
                <form
                  onSubmit={handleCreateBossSquad}
                  className="rounded-2xl border border-amber-500/40 bg-[#0E1626] p-5 space-y-4 shadow-xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-display text-xl font-bold uppercase text-amber-300">
                      Cadastrar Chefão Final
                    </h3>
                    {bossSquads.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowCreateBossForm(false)}
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Nome do Time Chefão Final *
                    </label>
                    <input
                      required
                      value={bossName}
                      onChange={(e) => setBossName(e.target.value)}
                      placeholder="Ex.: Seleção Mundial Lendária"
                      className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Série (opcional)
                    </label>
                    <input
                      value={bossSerie}
                      onChange={(e) => setBossSerie(e.target.value)}
                      placeholder="Ex.: Chefão Final · Lendas"
                      className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">
                      Escudo do Chefão Final (URL ou Upload)
                    </label>
                    <div className="flex items-center gap-2.5">
                      <CrestAvatar
                        src={bossCrestUrl}
                        alt={bossName || 'Chefão Final'}
                        size="md"
                      />
                      <input
                        value={bossCrestUrl}
                        onChange={(e) => setBossCrestUrl(e.target.value)}
                        placeholder="https://... ou envie uma imagem"
                        className="flex-1 rounded-xl border border-slate-700 bg-[#070B14] px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                      />
                      <label className="rounded-xl border border-slate-700 bg-[#070B14] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-400 cursor-pointer shrink-0">
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const uri = await compressImageFileToDataUri(file, 200);
                            setBossCrestUrl(uri);
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy || !bossName.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>{busy ? 'Salvando...' : 'Criar Chefão Final'}</span>
                  </button>
                </form>
              )}

              {/* Registered Boss Squads List */}
              <div className="rounded-2xl border border-slate-800 bg-[#0E1626] p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Chefões Cadastrados ({bossSquads.length})
                </p>

                {bossSquads.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-800 bg-[#070B14]/60 p-5 text-center text-xs text-slate-400">
                    Nenhum Chefão Final cadastrado ainda. Crie acima ou promova um time existente abaixo.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {bossSquads.map((sq) => {
                      const active = selectedBoss?.id === sq.id;
                      const startersCount = Math.min(11, sq.players.length);
                      return (
                        <div
                          key={sq.id}
                          onClick={() => setSelectedBossId(sq.id)}
                          className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition cursor-pointer ${
                            active
                              ? 'border-amber-400 bg-amber-500/15'
                              : 'border-slate-800 bg-[#070B14]/70 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <CrestAvatar src={sq.crestUrl} alt={sq.name} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-white">
                                {sq.name}
                              </p>
                              <p className="truncate text-[11px] text-slate-400">
                                {sq.competition ? `${sq.competition} · ` : ''}
                                <span className="font-mono-num text-amber-300 font-semibold">
                                  {sq.players.length} atletas ({startersCount}/11 titulares)
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {nonBossSquads.length > 0 && (
                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Ou promover time do Banco Oficial
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={promoteSquadId}
                        onChange={(e) => setPromoteSquadId(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-700 bg-[#070B14] px-3 py-2 text-xs text-white"
                      >
                        <option value="">Selecionar elenco...</option>
                        {nonBossSquads.map((sq) => (
                          <option key={sq.id} value={sq.id}>
                            {sq.name} ({sq.players.length} atletas)
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy || !promoteSquadId}
                        onClick={() => {
                          const target = nonBossSquads.find(
                            (s) => s.id === Number(promoteSquadId)
                          );
                          if (target) handleSetFinalOnlyFlag(target, true);
                        }}
                        className="rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40 cursor-pointer shrink-0"
                      >
                        Definir Chefão
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Selected Boss Roster + Live 4-3-3 Lineup Preview */}
            <div className="lg:col-span-7 space-y-5">
              {selectedBoss && selectedBossPreview ? (
                <>
                  <div className="rounded-2xl border border-slate-800 bg-[#0E1626] p-5 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-3.5">
                        <CrestAvatar
                          src={selectedBoss.crestUrl}
                          alt={selectedBoss.name}
                          size="lg"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-2xl sm:text-3xl font-extrabold uppercase text-white">
                              {selectedBoss.name}
                            </h3>
                            <span className="rounded border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                              Chefão Final
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            {selectedBoss.competition || 'Série não informada'} · Força Base Titular:{' '}
                            <span className="font-mono-num font-bold text-amber-300">
                              {selectedBossPreview.avgRating || '—'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSquadModal({
                              id: selectedBoss.id,
                              name: selectedBoss.name,
                              serie: selectedBoss.competition || '',
                              crestUrl: selectedBoss.crestUrl || '',
                              isFinalOnly: Boolean(selectedBoss.isFinalOnly),
                            })
                          }
                          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Editar Time</span>
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSetFinalOnlyFlag(selectedBoss, false)}
                          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 cursor-pointer"
                        >
                          Mover p/ Draft
                        </button>
                        {confirmDeleteSquadId === selectedBoss.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDeleteSquad(selectedBoss.id)}
                              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSquadId(null)}
                              className="rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-300 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSquadId(selectedBoss.id)}
                            className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Excluir</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Position Breakdown for 11 Starters */}
                    <div className="grid grid-cols-4 gap-2">
                      {(
                        [
                          { pos: 'GOL' as PositionCode, ideal: 1 },
                          { pos: 'DEF' as PositionCode, ideal: 4 },
                          { pos: 'MEI' as PositionCode, ideal: 3 },
                          { pos: 'ATQ' as PositionCode, ideal: 3 },
                        ]
                      ).map((slot) => {
                        const qty = selectedBossPreview.counts[slot.pos] || 0;
                        const ok = qty >= slot.ideal;
                        return (
                          <div
                            key={slot.pos}
                            className={`rounded-xl border px-3 py-2 text-center ${
                              ok
                                ? 'border-emerald-500/40 bg-emerald-500/10'
                                : 'border-amber-500/30 bg-amber-500/10'
                            }`}
                          >
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {slot.pos}
                            </p>
                            <p
                              className={`font-mono-num text-sm font-extrabold ${
                                ok ? 'text-emerald-300' : 'text-amber-300'
                              }`}
                            >
                              {qty}/{slot.ideal}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Players Header + Add Player */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Jogadores do Chefão Final ({selectedBoss.players.length})
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setPlayerModal({
                            squadId: selectedBoss.id,
                            fullName: '',
                            nickname: '',
                            primaryPosition: 'MEI',
                            rating: 90,
                            isLegendary: true,
                            photoUrl: '',
                          })
                        }
                        className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-amber-300 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Adicionar Jogador</span>
                      </button>
                    </div>

                    {selectedBoss.players.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-800 bg-[#070B14]/60 p-8 text-center text-xs text-slate-400">
                        Adicione os 11 jogadores (1 GOL, 4 DEF, 3 MEI, 3 ATQ) que formarão a escalação secreta do Chefão Final.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-[#070B14]/60 max-h-[340px] overflow-y-auto">
                        {selectedBoss.players.map((p: Player) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-3 px-4 py-2.5"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-[#0E1626]">
                                {p.photoUrl ? (
                                  <img
                                    src={p.photoUrl}
                                    alt={p.nickname}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="font-mono-num text-xs font-extrabold text-amber-300">
                                    {p.primaryPosition}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-sm font-bold text-white">
                                    {p.nickname}
                                  </span>
                                  {p.isLegendary && (
                                    <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                  )}
                                </div>
                                <p className="truncate text-xs text-slate-400">
                                  {p.fullName} ·{' '}
                                  <span className="font-semibold text-amber-300">
                                    {p.primaryPosition}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono-num rounded-lg border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-extrabold text-amber-300">
                                {p.rating}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setPlayerModal({
                                    id: p.id,
                                    squadId: p.squadId,
                                    fullName: p.fullName,
                                    nickname: p.nickname,
                                    primaryPosition: p.primaryPosition as PositionCode,
                                    rating: p.rating ?? 85,
                                    isLegendary: p.isLegendary,
                                    photoUrl: p.photoUrl || '',
                                  })
                                }
                                title="Editar jogador"
                                className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleDeletePlayer(p.id)}
                                title="Excluir jogador"
                                className="rounded-lg border border-rose-500/30 p-1.5 text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Live Tactical Preview of Boss Lineup */}
                  <div className="rounded-2xl border border-amber-500/30 bg-[#0E1626] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-amber-400" />
                        <h4 className="font-display text-xl font-bold uppercase text-white">
                          Prévia da Escalação Revelada (4-3-3)
                        </h4>
                      </div>
                      <span className="text-[11px] font-semibold text-amber-300">
                        Exibida ao completar 7×0
                      </span>
                    </div>
                    <div className="mx-auto max-w-md">
                      <TacticalPitch
                        formationId="4-3-3"
                        lineup={selectedBossPreview.lineup}
                        difficulty="classico"
                        campaignStatus="completed"
                        interactive={false}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0E1626] p-12 text-center text-sm text-slate-400">
                  Cadastre um time de Chefão Final ao lado para montar sua escalação de 11 titulares.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isAdmin && subTab === 'squads' && (
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left: Squad Directory */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#0E1626] p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar elenco ou jogador..."
                  className="w-full rounded-xl border border-slate-700 bg-[#070B14] py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setSquadModal({
                    name: '',
                    serie: '',
                    crestUrl: '',
                    isFinalOnly: false,
                  })
                }
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-emerald-400 shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Elenco</span>
              </button>
            </div>

            {!loading && !search.trim() && squads.length > 0 && !squads.some((s) => s.isFinalOnly) && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
                Nenhum time está marcado como <strong>Exclusivo da Final</strong>. Edite ou cadastre um elenco e ative a opção para definir o adversário fixo da Final (fora do Draft).
              </div>
            )}

            {loading ? (
              <p className="py-6 text-center text-xs text-slate-400">
                Carregando elencos...
              </p>
            ) : squads.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                Nenhum elenco encontrado para esta busca.
              </p>
            ) : (
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {squads.map((sq) => {
                  const active = sq.id === selectedSquadId;
                  return (
                    <div
                      key={sq.id}
                      onClick={() => setSelectedSquadId(sq.id)}
                      className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition cursor-pointer ${
                        active
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-800 bg-[#070B14]/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CrestAvatar src={sq.crestUrl} alt={sq.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">
                            {sq.name}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {sq.competition ? `${sq.competition} · ` : ''}
                            <span className="font-mono-num text-emerald-400">
                              {sq.players.length} atletas
                            </span>
                            {sq.isFinalOnly ? (
                              <span className="text-amber-300 font-semibold">
                                {' '}· Exclusivo Final
                              </span>
                            ) : null}
                            {sq.isExample ? ' · Exemplo' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Selected Squad & Players CRUD */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#0E1626] p-5 space-y-5">
            {selectedSquad ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3.5">
                    <CrestAvatar
                      src={selectedSquad.crestUrl}
                      alt={selectedSquad.name}
                      size="lg"
                    />
                    <div>
                      <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase text-white">
                        {selectedSquad.name}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {selectedSquad.competition || 'Série não informada'}
                        {selectedSquad.isFinalOnly && (
                          <span className="ml-2 font-semibold text-amber-300">
                            · Exclusivo da Final (Fora do Draft)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExportSingleSquadJson(selectedSquad)}
                      className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>JSON</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSquadModal({
                          id: selectedSquad.id,
                          name: selectedSquad.name,
                          serie: selectedSquad.competition || '',
                          crestUrl: selectedSquad.crestUrl || '',
                          isFinalOnly: Boolean(selectedSquad.isFinalOnly),
                        })
                      }
                      className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Editar Elenco</span>
                    </button>

                    {confirmDeleteSquadId === selectedSquad.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeleteSquad(selectedSquad.id)}
                          className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSquadId(null)}
                          className="rounded-lg border border-slate-700 px-2.5 py-2 text-xs text-slate-300 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteSquadId(selectedSquad.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Players Header */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Jogadores Cadastrados ({selectedSquad.players.length})
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setPlayerModal({
                        squadId: selectedSquad.id,
                        fullName: '',
                        nickname: '',
                        primaryPosition: 'MEI',
                        rating: 82,
                        isLegendary: false,
                        photoUrl: '',
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-emerald-400 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Adicionar Jogador</span>
                  </button>
                </div>

                {selectedSquad.players.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 bg-[#070B14]/60 p-8 text-center text-xs text-slate-400">
                    Este elenco ainda não tem jogadores cadastrados.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-[#070B14]/60">
                    {selectedSquad.players.map((p: Player) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-[#0E1626]">
                            {p.photoUrl ? (
                              <img
                                src={p.photoUrl}
                                alt={p.nickname}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="font-mono-num text-xs font-extrabold text-emerald-400">
                                {p.primaryPosition}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-bold text-white">
                                {p.nickname}
                              </span>
                              {p.isLegendary && (
                                <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              )}
                            </div>
                            <p className="truncate text-xs text-slate-400">
                              {p.fullName} ·{' '}
                              <span className="font-semibold text-emerald-400">
                                {p.primaryPosition}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono-num rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-extrabold text-emerald-300">
                            {p.rating}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPlayerModal({
                                id: p.id,
                                squadId: p.squadId,
                                fullName: p.fullName,
                                nickname: p.nickname,
                                primaryPosition: p.primaryPosition as PositionCode,
                                rating: p.rating ?? 80,
                                isLegendary: p.isLegendary,
                                photoUrl: p.photoUrl || '',
                              })
                            }
                            title="Editar jogador"
                            className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDeletePlayer(p.id)}
                            title="Excluir jogador"
                            className="rounded-lg border border-rose-500/30 p-1.5 text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-sm text-slate-400">
                Selecione um elenco à esquerda ou cadastre um novo clube/seleção.
              </div>
            )}
          </div>
        </div>
      )}

      {isAdmin && subTab === 'import' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-[#0E1626] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold uppercase text-white">
                  Importação em Massa (CSV ou JSON)
                </h2>
                <p className="text-xs text-slate-400">
                  Envie um arquivo .csv / .json ou cole os dados abaixo para cadastrar dezenas de elencos de uma só vez.
                </p>
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4" />
                <span>Carregar Arquivo</span>
                <input
                  type="file"
                  accept=".csv,.json,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    setBulkText(text);
                  }}
                />
              </label>
            </div>

            <textarea
              rows={12}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`Exemplo CSV:\nsquad_name,serie,crest_url,full_name,nickname,primary_position,rating,is_legendary,photo_url\n"Santos 2011","Série A","","Neymar da Silva Santos Júnior","Neymar","ATQ",96,true,""\n"Santos 2011","Série A","","Danilo Luiz da Silva","Danilo","DEF",85,false,""`}
              className="w-full rounded-xl border border-slate-700 bg-[#070B14] p-4 font-mono text-xs text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
            />

            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy || !bulkText.trim()}
                onClick={handleBulkImport}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>{busy ? 'Importando...' : 'Importar Elencos'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-[#0E1626] p-6 space-y-4">
            <h2 className="font-display text-2xl font-bold uppercase text-white">
              Exportar Banco de Dados
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Baixe todos os elencos e jogadores cadastrados para backup ou edição em planilhas.
            </p>
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleExport('json')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#070B14] px-4 py-3 text-sm font-bold text-slate-100 hover:border-emerald-500/60 cursor-pointer"
              >
                <Download className="h-4 w-4 text-emerald-400" />
                <span>Exportar em JSON</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleExport('csv')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#070B14] px-4 py-3 text-sm font-bold text-slate-100 hover:border-emerald-500/60 cursor-pointer"
              >
                <Download className="h-4 w-4 text-amber-400" />
                <span>Exportar em CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && subTab === 'users' && (
        <div className="rounded-2xl border border-slate-800 bg-[#0E1626] p-6 space-y-4">
          <h2 className="font-display text-2xl font-bold uppercase text-white">
            Permissões de Administradores
          </h2>
          <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-[#070B14]/70">
            {usersList.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-bold text-white">
                    {u.displayName || 'Treinador'}
                  </p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold uppercase ${
                      u.role === 'admin' ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {u.role}
                  </span>
                  <button
                    type="button"
                    disabled={busy || u.id === dbUser?.id}
                    onClick={() => handleToggleUserRole(u)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-40 cursor-pointer"
                  >
                    {u.role === 'admin' ? 'Rebaixar para User' : 'Promover a Admin'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Squad Modal */}
      {squadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSaveSquad}
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0E1626] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display text-2xl font-bold uppercase text-white">
                {squadModal.id ? 'Editar Elenco' : 'Novo Elenco'}
              </h3>
              <button
                type="button"
                onClick={() => setSquadModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nome do Clube ou Seleção *
                </label>
                <input
                  required
                  value={squadModal.name}
                  onChange={(e) =>
                    setSquadModal({ ...squadModal, name: e.target.value })
                  }
                  placeholder="Ex.: Santos 2011"
                  className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Série (opcional)
                </label>
                <input
                  value={squadModal.serie}
                  onChange={(e) =>
                    setSquadModal({ ...squadModal, serie: e.target.value })
                  }
                  placeholder="Ex.: Série A"
                  className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Escudo ou Bandeira (URL ou Upload)
                </label>
                <div className="flex items-center gap-3">
                  <CrestAvatar
                    src={squadModal.crestUrl}
                    alt={squadModal.name || 'Escudo'}
                    size="md"
                  />
                  <input
                    value={squadModal.crestUrl}
                    onChange={(e) =>
                      setSquadModal({ ...squadModal, crestUrl: e.target.value })
                    }
                    placeholder="https://... ou envie uma imagem"
                    className="flex-1 rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2 text-sm text-white"
                  />
                  <label className="rounded-xl border border-slate-700 bg-[#070B14] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-500 cursor-pointer shrink-0">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const uri = await compressImageFileToDataUri(file, 200);
                        setSquadModal({ ...squadModal, crestUrl: uri });
                      }}
                    />
                  </label>
                </div>
              </div>

              <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={squadModal.isFinalOnly}
                  onChange={(e) =>
                    setSquadModal({ ...squadModal, isFinalOnly: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-amber-400"
                />
                <span>
                  <strong className="block text-amber-200">
                    Time de Lendas · Bônus (não entra no Draft)
                  </strong>
                  Jogadores deste elenco não aparecem no sorteio de montagem nem nos 7 jogos normais, sendo desbloqueado como bônus apenas quando o jogador vencer todos os 7 jogos.
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSquadModal(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>{busy ? 'Salvando...' : 'Salvar Elenco'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Player Modal */}
      {playerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleSavePlayer}
            className="w-full max-w-xl rounded-2xl border border-slate-700 bg-[#0E1626] p-6 space-y-4 shadow-2xl my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display text-2xl font-bold uppercase text-white">
                {playerModal.id ? 'Editar Jogador' : 'Adicionar Jogador'}
              </h3>
              <button
                type="button"
                onClick={() => setPlayerModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  required
                  value={playerModal.fullName}
                  onChange={(e) =>
                    setPlayerModal({ ...playerModal, fullName: e.target.value })
                  }
                  placeholder="Ex.: Neymar da Silva Santos Júnior"
                  className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Apelido (exibido no campo) *
                </label>
                <input
                  required
                  value={playerModal.nickname}
                  onChange={(e) =>
                    setPlayerModal({ ...playerModal, nickname: e.target.value })
                  }
                  placeholder="Ex.: Neymar"
                  className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nota (1-100) *
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  max={100}
                  value={playerModal.rating}
                  onChange={(e) =>
                    setPlayerModal({
                      ...playerModal,
                      rating: Number(e.target.value),
                    })
                  }
                  className="font-mono-num w-full rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Posição Principal *
                </label>
                <select
                  value={playerModal.primaryPosition}
                  onChange={(e) => {
                    const nextPos = e.target.value as PositionCode;
                    setPlayerModal({
                      ...playerModal,
                      primaryPosition: nextPos,
                    });
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3 py-2 text-sm text-white"
                >
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2.5 text-sm font-semibold text-amber-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={playerModal.isLegendary}
                    onChange={(e) =>
                      setPlayerModal({
                        ...playerModal,
                        isLegendary: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-amber-400"
                  />
                  <Crown className="h-4 w-4" />
                  <span>Jogador Lendário</span>
                </label>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Foto do Jogador (opcional — URL ou Upload)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    value={playerModal.photoUrl}
                    onChange={(e) =>
                      setPlayerModal({ ...playerModal, photoUrl: e.target.value })
                    }
                    placeholder="https://... ou envie um arquivo"
                    className="flex-1 rounded-xl border border-slate-700 bg-[#070B14] px-3.5 py-2 text-sm text-white"
                  />
                  <label className="rounded-xl border border-slate-700 bg-[#070B14] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-500 cursor-pointer shrink-0">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const uri = await compressImageFileToDataUri(file, 200);
                        setPlayerModal({ ...playerModal, photoUrl: uri });
                      }}
                    />
                  </label>
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPlayerModal(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>{busy ? 'Salvando...' : 'Salvar Jogador'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
