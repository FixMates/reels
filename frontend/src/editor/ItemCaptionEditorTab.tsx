import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, Mic, Play, RefreshCw, AlertCircle, Check, 
  Sparkles, Volume2, ShieldAlert, Sliders, Layers, Eye, EyeOff, Plus, 
  Undo, Redo, Copy, Trash2, ArrowUp, ArrowDown, Lock, Unlock, Compass
} from 'lucide-react';
import { Project, Scene, OverlayLayer } from '../types/project';
import { api } from '../api/client';
import { AudioWaveformPlayer } from '../components/AudioWaveformPlayer';
import { InteractiveCanvas } from '../components/InteractiveCanvas';
import { TextInspector } from '../components/TextInspector';

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

  // Layers state
  const [layers, setLayers] = useState<OverlayLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // History stack for Undo/Redo
  const [history, setHistory] = useState<OverlayLayer[][]>([]);
  const [future, setFuture] = useState<OverlayLayer[][]>([]);

  // Text inputs & modes
  const [headline, setHeadline] = useState('');
  const [caption, setCaption] = useState('');
  const [narration, setNarration] = useState('');
  const [fitMode, setFitMode] = useState<'fit' | 'fill' | 'blur_bg' | 'card'>('fit');
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'inspector' | 'narration' | 'layers'>('inspector');
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize and synthesize layers on scene change
  useEffect(() => {
    if (activeScene) {
      setHeadline(activeScene.headline || '');
      setCaption(activeScene.caption || '');
      setNarration(activeScene.narration_script || '');
      setFitMode(activeScene.fit_mode || 'fit');

      let currentLayers = activeScene.layers || [];
      if (!currentLayers || currentLayers.length === 0) {
        // Synthesize default layers if none exist
        currentLayers = [
          {
            id: `hl_${activeScene.id}`,
            type: 'headline',
            text: activeScene.headline || project.default_top_text || 'Key Takeaway Hook',
            x: 0.5,
            y: 0.12,
            width: 0.85,
            font_family: 'Segoe UI',
            font_size: 38,
            font_weight: 'bold',
            text_color: '#FFFFFF',
            text_opacity: 1.0,
            bg_color: '#071020',
            bg_opacity: 0.88,
            bg_padding: 16,
            border_radius: 18,
            stroke_color: project.branding?.accent_color || '#38BDF8',
            stroke_width: 2,
            shadow_blur: 6,
            text_align: 'center',
            rotation: 0,
            visible: true,
            locked: false,
            z_index: 0
          },
          {
            id: `cap_${activeScene.id}`,
            type: 'caption',
            text: activeScene.caption || project.default_bottom_text || 'Descriptive subtitle caption',
            x: 0.5,
            y: 0.84,
            width: 0.85,
            font_family: 'Segoe UI',
            font_size: 30,
            font_weight: 'bold',
            text_color: '#F1F5F9',
            text_opacity: 1.0,
            bg_color: '#050A16',
            bg_opacity: 0.9,
            bg_padding: 14,
            border_radius: 14,
            stroke_color: '#475569',
            stroke_width: 1,
            shadow_blur: 4,
            text_align: 'center',
            rotation: 0,
            visible: true,
            locked: false,
            z_index: 1
          }
        ];
      }
      setLayers(currentLayers);
      setSelectedLayerId(currentLayers[0]?.id || null);
      setHistory([]);
      setFuture([]);
    }
  }, [activeScene?.id]);

  if (!activeScene) {
    return (
      <div className="text-center py-20 text-slate-400">
        No scenes available in this project. Please import media first.
      </div>
    );
  }

  // Save current scene state to backend
  const saveSceneData = async (newLayers = layers, overrides: Partial<Scene> = {}) => {
    try {
      setIsSaving(true);
      const updates = {
        headline,
        caption,
        narration_script: narration,
        fit_mode: fitMode,
        layers: newLayers,
        ...overrides
      };
      await api.updateScene(activeScene.id, updates);
      const updatedProject = await api.getProject(project.id);
      onProjectUpdate(updatedProject);
    } catch (err: any) {
      console.error('Failed to save scene:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Layer Update with Undo/Redo tracking
  const handleUpdateLayer = (layerId: string, updates: Partial<OverlayLayer>) => {
    setLayers(prev => {
      setHistory(h => [...h.slice(-25), prev]);
      setFuture([]);
      const next = prev.map(l => {
        if (l.id === layerId) {
          const updated = { ...l, ...updates };
          // If updating headline text, sync local headline state
          if (updated.type === 'headline' && updates.text !== undefined) {
            setHeadline(updates.text);
          }
          if (updated.type === 'caption' && updates.text !== undefined) {
            setCaption(updates.text);
          }
          return updated;
        }
        return l;
      });
      // Debounce save to backend
      saveSceneData(next);
      return next;
    });
  };

  // Add new layer
  const handleAddLayer = (type: OverlayLayer['type']) => {
    const id = `layer_${Date.now()}`;
    const defaultY = type === 'headline' ? 0.14 : (type === 'callout' ? 0.50 : (type === 'cta' ? 0.72 : 0.84));
    const newLayer: OverlayLayer = {
      id,
      type,
      text: type === 'callout' ? 'Target Zone: +15%' : (type === 'cta' ? 'Subscribe for daily insights' : 'New Overlay Text'),
      x: 0.5,
      y: defaultY,
      width: type === 'callout' ? 0.55 : 0.85,
      font_family: 'Segoe UI',
      font_size: type === 'callout' ? 28 : (type === 'headline' ? 40 : 32),
      font_weight: 'bold',
      text_color: type === 'callout' ? '#4ADE80' : '#FFFFFF',
      text_opacity: 1.0,
      bg_color: type === 'callout' ? '#052E16' : '#0F172A',
      bg_opacity: 0.85,
      bg_padding: 14,
      border_radius: 16,
      stroke_color: type === 'callout' ? '#22C55E' : '#38BDF8',
      stroke_width: 1,
      text_align: 'center',
      rotation: 0,
      visible: true,
      locked: false,
      z_index: layers.length
    };

    const nextLayers = [...layers, newLayer];
    setLayers(nextLayers);
    setSelectedLayerId(id);
    setActiveRightTab('inspector');
    saveSceneData(nextLayers);
  };

  // Delete layer
  const handleDeleteLayer = (layerId: string) => {
    if (layers.length <= 1) {
      alert('Keep at least one layer on the scene.');
      return;
    }
    const nextLayers = layers.filter(l => l.id !== layerId);
    setLayers(nextLayers);
    setSelectedLayerId(nextLayers[0]?.id || null);
    saveSceneData(nextLayers);
  };

  // Duplicate layer
  const handleDuplicateLayer = (layerId: string) => {
    const orig = layers.find(l => l.id === layerId);
    if (!orig) return;
    const copyId = `layer_${Date.now()}`;
    const dup: OverlayLayer = {
      ...orig,
      id: copyId,
      text: `${orig.text} (Copy)`,
      y: Math.min(0.9, orig.y + 0.05),
      z_index: layers.length
    };
    const nextLayers = [...layers, dup];
    setLayers(nextLayers);
    setSelectedLayerId(copyId);
    saveSceneData(nextLayers);
  };

  // Reorder layer Z-index
  const handleReorderLayer = (layerId: string, direction: 'up' | 'down') => {
    const idx = layers.findIndex(l => l.id === layerId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (targetIdx < 0 || targetIdx >= layers.length) return;

    const updated = [...layers];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    // Normalize z-indexes
    updated.forEach((l, i) => { l.z_index = i; });
    setLayers(updated);
    saveSceneData(updated);
  };

  // Undo / Redo
  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture(f => [layers, ...f]);
    setHistory(h => h.slice(0, -1));
    setLayers(prev);
    saveSceneData(prev);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory(h => [...h, layers]);
    setFuture(f => f.slice(1));
    setLayers(next);
    saveSceneData(next);
  };

  const goToScene = async (newIdx: number) => {
    if (newIdx < 0 || newIdx >= scenes.length) return;
    await saveSceneData();
    onNavigateScene(scenes[newIdx].id);
  };

  const handleGenerateVoice = async () => {
    if (!narration.trim()) {
      alert('Please enter a narration script first.');
      return;
    }
    try {
      setIsGeneratingVoice(true);
      await saveSceneData();
      await api.generateSceneVoice(
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

  const wordCount = narration.trim() ? narration.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.max(1.5, (wordCount / (project.voice_rate / 60)) + project.end_padding_seconds);

  const selectedLayer = layers.find(l => l.id === selectedLayerId) || null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Navigation & Action Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToScene(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors"
              title="Previous Slide"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => goToScene(currentIndex + 1)}
              disabled={currentIndex === scenes.length - 1}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors"
              title="Next Slide"
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
              {isSaving && (
                <span className="text-[10px] text-cyan-400 font-mono animate-pulse">
                  Saving...
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 truncate max-w-[150px] sm:max-w-xs block font-mono">
              {activeScene.source_filename || `Page ${activeScene.page_number}`}
            </span>
          </div>
        </div>

        {/* Action Toggles: Undo, Redo, Safe Zone, Add Layer */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={future.length === 0}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowSafeZone(!showSafeZone)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showSafeZone
                ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {showSafeZone ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Reels Safe Zone</span>
          </button>

          <button
            onClick={async () => {
              const nextInc = !activeScene.is_included;
              await api.updateScene(activeScene.id, { is_included: nextInc });
              const updated = await api.getProject(project.id);
              onProjectUpdate(updated);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              activeScene.is_included
                ? 'bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}
          >
            {activeScene.is_included ? 'Exclude' : 'Include'}
          </button>
        </div>
      </div>

      {/* Main Studio Editor: 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive 9:16 Drag-and-Position Canvas */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <InteractiveCanvas
            scene={activeScene}
            layers={layers}
            selectedLayerId={selectedLayerId}
            onSelectLayer={(id) => {
              setSelectedLayerId(id);
              if (id) setActiveRightTab('inspector');
            }}
            onUpdateLayer={handleUpdateLayer}
            onAddLayer={handleAddLayer}
            onDeleteLayer={handleDeleteLayer}
            onDuplicateLayer={handleDuplicateLayer}
            onReorderLayer={handleReorderLayer}
            showSafeZone={showSafeZone}
            platformSafeZone="reels"
          />

          {/* Quick Fit Mode & Layer Add Selector */}
          <div className="w-full max-w-sm mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              {(['fit', 'blur_bg', 'fill', 'card'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => {
                    setFitMode(mode);
                    saveSceneData(layers, { fit_mode: mode });
                  }}
                  className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-colors ${
                    fitMode === mode
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Add Layer Quick Dropdown */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleAddLayer('callout')}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                title="Add Callout Label"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Callout</span>
              </button>
              <button
                onClick={() => handleAddLayer('cta')}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                title="Add End Card CTA"
              >
                <Plus className="w-3.5 h-3.5 text-sky-400" />
                <span>CTA</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Contextual Inspector & Voice Studio */}
        <div className="lg:col-span-7 space-y-4">
          {/* Sub-Tabs: Text Inspector, Spoken Narration, Layer Management */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl">
            <button
              onClick={() => setActiveRightTab('inspector')}
              className={`flex-1 py-2 px-3 rounded-xl font-heading font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                activeRightTab === 'inspector'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Text Inspector</span>
              {selectedLayer && <span className="opacity-70">({selectedLayer.type})</span>}
            </button>

            <button
              onClick={() => setActiveRightTab('narration')}
              className={`flex-1 py-2 px-3 rounded-xl font-heading font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                activeRightTab === 'narration'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Voice & Script</span>
              {activeScene.audio_path && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>

            <button
              onClick={() => setActiveRightTab('layers')}
              className={`flex-1 py-2 px-3 rounded-xl font-heading font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                activeRightTab === 'layers'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Layer List</span>
              <span className="font-mono text-[10px] bg-slate-800/80 px-1.5 py-0.2 rounded">
                {layers.length}
              </span>
            </button>
          </div>

          {/* TAB 1: Text Inspector Panel */}
          {activeRightTab === 'inspector' && (
            <TextInspector
              layer={selectedLayer}
              onUpdateLayer={handleUpdateLayer}
              onDuplicateLayer={handleDuplicateLayer}
              onDeleteLayer={handleDeleteLayer}
            />
          )}

          {/* TAB 2: Spoken AI Narration Studio */}
          {activeRightTab === 'narration' && (
            <div className="space-y-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-cyan-400" />
                  Spoken AI Narration Script
                </label>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-slate-400">{wordCount} words</span>
                  <span className="text-cyan-400 font-semibold">≈ {estimatedSeconds.toFixed(1)}s speech</span>
                </div>
              </div>

              <textarea
                rows={4}
                value={narration}
                onChange={e => setNarration(e.target.value)}
                onBlur={() => saveSceneData()}
                placeholder="Enter what the voice should say for this slide. (e.g. Always check the liquidity pool before taking a trade entry.)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-400 focus:outline-none text-white text-sm leading-relaxed"
              />

              {/* Audio Synthesis & Waveform Player */}
              <div className="pt-2 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateVoice}
                    disabled={isGeneratingVoice || !narration.trim()}
                    className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all active:scale-95 disabled:opacity-40"
                  >
                    {isGeneratingVoice ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Synthesizing Voice...</span>
                      </>
                    ) : activeScene.audio_path ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Regenerate Speech for Slide</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>Generate Voice for Slide</span>
                      </>
                    )}
                  </button>

                  <div className="text-xs text-slate-400 font-mono">
                    Engine: <span className="text-slate-200">Windows SAPI Offline TTS</span>
                  </div>
                </div>

                {activeScene.audio_url && (
                  <AudioWaveformPlayer
                    src={activeScene.audio_url}
                    duration={activeScene.measured_audio_duration}
                    label={`Narration Audio (${activeScene.measured_audio_duration.toFixed(1)}s)`}
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Layer Management List */}
          {activeRightTab === 'layers' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-semibold text-slate-300">
                <span>Layers (Z-Index Order)</span>
                <button
                  onClick={() => handleAddLayer('callout')}
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Layer
                </button>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {layers
                  .slice()
                  .reverse()
                  .map((l) => (
                    <div
                      key={l.id}
                      onClick={() => {
                        setSelectedLayerId(l.id);
                        setActiveRightTab('inspector');
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        selectedLayerId === l.id
                          ? 'bg-cyan-500/15 border-cyan-500/50 text-white'
                          : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                        <span className="text-xs font-mono uppercase text-slate-400 font-semibold">{l.type}</span>
                        <span className="text-xs truncate">{l.text}</span>
                      </div>

                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleUpdateLayer(l.id, { visible: !l.visible })}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400"
                          title="Toggle Visibility"
                        >
                          {l.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-red-400" />}
                        </button>
                        <button
                          onClick={() => handleUpdateLayer(l.id, { locked: !l.locked })}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400"
                          title="Toggle Lock"
                        >
                          {l.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleReorderLayer(l.id, 'up')}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400"
                          title="Bring Forward"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReorderLayer(l.id, 'down')}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400"
                          title="Send Backward"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLayer(l.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
