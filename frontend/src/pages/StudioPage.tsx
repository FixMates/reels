import React, { useState, useEffect } from 'react';
import { Project } from '../types/project';
import { api } from '../api/client';
import { MediaBrowserTab } from '../editor/MediaBrowserTab';
import { ItemCaptionEditorTab } from '../editor/ItemCaptionEditorTab';
import { CropCompositionTab } from '../editor/CropCompositionTab';
import { VoicePanelTab } from '../editor/VoicePanelTab';
import { SubtitleSettingsTab } from '../editor/SubtitleSettingsTab';
import { BrandingTemplatesTab } from '../editor/BrandingTemplatesTab';
import { AudioMixerTab } from '../editor/AudioMixerTab';
import { TimelineTab } from '../editor/TimelineTab';
import { ExportPreviewTab } from '../editor/ExportPreviewTab';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ChevronLeft, ChevronRight, Eye, Film, Sparkles } from 'lucide-react';

interface StudioPageProps {
  project: Project;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onProjectUpdate: (p: Project) => void;
}

const TABS = [
  { id: 'browser', label: '1. Media', short: 'Media' },
  { id: 'editor', label: '2. Caption & Voice', short: 'Narration' },
  { id: 'crop', label: '3. Crop & Layout', short: 'Crop' },
  { id: 'timeline', label: '4. Timeline', short: 'Timeline' },
  { id: 'subtitles', label: '5. Captions Style', short: 'Captions' },
  { id: 'branding', label: '6. Branding', short: 'Branding' },
  { id: 'audio', label: '7. Audio Mix', short: 'Audio' },
  { id: 'export', label: '8. Export', short: 'Export' },
];

export const StudioPage: React.FC<StudioPageProps> = ({
  project,
  activeTab,
  onTabChange,
  onProjectUpdate
}) => {
  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    project.scenes[0]?.id || ''
  );

  useEffect(() => {
    if (!selectedSceneId && project.scenes.length > 0) {
      setSelectedSceneId(project.scenes[0].id);
    }
  }, [project.scenes]);

  const handleSelectItem = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    onTabChange('editor'); // Switch to item editor
  };

  const currentTabIdx = Math.max(0, TABS.findIndex(t => t.id === activeTab));
  const prevTab = currentTabIdx > 0 ? TABS[currentTabIdx - 1] : null;
  const nextTab = currentTabIdx < TABS.length - 1 ? TABS[currentTabIdx + 1] : null;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 animate-in fade-in duration-200">
      {/* Mobile Tab Stepper / Scrollable Bar */}
      <div className="lg:hidden mb-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 px-1">
          <span className="font-semibold text-slate-300">
            Step {currentTabIdx + 1} of {TABS.length}: <span className="text-sky-400">{TABS[currentTabIdx]?.short}</span>
          </span>
          <div className="flex items-center gap-1">
            {prevTab && (
              <button
                onClick={() => onTabChange(prevTab.id)}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-0.5"
                title={`Go to ${prevTab.short}`}
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Prev</span>
              </button>
            )}
            {nextTab && (
              <button
                onClick={() => onTabChange(nextTab.id)}
                className="px-2 py-1 rounded bg-sky-500/20 border border-sky-500/30 text-sky-300 hover:text-white flex items-center gap-0.5 font-medium"
                title={`Go to ${nextTab.short}`}
              >
                <span>Next</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex overflow-x-auto no-scrollbar gap-1.5 pb-2 text-xs">
          {TABS.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-2 rounded-xl whitespace-nowrap font-medium text-xs transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                    : 'bg-slate-900/90 text-slate-400 border border-slate-800/80 active:bg-slate-800'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  isActive ? 'bg-slate-950 text-white font-mono' : 'bg-slate-800 text-slate-400'
                }`}>
                  {idx + 1}
                </span>
                <span>{tab.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Active Tab wrapped in ErrorBoundary */}
      <ErrorBoundary
        fallbackTitle={`Error loading ${TABS[currentTabIdx]?.label || 'tab'}`}
        onReset={() => onTabChange(activeTab)}
      >
        {activeTab === 'browser' && (
          <MediaBrowserTab
            project={project}
            onProjectUpdate={onProjectUpdate}
            onSelectItem={handleSelectItem}
          />
        )}

        {activeTab === 'editor' && (
          <ItemCaptionEditorTab
            project={project}
            currentSceneId={selectedSceneId}
            onProjectUpdate={onProjectUpdate}
            onNavigateScene={setSelectedSceneId}
          />
        )}

        {activeTab === 'crop' && (
          <CropCompositionTab
            project={project}
            currentSceneId={selectedSceneId}
            onProjectUpdate={onProjectUpdate}
          />
        )}

        {activeTab === 'voice' && (
          <VoicePanelTab
            project={project}
            currentSceneId={selectedSceneId}
            onProjectUpdate={onProjectUpdate}
          />
        )}

        {activeTab === 'subtitles' && (
          <SubtitleSettingsTab
            project={project}
            onProjectUpdate={onProjectUpdate}
          />
        )}

        {activeTab === 'branding' && (
          <BrandingTemplatesTab
            project={project}
            onProjectUpdate={onProjectUpdate}
          />
        )}

        {activeTab === 'audio' && (
          <AudioMixerTab
            project={project}
            onProjectUpdate={onProjectUpdate}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineTab
            project={project}
            onSelectItem={handleSelectItem}
          />
        )}

        {activeTab === 'export' && (
          <ExportPreviewTab
            project={project}
            onProjectUpdate={onProjectUpdate}
          />
        )}
      </ErrorBoundary>
    </div>
  );
};

