import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Type, Sparkles, Check, Sliders, Eye, RefreshCw, AlertCircle, Save, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { Project, SubtitleStyleConfig } from '../types/project';
import { api } from '../api/client';

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyleConfig = {
  burn_in: true,
  font_family: 'Arial',
  font_size: 44,
  text_color: '#FFFFFF',
  highlight_color: '#FACC15',
  bg_color: '#000000',
  bg_opacity: 0.65,
  position_y: 'bottom',
  max_chars_per_line: 34,
  safe_margin_pct: 12.0,
  mode: 'word_highlight'
};

export function normalizeSubtitleStyle(raw?: any): SubtitleStyleConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SUBTITLE_STYLE };
  }
  return {
    burn_in: typeof raw.burn_in === 'boolean' ? raw.burn_in : DEFAULT_SUBTITLE_STYLE.burn_in,
    font_family: typeof raw.font_family === 'string' && raw.font_family.trim() ? raw.font_family : DEFAULT_SUBTITLE_STYLE.font_family,
    font_size: typeof raw.font_size === 'number' && !isNaN(raw.font_size) && raw.font_size >= 10 ? raw.font_size : DEFAULT_SUBTITLE_STYLE.font_size,
    text_color: typeof raw.text_color === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(raw.text_color) ? raw.text_color : DEFAULT_SUBTITLE_STYLE.text_color,
    highlight_color: typeof raw.highlight_color === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(raw.highlight_color) ? raw.highlight_color : DEFAULT_SUBTITLE_STYLE.highlight_color,
    bg_color: typeof raw.bg_color === 'string' ? raw.bg_color : DEFAULT_SUBTITLE_STYLE.bg_color,
    bg_opacity: typeof raw.bg_opacity === 'number' && !isNaN(raw.bg_opacity) ? raw.bg_opacity : DEFAULT_SUBTITLE_STYLE.bg_opacity,
    position_y: ['bottom', 'center', 'top'].includes(raw.position_y) ? raw.position_y : DEFAULT_SUBTITLE_STYLE.position_y,
    max_chars_per_line: typeof raw.max_chars_per_line === 'number' && !isNaN(raw.max_chars_per_line) ? raw.max_chars_per_line : DEFAULT_SUBTITLE_STYLE.max_chars_per_line,
    safe_margin_pct: typeof raw.safe_margin_pct === 'number' && !isNaN(raw.safe_margin_pct) ? raw.safe_margin_pct : DEFAULT_SUBTITLE_STYLE.safe_margin_pct,
    mode: ['word_highlight', 'sentence', 'none'].includes(raw.mode) ? raw.mode : DEFAULT_SUBTITLE_STYLE.mode
  };
}

interface SubtitleSettingsTabProps {
  project: Project;
  onProjectUpdate: (p: Project) => void;
}

