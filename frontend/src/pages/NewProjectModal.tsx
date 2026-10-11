import React, { useState } from 'react';
import { X, Sparkles, Film, Smartphone, Monitor, Square, Layers } from 'lucide-react';
import { api } from '../api/client';
import { Project } from '../types/project';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated
}) => {
  const [title, setTitle] = useState('New Video Project');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1' | '4:5'>('9:16');
  const [projectType, setProjectType] = useState('pdf_to_video');
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    try {
      setCreating(true);
      let width = 1080;
      let height = 1920;

      if (aspectRatio === '16:9') {
        width = 1920;
        height = 1080;
      } else if (aspectRatio === '1:1') {
        width = 1080;
        height = 1080;
      } else if (aspectRatio === '4:5') {
        width = 1080;
        height = 1350;
      }

      const p = await api.createProject({
        title,
        aspect_ratio: aspectRatio,
        width,
        height,
        fps: 30,
        voice_engine: 'sapi',
        default_scene_duration: 3.5,
        end_padding_seconds: 0.7
      });

      onProjectCreated(p);
      onClose();
    } catch (err: any) {
      alert(`Failed to create project: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-sky-400" />
            <h3 className="font-heading font-bold text-lg text-white">Create New Video Project</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 text-sm">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
              Project Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Order Block Strategy Breakdown"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-400"
            />
          </div>

          {/* Aspect Ratio Presets */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Select Aspect Ratio
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: '9:16', title: '9:16 Vertical', desc: 'Reels / Shorts', icon: Smartphone },
                { id: '16:9', title: '16:9 Landscape', desc: 'YouTube Desktop', icon: Monitor },
                { id: '1:1', title: '1:1 Square', desc: 'Instagram Feed', icon: Square },
                { id: '4:5', title: '4:5 Portrait', desc: 'Feed Portrait', icon: Smartphone }
              ].map(ar => {
                const Icon = ar.icon;
                return (
                  <button
                    key={ar.id}
                    type="button"
                    onClick={() => setAspectRatio(ar.id as any)}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col items-center justify-center text-center ${
                      aspectRatio === ar.id
                        ? 'border-sky-500 bg-sky-500/10 text-white shadow-md'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1 text-sky-400" />
                    <span className="font-semibold text-xs block">{ar.title}</span>
                    <span className="text-[10px] text-slate-500 block">{ar.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Project Type / Template */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Project Category
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'pdf_to_video', label: 'PDF to Video Reel', desc: 'Page-by-page document narration' },
                { id: 'image_slideshow', label: 'Image Slideshow', desc: 'Photo collection with AI voice' },
                { id: 'trading_tutorial', label: 'Trading Breakdown', desc: 'Neon charts & structure guides' },
                { id: 'custom_project', label: 'Custom Video', desc: 'Blank timeline canvas' },
              ].map(pt => (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => setProjectType(pt.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    projectType === pt.id
                      ? 'border-sky-500 bg-sky-500/10 text-white font-semibold'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block text-xs font-semibold">{pt.label}</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">{pt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !title.trim()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-heading font-bold text-xs flex items-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{creating ? 'Creating Project...' : 'Launch Project Studio'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
