import React, { useState } from 'react';
import { Video, Sparkles, Activity, Layers, ArrowLeft, Download, Film, Settings, Menu, X } from 'lucide-react';
import { Project, SystemHealth } from '../types/project';

interface NavbarProps {
  project?: Project | null;
  onBackToDashboard?: () => void;
  onOpenHealth: () => void;
  onTriggerRender?: () => void;
  health: SystemHealth | null;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const NAV_TABS = [
  { id: 'browser', label: '1. Media' },
  { id: 'editor', label: '2. Caption & Voice' },
  { id: 'crop', label: '3. Crop & Layout' },
  { id: 'timeline', label: '4. Timeline' },
  { id: 'subtitles', label: '5. Captions Style' },
  { id: 'branding', label: '6. Branding' },
  { id: 'audio', label: '7. Audio Mix' },
  { id: 'export', label: '8. Export' },
];

export const Navbar: React.FC<NavbarProps> = ({
  project,
  onBackToDashboard,
  onOpenHealth,
  onTriggerRender,
  health,
  activeTab,
  onTabChange
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isHealthy = health?.ffmpeg?.ffmpeg_available ?? true;

  const handleSelectTab = (tabId: string) => {
    if (onTabChange) onTabChange(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="h-14 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-4 flex items-center justify-between gap-2">
        {/* Left: Brand / Project Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {project ? (
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors border border-slate-800 shrink-0"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Dashboard</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
                <Film className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-heading font-bold text-sm sm:text-base bg-gradient-to-r from-sky-400 via-indigo-200 to-white bg-clip-text text-transparent">
                  Antigravity Studio
                </span>
                <span className="text-[10px] text-sky-400/80 block -mt-1 font-mono">LOCAL REELS</span>
              </div>
            </div>
          )}

          {project && (
            <div className="flex items-center gap-1.5 pl-1.5 sm:pl-2 border-l border-slate-800 min-w-0">
              <span className="font-medium text-white text-xs sm:text-sm max-w-[90px] xs:max-w-[130px] sm:max-w-[200px] truncate" title={project.title}>
                {project.title}
              </span>
              <span className="hidden md:inline text-[10px] sm:text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700/60 shrink-0">
                {project.aspect_ratio}
              </span>
            </div>
          )}
        </div>

        {/* Center: Tabs if inside Studio Project (Desktop) */}
        {project && onTabChange && (
          <div className="hidden lg:flex items-center bg-slate-900/90 border border-slate-800 p-1 rounded-xl gap-0.5 text-xs">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-sky-500 text-slate-950 shadow-sm shadow-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Right: Diagnostics & Action */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            onClick={onOpenHealth}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
            title="System Health and Engine Diagnostics"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Engine Ready</span>
          </button>

          {project && onTriggerRender && (
            <button
              onClick={onTriggerRender}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-lg shadow-sky-500/25 transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span className="hidden xs:inline">Render Reel</span>
              <span className="xs:hidden">Render</span>
            </button>
          )}

          {/* Mobile Menu Toggle for Quick Tabs (shown on < lg when inside project) */}
          {project && onTabChange && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              title="Open Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          )}
        </div>
      </header>

      {/* Mobile Drawer / Dropdown */}
      {project && mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-14 bg-slate-950/95 backdrop-blur-lg border-b border-slate-800 p-4 z-50 shadow-2xl animate-in slide-in-from-top-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Studio Workflow Tabs
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`p-2.5 rounded-xl text-left font-medium transition-colors border ${
                  activeTab === tab.id
                    ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

