import React, { useState } from 'react';
import { Crop, RotateCw, FlipHorizontal, Check, RefreshCw, Eye, EyeOff, LayoutTemplate } from 'lucide-react';
import { Project, Scene, CropData } from '../types/project';
import { api } from '../api/client';
import { SafeZoneOverlay } from '../components/SafeZoneOverlay';

interface CropCompositionTabProps {
  project: Project;
  currentSceneId?: string;
  onProjectUpdate: (p: Project) => void;
}

export const CropCompositionTab: React.FC<CropCompositionTabProps> = ({
  project,
  currentSceneId,
  onProjectUpdate
}) => {
  const scenes = project.scenes;
  const currentIdx = Math.max(0, scenes.findIndex(s => s.id === currentSceneId));
  const activeScene = scenes[currentIdx] || scenes[0];

  const [crop, setCrop] = useState<CropData>(activeScene?.crop || { x: 0, y: 0, w: 1, h: 1 });
  const [fitMode, setFitMode] = useState(activeScene?.fit_mode || 'fit');
  const [showSafeZone, setShowSafeZone] = useState(true);

  if (!activeScene) {
    return <div className="text-center py-20 text-slate-400">No media available to crop.</div>;
  }

  const applyPreset = (preset: 'free' | '9:16' | '1:1' | '16:9') => {
    if (preset === 'free') {
      setCrop({ x: 0, y: 0, w: 1, h: 1 });
    } else if (preset === '9:16') {
      // Center 9:16 vertical crop
      const w = 0.5625; // 9/16
      const x = (1 - w) / 2;
      setCrop({ x: Math.max(0, x), y: 0, w: Math.min(1, w), h: 1 });
    } else if (preset === '1:1') {
      setCrop({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    } else if (preset === '16:9') {
      const h = 0.5625;
      const y = (1 - h) / 2;
      setCrop({ x: 0, y: Math.max(0, y), w: 1, h: Math.min(1, h) });
    }
  };

  const handleSaveCrop = async (applyToAll: boolean = false) => {
    try {
      if (applyToAll) {
        for (const s of scenes) {
          await api.updateScene(s.id, { crop, fit_mode: fitMode });
        }
      } else {
        await api.updateScene(activeScene.id, { crop, fit_mode: fitMode });
      }
      const updated = await api.getProject(project.id);
      onProjectUpdate(updated);
      alert(applyToAll ? 'Crop applied to all slides!' : 'Crop saved for current slide!');
    } catch (err: any) {
      alert(`Error saving crop: ${err.message}`);
    }
  };

  const resetCrop = async () => {
    const fullCrop = { x: 0, y: 0, w: 1, h: 1 };
    setCrop(fullCrop);
    await api.updateScene(activeScene.id, { crop: null });
    const updated = await api.getProject(project.id);
    onProjectUpdate(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
            <Crop className="w-5 h-5 text-sky-400" />
            <span>Crop & Visual Framing: Slide #{currentIdx + 1}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Adjust visual framing, safe social margins, and fit style for Instagram Reels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSafeZone(!showSafeZone)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 ${
              showSafeZone ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {showSafeZone ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>Reels Safe Guides</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Canvas Preview with interactive crop box simulation */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full max-w-sm aspect-[9/16] relative rounded-3xl overflow-hidden border-2 border-slate-700 bg-slate-950 flex items-center justify-center shadow-2xl">
            <SafeZoneOverlay platform="reels" visible={showSafeZone} />

            {/* Underlying media */}
            <div className="relative w-full h-full flex items-center justify-center p-2">
              <img
                src={activeScene.thumbnail_url}
                alt="Source"
                style={{
                  transform: `rotate(${activeScene.rotation}deg) scaleX(${activeScene.flip_h ? -1 : 1})`
                }}
                className="max-h-full max-w-full object-contain rounded-lg"
              />

              {/* Crop Box Wireframe Overlay */}
              <div
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`
                }}
                className="absolute border-2 border-sky-400 bg-sky-400/10 pointer-events-none rounded shadow-lg flex items-center justify-center"
              >
                <span className="text-[10px] font-mono font-bold text-sky-300 bg-black/80 px-1.5 py-0.5 rounded">
                  Active Crop
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Framing & Controls */}
        <div className="lg:col-span-6 space-y-4 sm:space-y-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl">
          {/* Preset Buttons */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Aspect Ratio Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'free', label: 'Reset Full' },
                { id: '9:16', label: '9:16 Vertical' },
                { id: '1:1', label: '1:1 Square' },
                { id: '16:9', label: '16:9 Wide' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id as any)}
                  className="py-2.5 px-2 text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 font-medium transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fit Mode */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Framing & Background Style
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'fit', label: 'Fit (Letterbox)', desc: 'Full image with ambient fill' },
                { id: 'blur_bg', label: 'Ambient Blur Background', desc: 'Modern TikTok/Reels aesthetic' },
                { id: 'fill', label: 'Fill (Full bleed)', desc: 'Scales to cover canvas' },
                { id: 'card', label: 'Floating Card', desc: 'Rounded card with sleek border' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setFitMode(m.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    fitMode === m.id
                      ? 'border-sky-500 bg-sky-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="font-semibold block">{m.label}</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Coordinate Sliders */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-xs font-semibold text-slate-300 block">Fine Crop Coordinates (Normalized)</span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400">Offset X: {(crop.x * 100).toFixed(0)}%</span>
                <input
                  type="range"
                  min="0"
                  max="0.9"
                  step="0.05"
                  value={crop.x}
                  onChange={e => setCrop({ ...crop, x: parseFloat(e.target.value) })}
                  className="w-full mt-1 accent-sky-400"
                />
              </div>
              <div>
                <span className="text-slate-400">Offset Y: {(crop.y * 100).toFixed(0)}%</span>
                <input
                  type="range"
                  min="0"
                  max="0.9"
                  step="0.05"
                  value={crop.y}
                  onChange={e => setCrop({ ...crop, y: parseFloat(e.target.value) })}
                  className="w-full mt-1 accent-sky-400"
                />
              </div>
              <div>
                <span className="text-slate-400">Width: {(crop.w * 100).toFixed(0)}%</span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={crop.w}
                  onChange={e => setCrop({ ...crop, w: parseFloat(e.target.value) })}
                  className="w-full mt-1 accent-sky-400"
                />
              </div>
              <div>
                <span className="text-slate-400">Height: {(crop.h * 100).toFixed(0)}%</span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={crop.h}
                  onChange={e => setCrop({ ...crop, h: parseFloat(e.target.value) })}
                  className="w-full mt-1 accent-sky-400"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => handleSaveCrop(false)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
            >
              <Check className="w-4 h-4" />
              <span>Apply to Current Slide</span>
            </button>

            <button
              onClick={() => handleSaveCrop(true)}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
            >
              Apply to All Slides
            </button>

            <button
              onClick={resetCrop}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              title="Reset Crop"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
