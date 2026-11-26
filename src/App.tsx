import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { apiFetch } from './lib/api.ts';
import { Campaign, Squad, UnlockedAchievement } from './types/game.ts';
import { AppTab, Navbar } from './components/Navbar.tsx';
import { HomeView } from './components/HomeView.tsx';
import { PlayView } from './components/PlayView.tsx';
import { HowItWorksView } from './components/HowItWorksView.tsx';
import { AchievementsView } from './components/AchievementsView.tsx';
import { SquadsShowcaseView } from './components/SquadsShowcaseView.tsx';
import { CreditsView } from './components/CreditsView.tsx';

function GameShell() {
  const { idToken, guestToken } = useAuth();
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [totalSquads, setTotalSquads] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [recentSquads, setRecentSquads] = useState<Squad[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
  const [bestCampaigns, setBestCampaigns] = useState<Campaign[]>([]);
  const [activeDraft, setActiveDraft] = useState<Campaign | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

  const [unlockedAchievements, setUnlockedAchievements] = useState<
    UnlockedAchievement[]
  >([]);
  const [globalAchievementCounts, setGlobalAchievementCounts] = useState<
    Array<{ code: string; count: number }>
  >([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [loadingAchievements, setLoadingAchievements] = useState(false);

  const loadHomeData = useCallback(async () => {
    setLoadingHome(true);
    setHomeError(null);
    try {
      const [summaryRes, campaignsRes] = await Promise.all([
        apiFetch<{
          totalSquads: number;
          totalPlayers: number;
          recentSquads: Squad[];
        }>('/api/squads/summary', {}, idToken),
        apiFetch<{
          recent: Campaign[];
          best: Campaign[];
          activeDraft: Campaign | null;
        }>(
          `/api/campaigns?guestToken=${encodeURIComponent(guestToken)}`,
          {},
          idToken
        ),
      ]);

      setTotalSquads(summaryRes.totalSquads);
      setTotalPlayers(summaryRes.totalPlayers);
      setRecentSquads(summaryRes.recentSquads);
      setRecentCampaigns(campaignsRes.recent);
      setBestCampaigns(campaignsRes.best);
      setActiveDraft(campaignsRes.activeDraft);
    } catch (err: any) {
      console.error('Failed to load home overview:', err);
      setHomeError(err.message || 'Não foi possível carregar os dados iniciais.');
    } finally {
      setLoadingHome(false);
    }
  }, [idToken, guestToken]);

  const loadAchievements = useCallback(async () => {
    setLoadingAchievements(true);
    try {
      const res = await apiFetch<{
        unlocked: UnlockedAchievement[];
        globalCounts: Array<{ code: string; count: number }>;
      }>(
        `/api/achievements?guestToken=${encodeURIComponent(guestToken)}`,
        {},
        idToken
      );
      setUnlockedAchievements(res.unlocked);
      setGlobalAchievementCounts(res.globalCounts);
    } catch (err) {
      console.error('Failed to load achievements:', err);
    } finally {
      setLoadingAchievements(false);
    }
  }, [idToken, guestToken]);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  useEffect(() => {
    if (activeTab === 'achievements') {
      loadAchievements();
    }
  }, [activeTab, loadAchievements]);

  const handleOpenCampaign = (campaignId: number) => {
    setSelectedCampaignId(campaignId);
    setActiveTab('play');
  };

  const handleStartPlay = () => {
    if (activeDraft) {
      setSelectedCampaignId(activeDraft.id);
    } else {
      setSelectedCampaignId(null);
    }
    setActiveTab('play');
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-[#F1F5F9] flex flex-col">
      <Navbar
        activeTab={activeTab}
        onChangeTab={(tab) => {
          if (tab === 'play' && !selectedCampaignId && activeDraft) {
            setSelectedCampaignId(activeDraft.id);
          }
          setActiveTab(tab);
        }}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {homeError && activeTab === 'home' && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span>{homeError}</span>
            <button
              type="button"
              onClick={loadHomeData}
              className="rounded-lg border border-rose-400/40 px-3 py-1 text-xs font-bold hover:bg-rose-500/20 cursor-pointer shrink-0"
            >
              Tentar novamente
            </button>
          </div>
        )}
        {activeTab === 'home' && (
          <HomeView
            totalSquads={totalSquads}
            totalPlayers={totalPlayers}
            recentSquads={recentSquads}
            recentCampaigns={recentCampaigns}
            bestCampaigns={bestCampaigns}
            activeDraft={activeDraft}
            loading={loadingHome}
            onStartPlay={handleStartPlay}
            onResumeDraft={handleOpenCampaign}
            onOpenSquads={() => setActiveTab('squads')}
            onOpenCampaign={handleOpenCampaign}
          />
        )}

        {activeTab === 'play' && (
          <PlayView
            initialCampaignId={selectedCampaignId}
            totalSquads={totalSquads}
            soundEnabled={soundEnabled}
            onCampaignChanged={loadHomeData}
            onClearInitialCampaign={() => setSelectedCampaignId(null)}
          />
        )}

        {activeTab === 'how-it-works' && (
          <HowItWorksView onStartPlay={handleStartPlay} />
        )}

        {activeTab === 'achievements' && (
          <AchievementsView
            unlocked={unlockedAchievements}
            globalCounts={globalAchievementCounts}
            loading={loadingAchievements}
          />
        )}

        {activeTab === 'squads' && <SquadsShowcaseView />}

        {activeTab === 'credits' && <CreditsView />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GameShell />
    </AuthProvider>
  );
}
