import React, { useState, useEffect } from 'react';
import { Volume2, Mic, Play, RefreshCw, Upload, CheckCircle2, Sparkles, Sliders } from 'lucide-react';
import { Project, Scene, TTSVoice } from '../types/project';
import { api } from '../api/client';
import { AudioWaveformPlayer } from '../components/AudioWaveformPlayer';

interface VoicePanelTabProps {
  project: Project;
  currentSceneId?: string;
  onProjectUpdate: (p: Project) => void;
}

export const VoicePanelTab: React.FC<VoicePanelTabProps> = ({
  project,
  currentSceneId,
  onProjectUpdate
}) => {
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState(project.voice_id || '');
  const [voiceRate, setVoiceRate] = useState(project.voice_rate || 175);
  const [voiceVolume, setVoiceVolume] = useState(project.voice_volume || 100);
  const [previewText, setPreviewText] = useState('Welcome to Antigravity Studio. This is an offline local voice preview.');
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGeneratingCurrent, setIsGeneratingCurrent] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const scenes = project.scenes;
  const currentIdx = Math.max(0, scenes.findIndex(s => s.id === currentSceneId));
  const activeScene = scenes[currentIdx] || scenes[0];

  useEffect(() => {
    api.listVoices().then(vList => {
      setVoices(vList);
      if (!selectedVoice && vList.length > 0) {
        setSelectedVoice(vList[0].id);
      }
    }).catch(console.error);
  }, []);

  const handleSaveSettings = async () => {
    try {
      const updated = await api.updateProject(project.id, {
        voice_id: selectedVoice,
        voice_rate: voiceRate,
        voice_volume: voiceVolume
      });
      onProjectUpdate(updated);
    } catch (err: any) {
      alert(`Error saving voice settings: ${err.message}`);
    }
  };

  const handlePreviewVoice = async () => {
    try {
      setIsPreviewing(true);
      const res = await api.previewTTS({
        text: previewText,
        voice_id: selectedVoice || undefined,
        rate: voiceRate,
        volume: voiceVolume
      });
      setPreviewAudioUrl(res.audio_url);
    } catch (err: any) {
      alert(`Voice preview failed: ${err.message}`);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleGenerateCurrent = async () => {
    if (!activeScene || !activeScene.narration_script.trim()) {
      alert('Active slide has no narration text.');
      return;
    }
    try {
      setIsGeneratingCurrent(true);
      await api.generateSceneVoice(activeScene.id, selectedVoice || undefined, voiceRate, voiceVolume);
      const updated = await api.getProject(project.id);
      onProjectUpdate(updated);
    } catch (err: any) {
      alert(`Failed to generate voice: ${err.message}`);
    } finally {
      setIsGeneratingCurrent(false);
    }
  };

  const handleGenerateAll = async () => {
    try {
      setIsGeneratingAll(true);
      await api.updateProject(project.id, {
        voice_id: selectedVoice,
        voice_rate: voiceRate,
        voice_volume: voiceVolume
      });
      const res = await api.generateAllVoices(project.id);
      const updated = await api.getProject(project.id);
      onProjectUpdate(updated);
      alert(`Synthesized voices for ${res.generated_count} slides!`);
    } catch (err: any) {
      alert(`Failed to batch generate voices: ${err.message}`);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const handleCustomAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !activeScene) return;
    const file = e.target.files[0];
    try {
      await api.uploadAudioOverride(activeScene.id, file);
      const updated = await api.getProject(project.id);
      onProjectUpdate(updated);
      alert('Custom audio file attached to slide!');
    } catch (err: any) {
      alert(`Custom audio upload failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div>
          <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
            <Mic className="w-5 h-5 text-sky-400" />
            <span>Local Text-to-Speech Engine</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            100% offline speech synthesis using installed Windows voices without API keys.
          </p>
        </div>

        <button
          onClick={handleGenerateAll}
          disabled={isGeneratingAll || project.scenes.length === 0}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50"
        >
          {isGeneratingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          <span>Generate All Voiceovers</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Voice Engine Settings */}
        <div className="lg:col-span-6 space-y-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-xl">
          {/* Voice Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Select Installed Voice
            </label>
            <select
              value={selectedVoice}
              onChange={e => {
                setSelectedVoice(e.target.value);
              }}
              onBlur={handleSaveSettings}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-sky-400 focus:outline-none text-white text-sm"
            >
              {voices.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.language}) [{v.engine.toUpperCase()}]
                </option>
              ))}
            </select>
          </div>

          {/* Voice Rate Slider */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300">Speech Rate</span>
              <span className="font-mono text-sky-400 font-bold">{voiceRate} WPM</span>
            </div>
            <input
              type="range"
              min="110"
              max="240"
              step="5"
              value={voiceRate}
              onChange={e => setVoiceRate(parseInt(e.target.value))}
              onMouseUp={handleSaveSettings}
              className="w-full accent-sky-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>Slow (110)</span>
              <span>Natural (175)</span>
              <span>Fast (240)</span>
            </div>
          </div>

          {/* Voice Volume Slider */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300">Speech Volume</span>
              <span className="font-mono text-sky-400 font-bold">{voiceVolume}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              step="5"
              value={voiceVolume}
              onChange={e => setVoiceVolume(parseInt(e.target.value))}
              onMouseUp={handleSaveSettings}
              className="w-full accent-sky-400"
            />
          </div>

          {/* Test Preview Generator */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-xs font-semibold text-slate-300 block">Preview Voice Sound</span>
            <input
              type="text"
              value={previewText}
              onChange={e => setPreviewText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
            />
            <button
              onClick={handlePreviewVoice}
              disabled={isPreviewing}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isPreviewing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Test Voice Sample</span>
            </button>

            {previewAudioUrl && (
              <AudioWaveformPlayer src={previewAudioUrl} label="Voice Sample Test" />
            )}
          </div>

          {/* Pronunciation Dictionary */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Pronunciation Dictionary
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {Object.keys(project.pronunciation_dict || {}).length} rules
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Override technical terms, tickers, and abbreviations so local TTS pronounces them accurately.
            </p>

            {/* List current overrides */}
            {project.pronunciation_dict && Object.keys(project.pronunciation_dict).length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {Object.entries(project.pronunciation_dict).map(([term, replacement]) => (
                  <div key={term} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                    <div>
                      <span className="font-mono text-cyan-300 font-semibold">{term}</span>
                      <span className="text-slate-500 mx-1.5">➔</span>
                      <span className="text-slate-200">{replacement}</span>
                    </div>
                    <button
                      onClick={async () => {
                        const updatedDict = { ...(project.pronunciation_dict || {}) };
                        delete updatedDict[term];
                        const updated = await api.updateProject(project.id, { pronunciation_dict: updatedDict });
                        onProjectUpdate(updated);
                      }}
                      className="text-slate-500 hover:text-red-400 text-xs px-1"
                      title="Remove Rule"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new rule */}
            <div className="flex gap-2">
              <input
                id="pron_term_input"
                type="text"
                placeholder="Term (e.g. BTC)"
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
              />
              <input
                id="pron_repl_input"
                type="text"
                placeholder="Say as (e.g. Bitcoin)"
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
              />
              <button
                type="button"
                onClick={async () => {
                  const tInput = document.getElementById('pron_term_input') as HTMLInputElement;
                  const rInput = document.getElementById('pron_repl_input') as HTMLInputElement;
                  if (!tInput?.value.trim() || !rInput?.value.trim()) return;
                  const updatedDict = {
                    ...(project.pronunciation_dict || {}),
                    [tInput.value.trim()]: rInput.value.trim()
                  };
                  tInput.value = '';
                  rInput.value = '';
                  const updated = await api.updateProject(project.id, { pronunciation_dict: updatedDict });
                  onProjectUpdate(updated);
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Slide Voice Management */}
        <div className="lg:col-span-6 space-y-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-white text-sm">
              Slide #{currentIdx + 1} Voice Status
            </span>
            <span className="text-xs font-mono text-slate-400">
              Duration: {activeScene?.scene_duration.toFixed(1)}s
            </span>
          </div>

          {/* Active Narration Quote */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block mb-1">
              Narration Script
            </span>
            <p className="text-xs text-slate-200 italic leading-relaxed">
              "{activeScene?.narration_script || 'No narration entered for this slide.'}"
            </p>
          </div>

          {/* Play/Regenerate for current slide */}
          <div className="space-y-3">
            <button
              onClick={handleGenerateCurrent}
              disabled={isGeneratingCurrent || !activeScene?.narration_script.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-40"
            >
              {isGeneratingCurrent ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : activeScene?.audio_path ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate Slide Voice</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>Generate Voice for Slide</span>
                </>
              )}
            </button>

            {activeScene?.audio_url && (
              <AudioWaveformPlayer
                src={activeScene.audio_url}
                duration={activeScene.measured_audio_duration}
                label={`Slide #${currentIdx + 1} Spoken Audio`}
              />
            )}
          </div>

          {/* Custom Audio Override */}
          <div className="pt-3 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block mb-1">
              Or Upload Custom Voice Audio
            </span>
            <span className="text-[11px] text-slate-500 block mb-2">
              Attach your own voice recording or audio file (WAV/MP3).
            </span>
            <label className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors">
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleCustomAudioUpload}
              />
              <Upload className="w-3.5 h-3.5" />
              <span>Attach Custom Audio to This Slide</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
