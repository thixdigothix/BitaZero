import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../lib/api.ts';
import { soundFx } from '../lib/sound.ts';
import { GameDifficulty, PlayStyle } from '../shared/gameLogic.ts';
import { CampaignPayload, BonusMatchResult } from '../types/game.ts';
import { DraftSetup } from './DraftSetup.tsx';
import { DraftWorkspace } from './DraftWorkspace.tsx';
import { TournamentView } from './TournamentView.tsx';
import { LegendsBonusView } from './LegendsBonusView.tsx';

interface PlayViewProps {
  initialCampaignId: number | null;
  totalSquads: number;
  soundEnabled: boolean;
  onCampaignChanged: () => void;
  onClearInitialCampaign: () => void;
}

export function PlayView({
  initialCampaignId,
  totalSquads,
  soundEnabled,
  onCampaignChanged,
  onClearInitialCampaign,
}: PlayViewProps) {
  const { dbUser, idToken, guestToken } = useAuth();
  const [payload, setPayload] = useState<CampaignPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLegendsBonus, setShowLegendsBonus] = useState(false);
  const [bonusMatch, setBonusMatch] = useState<BonusMatchResult | null>(null);
  const [simulatingBonus, setSimulatingBonus] = useState(false);
  const [bonusError, setBonusError] = useState<string | null>(null);

  const loadCampaign = useCallback(
    async (campaignId: number) => {
      setLoading(true);
      setError(null);
      setShowLegendsBonus(false);
      setBonusMatch(null);
      setBonusError(null);
      try {
        const res = await apiFetch<CampaignPayload>(
          `/api/campaigns/${campaignId}`,
          {},
          idToken
        );
        setPayload(res);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar campanha.');
      } finally {
        setLoading(false);
      }
    },
    [idToken]
  );

  useEffect(() => {
    if (initialCampaignId) {
      loadCampaign(initialCampaignId);
    }
  }, [initialCampaignId, loadCampaign]);

  const handleCreateCampaign = async (params: {
    formation: string;
    style: PlayStyle;
    difficulty: GameDifficulty;
    coachName: string;
  }) => {
    setBusy(true);
    setError(null);
    setShowLegendsBonus(false);
    setBonusMatch(null);
    setBonusError(null);
    try {
      const res = await apiFetch<CampaignPayload>(
        '/api/campaigns',
        {
          method: 'POST',
          body: JSON.stringify({
            ...params,
            guestToken,
          }),
        },
        idToken
      );
      setPayload(res);
      if (soundEnabled) soundFx.whistle();
      onCampaignChanged();
    } catch (err: any) {
      setError(err.message || 'Não foi possível iniciar o draft.');
    } finally {
      setBusy(false);
    }
  };

  const handlePickPlayer = async (playerId: number, slotIndex: number) => {
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<CampaignPayload>(
        `/api/campaigns/${payload.campaign.id}/pick`,
        {
          method: 'POST',
          body: JSON.stringify({ playerId, slotIndex }),
        },
        idToken
      );
      setPayload(res);
      if (soundEnabled) soundFx.pick();
      onCampaignChanged();
    } catch (err: any) {
      setError(err.message || 'Erro ao escalar jogador.');
    } finally {
      setBusy(false);
    }
  };

  const handleSkipSquad = async () => {
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<CampaignPayload>(
        `/api/campaigns/${payload.campaign.id}/skip`,
        { method: 'POST' },
        idToken
      );
      setPayload(res);
      if (soundEnabled) soundFx.skip();
    } catch (err: any) {
      setError(err.message || 'Erro ao trocar elenco.');
    } finally {
      setBusy(false);
    }
  };

  const handleSimulateNext = async () => {
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<CampaignPayload>(
        `/api/campaigns/${payload.campaign.id}/simulate-next`,
        { method: 'POST' },
        idToken
      );
      setPayload(res);
      const lastMatch = res.matches[res.matches.length - 1];
      if (soundEnabled && lastMatch) {
        if (lastMatch.homeScore > lastMatch.awayScore) soundFx.goal();
        else soundFx.whistle();
      }
      if (
        res.campaign.status === 'completed' &&
        res.campaign.wins === 7 &&
        res.finalBoss
      ) {
        setShowLegendsBonus(true);
      }
      onCampaignChanged();
    } catch (err: any) {
      setError(err.message || 'Erro ao simular partida.');
    } finally {
      setBusy(false);
    }
  };

  const handleSimulateAll = async () => {
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<CampaignPayload>(
        `/api/campaigns/${payload.campaign.id}/simulate-all`,
        { method: 'POST' },
        idToken
      );
      setPayload(res);
      if (soundEnabled) {
        if (res.campaign.isChampion) soundFx.goal();
        else soundFx.whistle();
      }
      if (
        res.campaign.status === 'completed' &&
        res.campaign.wins === 7 &&
        res.finalBoss
      ) {
        setShowLegendsBonus(true);
      }
      onCampaignChanged();
    } catch (err: any) {
      setError(err.message || 'Erro ao simular competição.');
    } finally {
      setBusy(false);
    }
  };

  const handleSimulateBonus = async () => {
    if (!payload) return;
    setSimulatingBonus(true);
    setBonusError(null);
    try {
      const res = await apiFetch<BonusMatchResult>(
        `/api/campaigns/${payload.campaign.id}/simulate-bonus`,
        { method: 'POST' },
        idToken
      );
      setBonusMatch(res);
      if (soundEnabled) {
        if (res.homeScore > res.awayScore) soundFx.goal();
        else soundFx.whistle();
      }
    } catch (err: any) {
      setBonusError(err.message || 'Erro ao simular confronto bônus.');
    } finally {
      setSimulatingBonus(false);
    }
  };

  const handleResetToSetup = () => {
    setPayload(null);
    setError(null);
    setShowLegendsBonus(false);
    setBonusMatch(null);
    setBonusError(null);
    onClearInitialCampaign();
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#0E1626] p-10 text-center text-sm text-slate-400">
        Carregando dados da campanha...
      </div>
    );
  }

  if (!payload) {
    return (
      <DraftSetup
        defaultCoachName={dbUser?.displayName || 'Treinador'}
        totalSquads={totalSquads}
        creating={busy}
        error={error}
        onCreateCampaign={handleCreateCampaign}
      />
    );
  }

  if (
    showLegendsBonus &&
    payload.campaign.status === 'completed' &&
    payload.campaign.wins === 7 &&
    payload.finalBoss
  ) {
    return (
      <LegendsBonusView
        payload={payload}
        bonusMatch={bonusMatch}
        simulatingBonus={simulatingBonus}
        bonusError={bonusError}
        onSimulateBonus={handleSimulateBonus}
        onBackToTournament={() => setShowLegendsBonus(false)}
        onNewCampaign={handleResetToSetup}
      />
    );
  }

  if (
    payload.campaign.status === 'simulating' ||
    payload.campaign.status === 'completed'
  ) {
    return (
      <TournamentView
        payload={payload}
        busy={busy}
        error={error}
        onSimulateNext={handleSimulateNext}
        onSimulateAll={handleSimulateAll}
        onOpenLegendsBonus={() => setShowLegendsBonus(true)}
        onNewCampaign={handleResetToSetup}
      />
    );
  }

  return (
    <DraftWorkspace
      payload={payload}
      busy={busy}
      error={error}
      onPickPlayer={handlePickPlayer}
      onSkipSquad={handleSkipSquad}
      onStartTournament={handleSimulateNext}
      onNewDraft={handleResetToSetup}
    />
  );
}
