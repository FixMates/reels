import React, { useState } from 'react';
import { Layers, Play, Pause, Clock, Volume2, Type, Music, Film, LayoutList } from 'lucide-react';
import { Project, Scene } from '../types/project';

interface TimelineTabProps {
  project: Project;
  onSelectItem: (sceneId: string) => void;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({
  project,
  onSelectItem
}) => {
  const scenes = project.scenes.filter(s => s.is_included);
  const totalDuration = scenes.reduce((acc, s) => acc + s.scene_duration, 0);

  const [currentTime, setCurrentTime] = useState(0);
  const [viewMode, setViewMode] = useState<'track' | 'cards'>('track');

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shadow-lg">
        <div>
          <h3 className="font-heading font-bold text-white text-sm sm:text-base flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-400" />
            <span>Multi-Track Timeline & Audio Sync</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Visualize exact scene boundaries, narration wave durations, and synchronized caption placement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile view toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('track')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                viewMode === 'track' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tracks
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                viewMode === 'cards' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cards
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-white font-bold">{totalDuration.toFixed(1)}s</span>
            <span className="text-slate-500">total</span>
          </div>
        </div>
      </div>

      {/* Cards View (Especially great for Mobile) */}
      {viewMode === 'cards' ? (
        <div className="space-y-3">
          {scenes.map((s, idx) => (
            <div
              key={s.id}
              onClick={() => onSelectItem(s.id)}
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-start gap-3.5 cursor-pointer shadow-md"
            >
              <img
                src={s.thumbnail_url}
                alt="thumb"
                className="w-16 aspect-[9/16] object-cover rounded-xl bg-black border border-slate-700/60 shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-heading font-bold text-white text-sm">
                    #{idx + 1} {s.headline || `Slide ${idx + 1}`}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    {s.scene_duration.toFixed(1)}s
                  </span>
                </div>

                {s.narration_script ? (
                  <p className="text-xs text-slate-300 line-clamp-2">
                    <span className="text-emerald-400 font-semibold">Voice: </span>
                    {s.narration_script}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 italic">No narration voice script</p>
                )}

                {s.caption && (
                  <p className="text-[11px] text-slate-400 truncate">
                    <span className="text-yellow-400 font-medium">Caption: </span>
                    {s.caption}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Interactive Timeline Canvas */
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl overflow-x-auto">
          {/* Track Headers and Lanes */}
          <div className="min-w-[650px] space-y-3">
            {/* Track 1: Visual Slides */}
            <div className="flex items-center gap-3">
              <div className="w-28 sm:w-32 flex items-center gap-2 text-xs font-semibold text-slate-300 shrink-0">
                <Film className="w-4 h-4 text-sky-400" />
                <span>1. Slides</span>
              </div>
              <div className="flex-1 flex gap-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
                {scenes.map((s, idx) => {
                  const widthPct = Math.max(10, (s.scene_duration / Math.max(1, totalDuration)) * 100);
                  return (
                    <div
                      key={s.id}
                      onClick={() => onSelectItem(s.id)}
                      style={{ width: `${widthPct}%` }}
                      className="h-16 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 p-1.5 flex items-center gap-2 cursor-pointer transition-colors overflow-hidden group"
                    >
                      <img
                        src={s.thumbnail_url}
                        alt="slide"
                        className="h-full aspect-[9/16] object-cover rounded bg-black shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-bold text-white block truncate">
                          #{idx + 1} {s.headline || `Slide ${idx+1}`}
                        </span>
                        <span className="text-[10px] font-mono text-sky-400">
                          {s.scene_duration.toFixed(1)}s
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 2: Narration Voiceover */}
            <div className="flex items-center gap-3">
              <div className="w-28 sm:w-32 flex items-center gap-2 text-xs font-semibold text-slate-300 shrink-0">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>2. Voiceover</span>
              </div>
              <div className="flex-1 flex gap-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
                {scenes.map((s, idx) => {
                  const widthPct = Math.max(10, (s.scene_duration / Math.max(1, totalDuration)) * 100);
                  const hasVoice = !!s.audio_path;
                  return (
                    <div
                      key={s.id}
                      style={{ width: `${widthPct}%` }}
                      className={`h-10 rounded-lg p-1.5 flex items-center justify-between border text-[11px] font-mono overflow-hidden ${
                        hasVoice
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      <span className="truncate">{s.narration_script || 'Silence'}</span>
                      <span className="text-[10px] shrink-0 font-bold ml-1">
                        {s.measured_audio_duration ? `${s.measured_audio_duration.toFixed(1)}s` : '0s'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 3: Subtitles */}
            <div className="flex items-center gap-3">
              <div className="w-28 sm:w-32 flex items-center gap-2 text-xs font-semibold text-slate-300 shrink-0">
                <Type className="w-4 h-4 text-yellow-400" />
                <span>3. Captions</span>
              </div>
              <div className="flex-1 flex gap-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
                {scenes.map((s, idx) => {
                  const widthPct = Math.max(10, (s.scene_duration / Math.max(1, totalDuration)) * 100);
                  return (
                    <div
                      key={s.id}
                      style={{ width: `${widthPct}%` }}
                      className="h-8 rounded-lg bg-yellow-950/30 border border-yellow-500/30 px-2 flex items-center text-[10px] font-medium text-yellow-300 truncate"
                    >
                      <span>{s.narration_script || s.caption || 'No caption'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 4: Background Music */}
            <div className="flex items-center gap-3">
              <div className="w-28 sm:w-32 flex items-center gap-2 text-xs font-semibold text-slate-300 shrink-0">
                <Music className="w-4 h-4 text-purple-400" />
                <span>4. BGM Music</span>
              </div>
              <div className="flex-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
                <div className="h-8 rounded-lg bg-purple-950/40 border border-purple-500/40 px-3 flex items-center justify-between text-xs font-medium text-purple-300">
                  <span>{project.audio_settings?.bgm_filename || 'No background track selected'}</span>
                  {project.audio_settings?.enable_ducking && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-200">
                      Ducking Active (-14dB)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

