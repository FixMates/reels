import React, { useState } from 'react';
import { Sparkles, Upload, Image as ImageIcon, Check, Palette } from 'lucide-react';
import { Project, BrandingConfig } from '../types/project';
import { api } from '../api/client';

interface BrandingTemplatesTabProps {
  project: Project;
  onProjectUpdate: (p: Project) => void;
}

export const BrandingTemplatesTab: React.FC<BrandingTemplatesTabProps> = ({
  project,
  onProjectUpdate
}) => {
  const [branding, setBranding] = useState<BrandingConfig>(project.branding || {
    brand_name: '',
    handle: '',
    accent_color: '#38bdf8',
    logo_position: 'top_center',
    show_border: true
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleSave = async (newBranding: BrandingConfig) => {
    setBranding(newBranding);
    try {
      const updated = await api.updateProject(project.id, { branding: newBranding });
      onProjectUpdate(updated);
    } catch (err: any) {
      console.error('Failed to update branding:', err);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setUploadingLogo(true);
      const res = await api.uploadLogo(project.id, file);
      const updated = await api.getProject(project.id);
      onProjectUpdate(updated);
      setBranding(updated.branding);
    } catch (err: any) {
      alert(`Logo upload failed: ${err.message}`);
    } finally {
      setUploadingLogo(false);
    }
  };

  const applyTemplate = (preset: string) => {
    let nextBranding = { ...branding };
    let nextSub = { ...project.subtitle_style };

    if (preset === 'trading') {
      nextBranding.accent_color = '#00F0FF';
      nextBranding.show_border = true;
      nextSub.highlight_color = '#00F0FF';
      nextSub.mode = 'word_highlight';
    } else if (preset === 'educational') {
      nextBranding.accent_color = '#6366F1';
      nextBranding.show_border = false;
      nextSub.highlight_color = '#FACC15';
      nextSub.mode = 'sentence';
    } else if (preset === 'product') {
      nextBranding.accent_color = '#EC4899';
      nextBranding.show_border = true;
      nextSub.highlight_color = '#F43F5E';
      nextSub.mode = 'word_highlight';
    } else if (preset === 'quote') {
      nextBranding.accent_color = '#E2E8F0';
      nextBranding.show_border = false;
      nextSub.highlight_color = '#FFFFFF';
      nextSub.mode = 'sentence';
    }

    handleSave(nextBranding);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div>
          <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
            <Palette className="w-5 h-5 text-sky-400" />
            <span>Branding & Reusable Templates</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Personalize your videos with your custom logo, social handles, and high-retention color themes.
          </p>
        </div>
      </div>

      {/* Templates Row */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
          One-Click Reusable Studio Templates
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { id: 'trading', title: 'Trading / Finance', color: 'from-cyan-500 to-blue-600', desc: 'Neon cyan accents for charts & structure' },
            { id: 'educational', title: 'Educational Explainer', color: 'from-indigo-500 to-purple-600', desc: 'Minimalist high-contrast teaching format' },
            { id: 'product', title: 'Product Showcase', color: 'from-pink-500 to-rose-600', desc: 'Vibrant punchy retail aesthetic' },
            { id: 'quote', title: 'Minimalist Quote', color: 'from-slate-400 to-slate-600', desc: 'Clean typography on deep black background' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => applyTemplate(t.id)}
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md group"
            >
              <div className={`w-full h-2 rounded-full bg-gradient-to-r ${t.color} mb-2.5`} />
              <span className="font-heading font-bold text-white text-xs block group-hover:text-sky-300">
                {t.title}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1 leading-snug">
                {t.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Branding Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logo Configuration */}
        <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-4 shadow-xl">
          <span className="font-heading font-bold text-white text-sm block">Logo Asset</span>

          <label className="border-2 border-dashed border-slate-700 hover:border-sky-500/80 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer bg-slate-950/60 transition-colors">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
              disabled={uploadingLogo}
            />
            {branding.logo_path ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={`/api/media/file?path=${branding.logo_path}`}
                  alt="Logo"
                  className="max-h-16 object-contain"
                />
                <span className="text-xs text-sky-400 font-medium">Click to replace logo</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-400">
                <Upload className="w-5 h-5 text-sky-400" />
                <span className="text-xs font-semibold text-slate-200">Upload Channel Logo</span>
                <span className="text-[10px] text-slate-500">Supports transparent PNG / JPG</span>
              </div>
            )}
          </label>

          {/* Logo Position */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Logo Position
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {(['top_center', 'top_left', 'top_right'] as const).map(pos => (
                <button
                  key={pos}
                  onClick={() => handleSave({ ...branding, logo_position: pos })}
                  className={`py-2 rounded-xl capitalize font-medium transition-colors ${
                    branding.logo_position === pos
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {pos.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Identity & Accent */}
        <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-4 shadow-xl">
          <span className="font-heading font-bold text-white text-sm block">Brand Identity & Accent</span>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Brand / Channel Name</label>
            <input
              type="text"
              value={branding.brand_name || ''}
              onChange={e => handleSave({ ...branding, brand_name: e.target.value })}
              placeholder="e.g. Apex Trading Institute"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Social Handle</label>
            <input
              type="text"
              value={branding.handle || ''}
              onChange={e => handleSave({ ...branding, handle: e.target.value })}
              placeholder="e.g. @apex_trader"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Accent Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={branding.accent_color || '#38bdf8'}
                onChange={e => handleSave({ ...branding, accent_color: e.target.value })}
                className="w-10 h-10 rounded-xl border border-slate-700 bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={branding.accent_color || '#38bdf8'}
                onChange={e => handleSave({ ...branding, accent_color: e.target.value })}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-white uppercase w-28"
              />
              <label className="flex items-center gap-2 text-xs text-slate-300 ml-auto cursor-pointer">
                <input
                  type="checkbox"
                  checked={branding.show_border ?? true}
                  onChange={e => handleSave({ ...branding, show_border: e.target.checked })}
                  className="rounded text-sky-500"
                />
                <span>Outer Accent Border</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
