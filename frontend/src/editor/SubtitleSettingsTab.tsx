import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Type, Sparkles, Check, Sliders, Eye, RefreshCw, AlertCircle, Save, 
  RotateCcw, ChevronDown, ChevronUp, Download, Upload, Palette, Move 
} from 'lucide-react';
import { Project, SubtitleStyleConfig } from '../types/project';
import { api } from '../api/client';

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyleConfig = {
  burn_in: true,
  font_family: 'Arial',
  font_size: 44,
  text_color: '#FFFFFF',
  highlight_color: '#FACC15',
  inactive_color: '#94A3B8',
  highlight_style: 'word',
  bg_color: '#000000',
  bg_opacity: 0.65,
  position_y: 'bottom',
  x: 0.5,
  y: 0.72,
  max_chars_per_line: 34,
  safe_margin_pct: 12.0,
  mode: 'word_highlight',
  stroke_color: '#000000',
  stroke_width: 2
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
    inactive_color: typeof raw.inactive_color === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(raw.inactive_color) ? raw.inactive_color : DEFAULT_SUBTITLE_STYLE.inactive_color,
    highlight_style: ['karaoke', 'word', 'minimal', 'box'].includes(raw.highlight_style) ? raw.highlight_style : DEFAULT_SUBTITLE_STYLE.highlight_style,
    bg_color: typeof raw.bg_color === 'string' ? raw.bg_color : DEFAULT_SUBTITLE_STYLE.bg_color,
    bg_opacity: typeof raw.bg_opacity === 'number' && !isNaN(raw.bg_opacity) ? raw.bg_opacity : DEFAULT_SUBTITLE_STYLE.bg_opacity,
    position_y: ['bottom', 'center', 'top'].includes(raw.position_y) ? raw.position_y : DEFAULT_SUBTITLE_STYLE.position_y,
    x: typeof raw.x === 'number' && !isNaN(raw.x) ? raw.x : (DEFAULT_SUBTITLE_STYLE.x ?? 0.5),
    y: typeof raw.y === 'number' && !isNaN(raw.y) ? raw.y : (raw.position_y === 'top' ? 0.15 : (raw.position_y === 'center' ? 0.50 : 0.72)),
    max_chars_per_line: typeof raw.max_chars_per_line === 'number' && !isNaN(raw.max_chars_per_line) ? raw.max_chars_per_line : DEFAULT_SUBTITLE_STYLE.max_chars_per_line,
    safe_margin_pct: typeof raw.safe_margin_pct === 'number' && !isNaN(raw.safe_margin_pct) ? raw.safe_margin_pct : DEFAULT_SUBTITLE_STYLE.safe_margin_pct,
    mode: ['word_highlight', 'karaoke', 'sentence', 'none'].includes(raw.mode) ? raw.mode : DEFAULT_SUBTITLE_STYLE.mode,
    stroke_color: typeof raw.stroke_color === 'string' ? raw.stroke_color : DEFAULT_SUBTITLE_STYLE.stroke_color,
    stroke_width: typeof raw.stroke_width === 'number' && !isNaN(raw.stroke_width) ? raw.stroke_width : DEFAULT_SUBTITLE_STYLE.stroke_width
  };
}

const PRESET_CAPTIONS = [
  {
    name: 'Bold Highlight',
    style: {
      font_family: 'Impact',
      font_size: 46,
      text_color: '#FFFFFF',
      highlight_color: '#FACC15',
      inactive_color: '#94A3B8',
      bg_color: '#000000',
      bg_opacity: 0.8,
      mode: 'word_highlight' as const,
      highlight_style: 'word' as const
    }
  },
  {
    name: 'Karaoke Glow',
    style: {
      font_family: 'Segoe UI',
      font_size: 44,
      text_color: '#F8FAFC',
      highlight_color: '#38BDF8',
      inactive_color: '#64748B',
      bg_color: '#070D1E',
      bg_opacity: 0.85,
      mode: 'karaoke' as const,
      highlight_style: 'karaoke' as const
    }
  },
  {
    name: 'Clean Educational',
    style: {
      font_family: 'Arial',
      font_size: 40,
      text_color: '#FFFFFF',
      highlight_color: '#4ADE80',
      inactive_color: '#CBD5E1',
      bg_color: '#0F172A',
      bg_opacity: 0.75,
      mode: 'word_highlight' as const,
      highlight_style: 'minimal' as const
    }
  },
  {
    name: 'High Contrast Dark',
    style: {
      font_family: 'Segoe UI',
      font_size: 42,
      text_color: '#FFFFFF',
      highlight_color: '#FB7185',
      inactive_color: '#94A3B8',
      bg_color: '#000000',
      bg_opacity: 0.95,
      mode: 'sentence' as const,
      highlight_style: 'box' as const
    }
  }
];