export const SubtitleSettingsTab: React.FC<SubtitleSettingsTabProps> = ({
  project,
  onProjectUpdate
}) => {
  // Normalize safely from incoming project
  const initialStyle = useMemo(() => normalizeSubtitleStyle(project?.subtitle_style), [project?.id]);

  // Live interactive preview state (updates immediately on sliders / color pickers)
  const [style, setStyle] = useState<SubtitleStyleConfig>(initialStyle);
  
  // Last saved state on server
  const [savedStyle, setSavedStyle] = useState<SubtitleStyleConfig>(initialStyle);
  
  // UI and saving statuses
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mobile accordion sections
  const [openSection, setOpenSection] = useState<'mode' | 'typography' | 'colors' | 'position'>('mode');

  // Track latest project ID and active requests to prevent race conditions
  const activeProjectIdRef = useRef(project?.id);
  const isSavingRef = useRef(false);
  const pendingStyleRef = useRef<SubtitleStyleConfig | null>(null);

  // Synchronize state when switching projects or when project loads
  useEffect(() => {
    activeProjectIdRef.current = project?.id;
    const normalized = normalizeSubtitleStyle(project?.subtitle_style);
    setStyle(normalized);
    setSavedStyle(normalized);
    setSavingStatus('idle');
    setErrorMessage(null);
  }, [project?.id]);

  // Check if current preview differs from saved style
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(style) !== JSON.stringify(savedStyle);
  }, [style, savedStyle]);

  // Save changes to backend with race-condition protection
  const executeSave = async (styleToSave: SubtitleStyleConfig) => {
    if (!project?.id) return;
    if (isSavingRef.current) {
      pendingStyleRef.current = styleToSave;
      return;
    }

    try {
      isSavingRef.current = true;
      setSavingStatus('saving');
      setErrorMessage(null);

      const targetId = project.id;
      const updated = await api.updateProject(targetId, {
        subtitle_style: styleToSave
      });

      // Guard against project switch while request was in-flight
      if (activeProjectIdRef.current === targetId) {
        setSavedStyle(styleToSave);
        setSavingStatus('saved');
        onProjectUpdate(updated);
        setTimeout(() => {
          setSavingStatus(prev => prev === 'saved' ? 'idle' : prev);
        }, 2500);
      }
    } catch (err: any) {
      console.error('Failed to save subtitle style:', err);
      setSavingStatus('error');
      setErrorMessage(err.message || 'Failed to save settings to server. Please try again.');
    } finally {
      isSavingRef.current = false;
      // If another save was queued during execution, run it now
      if (pendingStyleRef.current) {
        const nextStyle = pendingStyleRef.current;
        pendingStyleRef.current = null;
        executeSave(nextStyle);
      }
    }
  };

  // Immediate preview update + debounced auto-save
  const updateStyleProp = <K extends keyof SubtitleStyleConfig>(key: K, value: SubtitleStyleConfig[K]) => {
    setStyle(prev => {
      const next = normalizeSubtitleStyle({ ...prev, [key]: value });
      return next;
    });
  };

  const handleManualSave = () => {
    executeSave(style);
  };

  const handleResetToDefaults = () => {
    const defaultCopy = { ...DEFAULT_SUBTITLE_STYLE };
    setStyle(defaultCopy);
    executeSave(defaultCopy);
  };

  const handleRevertChanges = () => {
    setStyle({ ...savedStyle });
    setSavingStatus('idle');
    setErrorMessage(null);
  };

  const modeDisplay = (style.mode || 'word_highlight').replace('_', ' ').toUpperCase();

  return (
    <div className="space-y-6">
      {/* Top Header & Save Status Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div>
          <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
            <Type className="w-5 h-5 text-sky-400" />
            <span>Subtitle & Closed Caption Styling</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure dynamic word highlights, fonts, colors, and burned-in captions for maximum viewer retention.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Burn-in Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs">
            <input
              type="checkbox"
              checked={style.burn_in}
              onChange={e => updateStyleProp('burn_in', e.target.checked)}
              className="w-4 h-4 rounded text-sky-500 focus:ring-0 accent-sky-400"
            />
            <span className="font-semibold text-white">Burn Subtitles into MP4</span>
          </label>

          {/* Save Status / Button */}
          {hasUnsavedChanges ? (
            <button
              type="button"
              onClick={handleManualSave}
              disabled={savingStatus === 'saving'}
              className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {savingStatus === 'saving' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Style</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 text-slate-300 text-xs font-medium border border-slate-700/60">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saved</span>
            </div>
          )}

          {/* Reset / Revert Dropdown Buttons */}
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleRevertChanges}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs border border-slate-700 flex items-center gap-1"
              title="Revert Unsaved Changes"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Revert</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs border border-slate-700 flex items-center gap-1"
            title="Reset to Recommended Defaults"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Defaults</span>
          </button>
        </div>
      </div>

      {/* Error Banner with Retry */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={handleManualSave}
            className="px-3 py-1 bg-red-500/30 hover:bg-red-500/40 text-white rounded-lg font-semibold shrink-0"
          >
            Retry Save
          </button>
        </div>
      )}

      {/* Main Grid: Live Preview & Mobile Responsive Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Visual Frame Preview */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-[320px] sm:max-w-sm aspect-[9/16] relative rounded-3xl overflow-hidden border-2 border-slate-800 bg-slate-950 flex flex-col items-center justify-end p-6 shadow-2xl">
            {/* Background mockup graphic */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-950 pointer-events-none" />

            {/* Subtitle simulation element */}
            <div
              style={{
                marginBottom: style.position_y === 'bottom' ? `${style.safe_margin_pct}%` : 'auto',
                marginTop: style.position_y === 'top' ? `${style.safe_margin_pct}%` : 'auto',
                alignSelf: 'center',
                backgroundColor: `rgba(0, 0, 0, ${style.bg_opacity})`,
                fontFamily: style.font_family,
                fontSize: `${Math.max(14, Math.round(style.font_size * 0.42))}px`
              }}
              className="relative z-10 px-4 py-2 rounded-xl text-center max-w-[90%] shadow-2xl border border-white/10 backdrop-blur-sm transition-all"
            >
              {style.mode === 'word_highlight' ? (
                <div className="font-extrabold tracking-wide uppercase">
                  <span style={{ color: style.text_color }}>CONFIRM THE </span>
                  <span style={{ color: style.highlight_color }} className="underline decoration-2">BREAK</span>
                  <span style={{ color: style.text_color }}> OF STRUCTURE</span>
                </div>
              ) : (
                <div className="font-bold tracking-normal" style={{ color: style.text_color }}>
                  Confirm the break of structure before entry.
                </div>
              )}
            </div>

            <span className="relative z-10 text-[10px] text-slate-500 font-mono mt-3">
              Preview: {modeDisplay} MODE
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mt-2 text-center">
            Adjusting controls below updates this live preview immediately.
          </p>
        </div>

        {/* Right Column: Controls grouped into clean responsive cards */}
        <div className="lg:col-span-7 space-y-4 bg-slate-900/70 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl">
          {/* Section 1: Retention Animation Mode */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Retention Animation Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => updateStyleProp('mode', 'word_highlight')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  style.mode === 'word_highlight'
                    ? 'border-sky-500 bg-sky-500/10 text-white font-semibold shadow-sm'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 text-yellow-400 font-bold">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Word Highlight Mode</span>
                </div>
                <span className="text-[11px] text-slate-400 font-normal block mt-1">
                  Active words light up dynamically in bright contrast as they are spoken.
                </span>
              </button>

              <button
                type="button"
                onClick={() => updateStyleProp('mode', 'sentence')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  style.mode === 'sentence'
                    ? 'border-sky-500 bg-sky-500/10 text-white font-semibold shadow-sm'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                  <Type className="w-3.5 h-3.5 shrink-0" />
                  <span>Sentence Block Mode</span>
                </div>
                <span className="text-[11px] text-slate-400 font-normal block mt-1">
                  Clean full sentences timed to spoken narration boundaries.
                </span>
              </button>
            </div>
          </div>

          {/* Section 2: Colors */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
            <span className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
              Color Customization
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Primary Text Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={style.text_color || '#FFFFFF'}
                    onChange={e => updateStyleProp('text_color', e.target.value)}
                    className="w-10 h-10 rounded-xl border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={style.text_color || '#FFFFFF'}
                    onChange={e => updateStyleProp('text_color', e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-xs text-white uppercase flex-1 max-w-[120px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Active Highlight Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={style.highlight_color || '#FACC15'}
                    onChange={e => updateStyleProp('highlight_color', e.target.value)}
                    className="w-10 h-10 rounded-xl border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={style.highlight_color || '#FACC15'}
                    onChange={e => updateStyleProp('highlight_color', e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-xs text-white uppercase flex-1 max-w-[120px]"
                  />
                </div>
              </div>
            </div>

            {/* Background Box Opacity */}
            <div className="pt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Caption Box Background Opacity</span>
                <span className="font-mono text-sky-400 font-bold">{Math.round(style.bg_opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={style.bg_opacity}
                onChange={e => updateStyleProp('bg_opacity', parseFloat(e.target.value))}
                className="w-full accent-sky-400"
              />
            </div>
          </div>

          {/* Section 3: Typography */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
            <span className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
              Typography & Sizing
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Font Family
                </label>
                <select
                  value={style.font_family || 'Arial'}
                  onChange={e => updateStyleProp('font_family', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-400"
                >
                  <option value="Arial">Arial (Universal Clean)</option>
                  <option value="Segoe UI">Segoe UI (Modern Sans)</option>
                  <option value="Trebuchet MS">Trebuchet MS (Friendly)</option>
                  <option value="Impact">Impact (Punchy Reel)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Font Size</span>
                  <span className="font-mono text-sky-400 font-bold">{style.font_size}px</span>
                </div>
                <input
                  type="range"
                  min="28"
                  max="64"
                  step="2"
                  value={style.font_size}
                  onChange={e => updateStyleProp('font_size', parseInt(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Position & Safe Margin */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
            <span className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
              Screen Placement & Margins
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Vertical Position
                </label>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {(['bottom', 'center', 'top'] as const).map(pos => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => updateStyleProp('position_y', pos)}
                      className={`py-2 rounded-xl capitalize font-medium transition-colors ${
                        style.position_y === pos
                          ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Vertical Margin</span>
                  <span className="font-mono text-sky-400 font-bold">{style.safe_margin_pct}%</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="28"
                  step="1"
                  value={style.safe_margin_pct}
                  onChange={e => updateStyleProp('safe_margin_pct', parseFloat(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
