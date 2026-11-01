import { Link, useLocation } from 'react-router-dom';
import { Activity, History, GitCompare, Sun, Moon, Zap } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

const navLinks = [
  { to: '/', label: 'Analyze', icon: Activity },
  { to: '/history', label: 'History', icon: History },
  { to: '/compare', label: 'Compare', icon: GitCompare },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/8 backdrop-blur-xl bg-dark-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group" aria-label="Social Pulse Home">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shadow-lg shadow-brand-500/30 group-hover:scale-105 transition-transform">
                <Zap className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-lg text-gradient hidden sm:block">Social Pulse</span>
            </Link>

            {/* Nav links */}
            <nav className="flex items-center gap-1" aria-label="Main navigation">
              {navLinks.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-brand-500/15 text-brand-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:block">{label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all duration-200"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-600">
        Social Pulse — AI-powered comment sentiment analysis. Data processed via official YouTube Data API v3.
      </footer>
    </div>
  );
}