interface SubtitleSettingsTabProps {
  project: Project;
  onProjectUpdate: (p: Project) => void;
}

export const SubtitleSettingsTab: React.FC<SubtitleSettingsTabProps> = ({
  project,
  onProjectUpdate
}) => {
  const initialStyle = useMemo(() => normalizeSubtitleStyle(project?.subtitle_style), [project?.id]);
  const [style, setStyle] = useState<SubtitleStyleConfig>(initialStyle);
  const [savedStyle, setSavedStyle] = useState<SubtitleStyleConfig>(initialStyle);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeProjectIdRef = useRef(project?.id);
  const isSavingRef = useRef(false);
  const pendingStyleRef = useRef<SubtitleStyleConfig | null>(null);

  useEffect(() => {
    activeProjectIdRef.current = project?.id;
    const normalized = normalizeSubtitleStyle(project?.subtitle_style);
    setStyle(normalized);
    setSavedStyle(normalized);
    setSavingStatus('idle');
    setErrorMessage(null);
  }, [project?.id]);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(style) !== JSON.stringify(savedStyle);
  }, [style, savedStyle]);

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

      if (activeProjectIdRef.current === targetId) {
        setSavedStyle(styleToSave);
        setSavingStatus('saved');
        onProjectUpdate(updated);
        setTimeout(() => {
          setSavingStatus(prev => prev === 'saved' ? 'idle' : prev);
        }, 2000);
      }
    } catch (err: any) {
      console.error('Failed to save subtitle style:', err);
      setSavingStatus('error');
      setErrorMessage(err.message || 'Failed to save settings.');
    } finally {
      isSavingRef.current = false;
      if (pendingStyleRef.current) {
        const nextStyle = pendingStyleRef.current;
        pendingStyleRef.current = null;
        executeSave(nextStyle);
      }
    }
  };

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

  const snapY = (yVal: number) => {
    setStyle(prev => ({
      ...prev,
      y: yVal,
      position_y: yVal <= 0.25 ? 'top' : (yVal >= 0.70 ? 'bottom' : 'center')
    }));
  };

  // Export SRT / VTT directly from browser
  const handleExportSRT = () => {
    const scenes = project.scenes || [];
    let lines: string[] = [];
    let idx = 1;
    let timeAcc = 0;

    for (const s of scenes) {
      const dur = s.scene_duration || 3.5;
      const text = s.narration_script || s.caption || '';
      if (text.trim()) {
        const startSec = timeAcc;
        const endSec = timeAcc + dur;
        const fmt = (sec: number) => {
          const h = Math.floor(sec / 3600);
          const m = Math.floor((sec % 3600) / 60);
          const sRem = Math.floor(sec % 60);
          const ms = Math.floor((sec - Math.floor(sec)) * 1000);
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sRem).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
        };
        lines.push(String(idx++));
        lines.push(`${fmt(startSec)} --> ${fmt(endSec)}`);
        lines.push(text.trim());
        lines.push('');
      }
      timeAcc += dur;
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles_${project.id.slice(0, 8)}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div>
          <h2 className="font-heading font-bold text-white text-base flex items-center gap-2">
            <Type className="w-5 h-5 text-cyan-400" />
            Caption & Subtitle Studio V2
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure free positioning, word highlighting, karaoke sync, and typography.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Unsaved changes
            </span>
          )}

          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors flex items-center gap-1.5"
            title="Reset to recommended defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleManualSave}
            disabled={savingStatus === 'saving'}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-40"
          >
            {savingStatus === 'saving' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : savingStatus === 'saved' ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Style</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main 2-Column Split: Interactive Preview & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 9:16 Canvas Simulation */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-[320px] sm:max-w-sm aspect-[9/16] relative rounded-3xl overflow-hidden border-2 border-slate-800 bg-slate-950 flex flex-col items-center justify-center p-6 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-slate-950 pointer-events-none" />

            {/* Dynamic Placed Subtitle simulation element */}
            <div
              style={{
                position: 'absolute',
                left: `${(style.x ?? 0.5) * 100}%`,
                top: `${(style.y ?? 0.72) * 100}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: style.bg_opacity > 0 ? style.bg_color : 'transparent',
                opacity: style.bg_opacity > 0 ? undefined : 1.0,
                padding: '10px 16px',
                borderRadius: '14px',
                borderWidth: `${style.stroke_width || 0}px`,
                borderColor: style.stroke_color || '#000000',
                borderStyle: style.stroke_width ? 'solid' : 'none',
                maxWidth: '85%'
              }}
              className="z-10 text-center shadow-2xl backdrop-blur-md transition-all select-none"
            >
              {style.mode === 'word_highlight' || style.mode === 'karaoke' ? (
                <div 
                  style={{ fontFamily: style.font_family, fontSize: `${Math.max(16, Math.round(style.font_size * 0.42))}px` }}
                  className="font-extrabold tracking-wide uppercase leading-tight"
                >
                  <span style={{ color: style.inactive_color || '#94A3B8' }}>CONFIRM THE </span>
                  <span style={{ color: style.highlight_color }} className="underline decoration-2">BREAK</span>
                  <span style={{ color: style.inactive_color || '#94A3B8' }}> OF STRUCTURE</span>
                </div>
              ) : (
                <div 
                  style={{ fontFamily: style.font_family, fontSize: `${Math.max(16, Math.round(style.font_size * 0.42))}px`, color: style.text_color }}
                  className="font-bold tracking-normal leading-tight"
                >
                  Confirm the break of structure before entry.
                </div>
              )}
            </div>

            <div className="absolute bottom-4 left-0 right-0 text-center z-10">
              <span className="text-[10px] text-slate-500 font-mono bg-black/60 px-2 py-0.5 rounded">
                Position: ({Math.round((style.x ?? 0.5) * 100)}%, {Math.round((style.y ?? 0.72) * 100)}%)
              </span>
            </div>
          </div>

          {/* Quick Snap Y Buttons */}
          <div className="w-full max-w-sm mt-3 flex items-center justify-between gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300">
            <span className="text-[10px] text-slate-400 font-mono pl-1">Snap:</span>
            <button onClick={() => snapY(0.14)} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700">Top</button>
            <button onClick={() => snapY(0.30)} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700">Upper</button>
            <button onClick={() => snapY(0.50)} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700">Center</button>
            <button onClick={() => snapY(0.70)} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700">Lower</button>
            <button onClick={() => snapY(0.72)} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700">Caption safe</button>
          </div>
        </div>

        {/* Right Column: Settings & Presets */}
        <div className="lg:col-span-7 space-y-4 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 shadow-xl text-xs text-slate-300">
          {/* Preset Buttons */}
          <div>
            <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Caption Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_CAPTIONS.map(p => (
                <button
                  key={p.name}
                  onClick={() => {
                    setStyle(prev => ({ ...prev, ...p.style }));
                    executeSave({ ...style, ...p.style });
                  }}
                  className="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-slate-200 text-left font-medium transition-all"
                >
                  <span className="block font-bold">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Animation & Mode */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider block">
              Highlight Animation Mode
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => updateStyleProp('mode', 'word_highlight')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  style.mode === 'word_highlight'
                    ? 'border-cyan-500 bg-cyan-500/10 text-white font-semibold'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-yellow-400 font-bold">Word Highlight</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Active word lights up</div>
              </button>

              <button
                type="button"
                onClick={() => updateStyleProp('mode', 'karaoke')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  style.mode === 'karaoke'
                    ? 'border-cyan-500 bg-cyan-500/10 text-white font-semibold'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-cyan-400 font-bold">Karaoke Glow</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Dynamic glowing pace</div>
              </button>

              <button
                type="button"
                onClick={() => updateStyleProp('mode', 'sentence')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  style.mode === 'sentence'
                    ? 'border-cyan-500 bg-cyan-500/10 text-white font-semibold'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-slate-200 font-bold">Sentence Block</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Clean full sentence</div>
              </button>
            </div>
          </div>

          {/* Free 2D Positioning */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-cyan-400" />
              Arbitrary Screen Position (X & Y)
            </span>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Horizontal X</span>
                  <span className="font-mono text-cyan-300">{Math.round((style.x ?? 0.5) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.01"
                  value={style.x ?? 0.5}
                  onChange={e => updateStyleProp('x', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Vertical Y</span>
                  <span className="font-mono text-cyan-300">{Math.round((style.y ?? 0.72) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.08"
                  max="0.92"
                  step="0.01"
                  value={style.y ?? 0.72}
                  onChange={e => updateStyleProp('y', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Color Palettes (Active vs Inactive vs Background) */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-emerald-400" />
              Color Customization
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Highlight Color</span>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
                  <input
                    type="color"
                    value={style.highlight_color || '#FACC15'}
                    onChange={e => updateStyleProp('highlight_color', e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-[11px] uppercase">{style.highlight_color}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Inactive Word Color</span>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
                  <input
                    type="color"
                    value={style.inactive_color || '#94A3B8'}
                    onChange={e => updateStyleProp('inactive_color', e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-[11px] uppercase">{style.inactive_color}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Badge Background</span>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
                  <input
                    type="color"
                    value={style.bg_color || '#000000'}
                    onChange={e => updateStyleProp('bg_color', e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-[11px] uppercase">{style.bg_color}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Subtitle File Export Actions */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Export timed subtitle file:</span>
            <button
              onClick={handleExportSRT}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download SRT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
