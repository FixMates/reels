import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Mic, Play, RefreshCw, AlertCircle, Check, Sparkles, Volume2, ShieldAlert, Sliders, Layers, Eye, EyeOff } from 'lucide-react';
import { Project, Scene } from '../types/project';
import { api } from '../api/client';
import { AudioWaveformPlayer } from '../components/AudioWaveformPlayer';
import { SafeZoneOverlay } from '../components/SafeZoneOverlay';

interface ItemCaptionEditorTabProps {
  project: Project;
  currentSceneId?: string;
  onProjectUpdate: (p: Project) => void;
  onNavigateScene: (sceneId: string) => void;
}

export const ItemCaptionEditorTab: React.FC<ItemCaptionEditorTabProps> = ({
  project,
  currentSceneId,
  onProjectUpdate,
  onNavigateScene
}) => {
  const scenes = project.scenes;
  const currentIndex = Math.max(0, scenes.findIndex(s => s.id === currentSceneId));
  const activeScene = scenes[currentIndex] || scenes[0];

  // Local state for instant typing response
  const [headline, setHeadline] = useState('');
  const [caption, setCaption] = useState('');
  const [narration, setNarration] = useState('');
  const [fitMode, setFitMode] = useState<'fit' | 'fill' | 'blur_bg' | 'card'>('fit');
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isSaved, setIsSaved] = useState(true);

  // Sync state whenever activeScene changes
  useEffect(() => {
    if (activeScene) {
      setHeadline(activeScene.headline || '');
      setCaption(activeScene.caption || '');
      setNarration(activeScene.narration_script || '');
      setFitMode(activeScene.fit_mode || 'fit');
      setIsSaved(true);
    }
  }, [activeScene?.id]);

  if (!activeScene) {
    return (
      <div className="text-center py-20 text-slate-400">
        No scenes available in this project. Please import media first.
      </div>
    );
  }

  // Auto-save debounced or on blur/navigation
  const saveCurrentScene = async (overrides?: Partial<Scene>) => {
    try {
      const updates = {
        headline,
        caption,
        narration_script: narration,
        fit_mode: fitMode,
        ...overrides
      };
      await api.updateScene(activeScene.id, updates);
      setIsSaved(true);
      const updated = await api.getProject(project.id);
      onProjectUpdate(updated);
    } catch (err: any) {
      console.error('Failed to save scene:', err);
    }
  };

  const goToScene = async (newIdx: number) => {
    if (newIdx < 0 || newIdx >= scenes.length) return;
    await saveCurrentScene();
    onNavigateScene(scenes[newIdx].id);
  };

  const handleGenerateVoice = async () => {
    if (!narration.trim()) {
      alert('Please enter a narration script first.');
      return;
    }
    try {
      setIsGeneratingVoice(true);
      await saveCurrentScene();
      const res = await api.generateSceneVoice(
        activeScene.id,
        project.voice_id || undefined,
        project.voice_rate,
        project.voice_volume
      );
      const updated = await api.getProject(project.id);
      onProjectUpdate(updated);
    } catch (err: any) {
      alert(`Voice generation failed: ${err.message}`);
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  // Word count & Duration estimation
  const wordCount = narration.trim() ? narration.trim().split(/\s+/).length : 0;
  // Standard speech is ~150-175 words per minute -> ~2.6 words per second
  const estimatedSeconds = Math.max(1.5, (wordCount / (project.voice_rate / 60)) + project.end_padding_seconds);

  // Substantial discrepancy detection
  const isDiscrepant = Boolean(
    caption.trim() &&
    narration.trim() &&
    Math.abs(caption.length - narration.length) > 40 &&
    !narration.toLowerCase().includes(caption.toLowerCase().slice(0, 15))
  );

  const applyFooterToAll = async () => {
    if (!caption.trim() && !headline.trim()) return;
    if (!confirm('Apply this headline & caption template to all scenes in this project?')) return;
    try {
      for (const s of scenes) {
        await api.updateScene(s.id, {
          headline: headline.trim(),
          caption: caption.trim()
        });
      }
      const updated = await api.getProject(project.id);
      onProjectUpdate(updated);
      alert('Applied template to all scenes!');
    } catch (err: any) {
      alert(`Error applying to all: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Stepper & Navigation Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToScene(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors"
              title="Previous Item"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => goToScene(currentIndex + 1)}
              disabled={currentIndex === scenes.length - 1}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors"
              title="Next Item"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-white text-sm sm:text-base">
                Slide {currentIndex + 1} of {scenes.length}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${activeScene.is_included ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                {activeScene.is_included ? 'Included' : 'Excluded'}
              </span>
            </div>
            <span className="text-xs text-slate-400 truncate max-w-[150px] sm:max-w-xs block font-mono">
              {activeScene.source_filename || `Page ${activeScene.page_number}`}
            </span>
          </div>
        </div>

        {/* Right quick toggles */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setShowMobilePreview(!showMobilePreview)}
            className="lg:hidden px-2.5 py-1.5 rounded-xl text-xs font-medium border border-slate-700 bg-slate-800 text-slate-300"
          >
            {showMobilePreview ? 'Hide Preview' : 'Show Preview'}
          </button>

          <button
            onClick={() => setShowSafeZone(!showSafeZone)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showSafeZone
                ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {showSafeZone ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Social Safe Zone</span>
          </button>

          <button
            onClick={async () => {
              const nextInc = !activeScene.is_included;
              await api.updateScene(activeScene.id, { is_included: nextInc });
              const updated = await api.getProject(project.id);
              onProjectUpdate(updated);
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              activeScene.is_included
                ? 'bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}
          >
            {activeScene.is_included ? 'Exclude' : 'Include'}
          </button>
        </div>
      </div>

      {/* Main 2-Column Split Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Big Interactive Canvas Preview */}
        <div className={`lg:col-span-5 flex-col items-center ${showMobilePreview ? 'flex' : 'hidden lg:flex'}`}>
          <div className="w-full max-w-sm aspect-[9/16] relative rounded-3xl overflow-hidden border-2 border-slate-800 bg-slate-950 shadow-2xl flex items-center justify-center">
            {/* Safe Zone Guides */}
            <SafeZoneOverlay platform="reels" visible={showSafeZone} />

            {/* Simulated Live Composition Preview */}
            <div className="absolute inset-0 flex flex-col justify-between p-4 z-10 pointer-events-none">
              {/* Headline Badge */}
              {headline.trim() && (
                <div className="w-full bg-slate-950/90 border border-sky-400/40 rounded-xl p-2.5 shadow-lg backdrop-blur-md text-center">
                  <span className="font-heading font-bold text-white text-xs leading-tight">
                    {headline}
                  </span>
                </div>
              )}

              {/* Subtitle / Caption live preview */}
              <div className="w-full flex flex-col gap-2">
                {narration.trim() && (
                  <div className="self-center bg-black/85 text-yellow-300 font-bold px-3 py-1 rounded-lg text-xs shadow-md border border-yellow-400/30 text-center max-w-[90%]">
                    {narration.split(/\s+/).slice(0, 7).join(' ')}...
                  </div>
                )}
                {caption.trim() && (
                  <div className="w-full bg-slate-950/90 border border-slate-700 rounded-lg p-2 text-center text-[11px] text-slate-200">
                    {caption}
                  </div>
                )}
              </div>
            </div>

            {/* Background for fitMode */}
            {fitMode === 'blur_bg' ? (
              <>
                <img
                  src={activeScene.thumbnail_url}
                  alt="bg"
                  className="absolute inset-0 w-full h-full object-cover blur-xl scale-125 opacity-40"
                />
                <img
                  src={activeScene.thumbnail_url}
                  alt="preview"
                  style={{
                    transform: `rotate(${activeScene.rotation}deg) scaleX(${activeScene.flip_h ? -1 : 1})`
                  }}
                  className="relative max-h-[70%] max-w-[85%] object-contain rounded-xl shadow-2xl border border-white/10"
                />
              </>
            ) : fitMode === 'card' ? (
              <div className="p-4 w-full flex items-center justify-center">
                <div className="bg-slate-900/90 p-3 rounded-2xl border-2 border-sky-500/50 shadow-2xl">
                  <img
                    src={activeScene.thumbnail_url}
                    alt="preview"
                    style={{
                      transform: `rotate(${activeScene.rotation}deg) scaleX(${activeScene.flip_h ? -1 : 1})`
                    }}
                    className="max-h-[280px] object-contain rounded-lg"
                  />
                </div>
              </div>
            ) : fitMode === 'fill' ? (
              <img
                src={activeScene.thumbnail_url}
                alt="preview"
                style={{
                  transform: `rotate(${activeScene.rotation}deg) scaleX(${activeScene.flip_h ? -1 : 1})`
                }}
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={activeScene.thumbnail_url}
                alt="preview"
                style={{
                  transform: `rotate(${activeScene.rotation}deg) scaleX(${activeScene.flip_h ? -1 : 1})`
                }}
                className="max-h-[85%] max-w-[90%] object-contain rounded-lg"
              />
            )}
          </div>

          {/* Quick Fit Mode Selector */}
          <div className="flex items-center gap-1.5 mt-3 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            {(['fit', 'blur_bg', 'fill', 'card'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => {
                  setFitMode(mode);
                  saveCurrentScene({ fit_mode: mode });
                }}
                className={`px-3 py-1 rounded-lg capitalize font-medium transition-colors ${
                  fitMode === mode
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Dedicated Inputs & Voice Studio */}
        <div className="lg:col-span-7 space-y-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-xl">
          {/* Top Headline Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Top Headline (Hook)
              </label>
              <span className="text-[11px] text-slate-500">
                Visible bold badge on top
              </span>
            </div>
            <input
              type="text"
              value={headline}
              onChange={e => {
                setHeadline(e.target.value);
                setIsSaved(false);
              }}
              onBlur={() => saveCurrentScene()}
              placeholder="e.g. 3 Mistakes Traders Make When Spotting Order Blocks"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 focus:border-sky-400 focus:outline-none text-white text-sm"
            />
          </div>

          {/* Spoken Narration Script Input — MANDATORY CORE */}
          <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-sky-400" />
                Spoken AI Narration Script
              </label>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">{wordCount} words</span>
                <span className="text-sky-400 font-semibold">≈ {estimatedSeconds.toFixed(1)}s speech</span>
              </div>
            </div>

            <textarea
              rows={4}
              value={narration}
              onChange={e => {
                setNarration(e.target.value);
                setIsSaved(false);
              }}
              onBlur={() => saveCurrentScene()}
              placeholder="Enter what the voice should say for this specific slide. (e.g. First, verify whether price has revisited the breaker block before looking for an entry.)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-sky-400 focus:outline-none text-white text-sm leading-relaxed"
            />

            {/* Audio Synthesis & Waveform Player */}
            <div className="pt-2 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleGenerateVoice}
                  disabled={isGeneratingVoice || !narration.trim()}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-sky-500/25 transition-all active:scale-95 disabled:opacity-40"
                >
                  {isGeneratingVoice ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing Voice...</span>
                    </>
                  ) : activeScene.audio_path ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerate Speech</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      <span>Generate Voice for Slide</span>
                    </>
                  )}
                </button>

                <div className="text-xs text-slate-400">
                  Engine: <span className="text-slate-200 font-semibold">Local Offline Windows SAPI</span>
                </div>
              </div>

              {activeScene.audio_url && (
                <AudioWaveformPlayer
                  src={activeScene.audio_url}
                  duration={activeScene.measured_audio_duration}
                  label={`Narration Audio (${activeScene.measured_audio_duration.toFixed(1)}s measured)`}
                />
              )}
            </div>
          </div>

          {/* Bottom Visible Caption */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Bottom Visible Caption (Optional)
              </label>
              <span className="text-[11px] text-slate-500">
                Permanent footer text on slide
              </span>
            </div>
            <input
              type="text"
              value={caption}
              onChange={e => {
                setCaption(e.target.value);
                setIsSaved(false);
              }}
              onBlur={() => saveCurrentScene()}
              placeholder="e.g. Always wait for market structure confirmation."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 focus:border-sky-400 focus:outline-none text-white text-sm"
            />
          </div>

          {/* Discrepancy Warning Notice */}
          {isDiscrepant && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-semibold block">Notice: Caption and Narration differ</span>
                <span className="text-[11px] text-amber-200/80">
                  The spoken voiceover will read your narration script while the bottom caption will show the shorter footer text. Both will be preserved.
                </span>
              </div>
            </div>
          )}

          {/* Bulk Action & Scene Timing Details */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <button
              type="button"
              onClick={applyFooterToAll}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Apply Headline & Footer to All Slides
            </button>

            <div className="flex items-center gap-2 text-slate-400">
              <span>Scene Total Duration:</span>
              <span className="font-mono text-white font-bold bg-slate-800 px-2 py-0.5 rounded">
                {activeScene.scene_duration.toFixed(1)}s
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
