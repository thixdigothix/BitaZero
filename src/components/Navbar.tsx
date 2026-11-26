import { Trophy, Play, Home, Users, LogIn, LogOut, Volume2, VolumeX, HelpCircle, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export type AppTab = 'home' | 'play' | 'how-it-works' | 'achievements' | 'squads' | 'credits';

interface NavbarProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function Navbar({
  activeTab,
  onChangeTab,
  soundEnabled,
  onToggleSound,
}: NavbarProps) {
  const { dbUser, firebaseUser, loading, loginWithGoogle, logout } = useAuth();

  const navItems: Array<{ id: AppTab; label: string; icon: typeof Home }> = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'play', label: 'Jogar', icon: Play },
    { id: 'how-it-works', label: 'Como funciona?', icon: HelpCircle },
    { id: 'achievements', label: 'Conquistas', icon: Trophy },
    { id: 'squads', label: 'Elencos', icon: Users },
    { id: 'credits', label: 'Créditos', icon: Award },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070B14]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Left: Brand */}
        <button
          type="button"
          onClick={() => onChangeTab('home')}
          className="flex items-center gap-3 text-left group shrink-0"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 font-display text-lg font-extrabold tracking-tight text-emerald-400 transition group-hover:border-emerald-400">
            7×0
          </div>
          <div className="leading-none">
            <span className="block font-display text-xl font-extrabold tracking-wider text-slate-100 uppercase">
              BIT A ZERO
            </span>
            <span className="hidden sm:block text-[11px] font-medium tracking-wide text-slate-400">
              Draft de elencos do canal Bit Fut
            </span>
          </div>
        </button>

        {/* Center: Primary Navigation */}
        <nav
          aria-label="Navegação principal"
          className="flex items-center gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-[#0E1626] p-1"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition ${
                  active
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Sound & Auth */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleSound}
            title={soundEnabled ? 'Desativar sons' : 'Ativar sons'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-[#0E1626] text-slate-300 transition hover:border-slate-700 hover:text-white"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-500" />
            )}
          </button>

          {loading ? (
            <div className="h-9 w-24 rounded-lg bg-slate-800/70 animate-pulse" />
          ) : firebaseUser ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0E1626] px-2.5 py-1.5">
              <div className="hidden md:block text-right leading-tight">
                <p className="text-xs font-semibold text-slate-100 max-w-[120px] truncate">
                  {dbUser?.displayName || firebaseUser.displayName || 'Treinador'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {dbUser?.role === 'admin' ? 'Administrador' : 'Treinador'}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sair da conta"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={loginWithGoogle}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0E1626] px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-100 transition hover:border-emerald-500/60 hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <LogIn className="h-3.5 w-3.5 text-emerald-400" />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
