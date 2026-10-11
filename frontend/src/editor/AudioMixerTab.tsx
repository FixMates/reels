import React, { useState, useEffect } from 'react';
import { Music, Volume2, Upload, Play, Sliders, Check, Sparkles } from 'lucide-react';
import { Project, AudioSettingsConfig } from '../types/project';
import { api } from '../api/client';
import { AudioWaveformPlayer } from '../components/AudioWaveformPlayer';

interface AudioMixerTabProps {
  project: Project;
  onProjectUpdate: (p: Project) => void;
}

export const AudioMixerTab: React.FC<AudioMixerTabProps> = ({
  project,
  onProjectUpdate
}) => {
  const [audioSettings, setAudioSettings] = useState<AudioSettingsConfig>(project.audio_settings || {
    bgm_volume: 0.25,
    narration_volume: 1.0,
    enable_ducking: true,
    ducking_db: -14.0,
    fade_duration: 1.0
  });

  const [bgmTracks, setBgmTracks] = useState<{ filename: string; duration: number; url: string }[]>([]);
  const [uploadingBgm, setUploadingBgm] = useState(false);

  useEffect(() => {
    api.listBGM().then(setBgmTracks).catch(console.error);
  }, []);

  const handleSave = async (newSettings: AudioSettingsConfig) => {
    setAudioSettings(newSettings);
    try {
      const updated = await api.updateProject(project.id, { audio_settings: newSettings });
      onProjectUpdate(updated);
    } catch (err: any) {
      console.error('Failed to update audio settings:', err);
    }
  };

  const handleUploadBgm = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setUploadingBgm(true);
      const res = await api.uploadBGM(file);
      const updatedList = await api.listBGM();
      setBgmTracks(updatedList);
      handleSave({ ...audioSettings, bgm_filename: res.filename });
    } catch (err: any) {
      alert(`BGM upload failed: ${err.message}`);
    } finally {
      setUploadingBgm(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div>
          <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
            <Music className="w-5 h-5 text-sky-400" />
            <span>Audio Studio & Background Mixing</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Mix voiceovers with ambient background music, sidechain audio ducking, and smooth end fades.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Narration Track Controls */}
        <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-white text-sm flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-sky-400" />
              Narration Voiceover Track
            </span>
            <span className="text-xs font-mono font-bold text-sky-400">
              {Math.round(audioSettings.narration_volume * 100)}%
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Voice Volume Multiplier</span>
              <span>Default 100%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.0"
              step="0.05"
              value={audioSettings.narration_volume}
              onChange={e => handleSave({ ...audioSettings, narration_volume: parseFloat(e.target.value) })}
              className="w-full accent-sky-400"
            />
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
            <span className="font-semibold text-slate-200 block">Total Narration Duration:</span>
            <span className="font-mono text-sky-300 block text-sm">
              {project.total_duration.toFixed(1)}s across {project.scenes.filter(s => s.is_included).length} active scenes
            </span>
          </div>
        </div>

        {/* Background Music & Ducking */}
        <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-white text-sm flex items-center gap-2">
              <Music className="w-4 h-4 text-purple-400" />
              Background Music (BGM)
            </span>
            <label className="text-xs text-slate-400 flex items-center gap-2 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-purple-400" />
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleUploadBgm}
                disabled={uploadingBgm}
              />
              <span className="text-purple-300 font-medium">Upload Audio</span>
            </label>
          </div>

          {/* BGM Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Select Background Track
            </label>
            <select
              value={audioSettings.bgm_filename || ''}
              onChange={e => handleSave({ ...audioSettings, bgm_filename: e.target.value || null })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-400"
            >
              <option value="">No Background Music (Voiceover Only)</option>
              {bgmTracks.map(t => (
                <option key={t.filename} value={t.filename}>
                  {t.filename} ({t.duration.toFixed(1)}s)
                </option>
              ))}
            </select>
          </div>

          {/* BGM Volume */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>BGM Master Volume</span>
              <span className="font-mono font-bold text-purple-400">
                {Math.round(audioSettings.bgm_volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.8"
              step="0.02"
              value={audioSettings.bgm_volume}
              onChange={e => handleSave({ ...audioSettings, bgm_volume: parseFloat(e.target.value) })}
              className="w-full accent-purple-400"
            />
          </div>

          {/* Smart Audio Ducking Toggle */}
          <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-800/40 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-semibold text-purple-200 text-xs flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Automatic Audio Ducking
              </span>
              <input
                type="checkbox"
                checked={audioSettings.enable_ducking}
                onChange={e => handleSave({ ...audioSettings, enable_ducking: e.target.checked })}
                className="w-4 h-4 rounded text-purple-500"
              />
            </label>
            <p className="text-[11px] text-purple-300/80 leading-relaxed">
              Dynamically compresses BGM by -14 dB whenever the narration is speaking, ensuring voice clarity, and smoothly restores volume during pauses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
