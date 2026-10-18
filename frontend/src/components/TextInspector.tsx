import React from 'react';
import { 
  Type, Palette, AlignLeft, AlignCenter, AlignRight, Bold, Italic, 
  Underline, Sparkles, RotateCcw, Sliders, Box, Layers, Shield, 
  MoveHorizontal, MoveVertical, ShieldAlert 
} from 'lucide-react';
import { OverlayLayer } from '../types/project';

interface TextInspectorProps {
  layer: OverlayLayer | null;
  onUpdateLayer: (layerId: string, updates: Partial<OverlayLayer>) => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
}

const PRESET_STYLES = [
  {
    name: 'Bold Accent',
    style: {
      font_family: 'Segoe UI',
      font_size: 40,
      font_weight: 'bold' as const,
      text_color: '#38BDF8',
      bg_color: '#071020',
      bg_opacity: 0.88,
      bg_padding: 16,
      border_radius: 18,
      stroke_color: '#38BDF8',
      stroke_width: 2,
      shadow_blur: 8
    }
  },
  {
    name: 'Financial Gold',
    style: {
      font_family: 'Georgia',
      font_size: 42,
      font_weight: 'bold' as const,
      text_color: '#FACC15',
      bg_color: '#1C1917',
      bg_opacity: 0.92,
      bg_padding: 14,
      border_radius: 14,
      stroke_color: '#EAB308',
      stroke_width: 1,
      shadow_blur: 6
    }
  },
  {
    name: 'Neon Cyber',
    style: {
      font_family: 'Impact',
      font_size: 46,
      font_weight: 'bold' as const,
      text_color: '#A855F7',
      bg_color: '#1E1B4B',
      bg_opacity: 0.85,
      bg_padding: 14,
      border_radius: 16,
      stroke_color: '#C084FC',
      stroke_width: 2,
      shadow_blur: 12
    }
  },
  {
    name: 'Minimal Clean',
    style: {
      font_family: 'Arial',
      font_size: 32,
      font_weight: 'normal' as const,
      text_color: '#F8FAFC',
      bg_color: '#0F172A',
      bg_opacity: 0.65,
      bg_padding: 10,
      border_radius: 8,
      stroke_width: 0,
      shadow_blur: 4
    }
  },
  {
    name: 'High Contrast',
    style: {
      font_family: 'Segoe UI',
      font_size: 36,
      font_weight: 'bold' as const,
      text_color: '#FFFFFF',
      bg_color: '#000000',
      bg_opacity: 0.95,
      bg_padding: 18,
      border_radius: 12,
      stroke_color: '#FFFFFF',
      stroke_width: 1,
      shadow_blur: 0
    }
  }
];

export const TextInspector: React.FC<TextInspectorProps> = ({
  layer,
  onUpdateLayer,
  onDuplicateLayer,
  onDeleteLayer
}) => {
  if (!layer) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center text-slate-400">
        <Type className="w-8 h-8 mx-auto mb-2 opacity-30 text-sky-400" />
        <h4 className="font-heading font-semibold text-slate-200 text-sm">No Layer Selected</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          Click any text element on the canvas to edit its position, typography, background badge, and animations.
        </p>
      </div>
    );
  }

  const update = (updates: Partial<OverlayLayer>) => {
    onUpdateLayer(layer.id, updates);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-5 shadow-xl text-xs text-slate-300">
      {/* Header & Quick Identity */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
          <span className="font-heading font-bold text-white uppercase text-xs tracking-wider">
            {layer.type} Layer
          </span>
          {layer.locked && (
            <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-mono">
              Locked
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onDuplicateLayer(layer.id)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Duplicate
          </button>
          <button
            onClick={() => onDeleteLayer(layer.id)}
            className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Text Content */}
      <div className="space-y-1.5">
        <label className="font-semibold text-slate-200">Text Content</label>
        <textarea
          value={layer.text}
          onChange={(e) => update({ text: e.target.value })}
          rows={2}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-500 transition-colors"
          placeholder="Enter text..."
        />
      </div>

      {/* Quick Style Presets */}
      <div className="space-y-2">
        <label className="font-semibold text-slate-200 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Style Presets
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {PRESET_STYLES.map(p => (
            <button
              key={p.name}
              onClick={() => update(p.style)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-slate-300 transition-all text-left truncate font-medium"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Position Coordinates & Sizing */}
      <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" /> Precise Placement & Alignment
          </span>
          <button
            onClick={() => update({ x: 0.5, y: 0.5, rotation: 0 })}
            className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
          >
            <RotateCcw className="w-2.5 h-2.5" /> Center & Reset
          </button>
        </div>

        {/* Quick Position Snaps */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Vertical Snap:</span>
            <div className="flex items-center gap-1">
              {[
                { label: 'Top', y: 0.14 },
                { label: 'Upper', y: 0.30 },
                { label: 'Center', y: 0.50 },
                { label: 'Lower', y: 0.70 },
                { label: 'Bottom', y: 0.84 }
              ].map(s => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => update({ y: s.y })}
                  className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                    Math.abs(layer.y - s.y) < 0.02
                      ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Horizontal Snap:</span>
            <div className="flex items-center gap-1">
              {[
                { label: 'Left', x: 0.25 },
                { label: 'Center', x: 0.50 },
                { label: 'Right', x: 0.75 }
              ].map(s => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => update({ x: s.x })}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                    Math.abs(layer.x - s.x) < 0.02
                      ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Position X</span>
              <span className="font-mono text-cyan-300">{Math.round(layer.x * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.95"
              step="0.01"
              value={layer.x}
              onChange={(e) => update({ x: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Position Y</span>
              <span className="font-mono text-cyan-300">{Math.round(layer.y * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.95"
              step="0.01"
              value={layer.y}
              onChange={(e) => update({ y: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Max Box Width</span>
              <span className="font-mono text-cyan-300">{Math.round(layer.width * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.02"
              value={layer.width}
              onChange={(e) => update({ width: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Rotation</span>
              <span className="font-mono text-cyan-300">{layer.rotation || 0}°</span>
            </div>
            <input
              type="range"
              min="-45"
              max="45"
              step="1"
              value={layer.rotation || 0}
              onChange={(e) => update({ rotation: parseInt(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="space-y-3">
        <label className="font-semibold text-slate-200 flex items-center gap-1">
          <Type className="w-3.5 h-3.5 text-sky-400" /> Typography
        </label>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Font Family</span>
            <select
              value={layer.font_family}
              onChange={(e) => update({ font_family: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
            >
              <option value="Segoe UI">Segoe UI</option>
              <option value="Arial">Arial</option>
              <option value="Impact">Impact (Heavy)</option>
              <option value="Calibri">Calibri</option>
              <option value="Georgia">Georgia (Editorial)</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Trebuchet MS">Trebuchet MS</option>
            </select>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Font Size ({layer.font_size}px)</span>
            <input
              type="range"
              min="16"
              max="72"
              step="1"
              value={layer.font_size}
              onChange={(e) => update({ font_size: parseInt(e.target.value) })}
              className="w-full mt-2 accent-sky-400"
            />
          </div>
        </div>

        {/* Styling buttons: Bold, Italic, Underline, Alignments, Transforms */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 p-0.5">
            <button
              onClick={() => update({ font_weight: layer.font_weight === 'bold' ? 'normal' : 'bold' })}
              className={`p-1.5 rounded-lg transition-colors ${layer.font_weight === 'bold' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => update({ italic: !layer.italic })}
              className={`p-1.5 rounded-lg transition-colors ${layer.italic ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => update({ underline: !layer.underline })}
              className={`p-1.5 rounded-lg transition-colors ${layer.underline ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Underline"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 p-0.5">
            <button
              onClick={() => update({ text_align: 'left' })}
              className={`p-1.5 rounded-lg transition-colors ${layer.text_align === 'left' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Align Left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => update({ text_align: 'center' })}
              className={`p-1.5 rounded-lg transition-colors ${layer.text_align === 'center' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Align Center"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => update({ text_align: 'right' })}
              className={`p-1.5 rounded-lg transition-colors ${layer.text_align === 'right' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Align Right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 p-0.5 text-[10px]">
            {(['none', 'uppercase', 'capitalize'] as const).map(tr => (
              <button
                key={tr}
                onClick={() => update({ text_transform: tr })}
                className={`px-2 py-1 rounded-lg capitalize transition-colors ${layer.text_transform === tr ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                {tr}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Colors & Background Badge */}
      <div className="space-y-3">
        <label className="font-semibold text-slate-200 flex items-center gap-1">
          <Palette className="w-3.5 h-3.5 text-emerald-400" /> Color & Background
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Text Color</span>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1.5">
              <input
                type="color"
                value={layer.text_color || '#ffffff'}
                onChange={(e) => update({ text_color: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              />
              <span className="font-mono text-[11px] uppercase">{layer.text_color || '#FFFFFF'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Badge Background</span>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1.5">
              <input
                type="color"
                value={layer.bg_color || '#000000'}
                onChange={(e) => update({ bg_color: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              />
              <span className="font-mono text-[11px] uppercase">{layer.bg_color || '#000000'}</span>
            </div>
          </div>
        </div>

        {/* Sliders for Badge Opacity, Padding & Radius */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Bg Opacity ({Math.round((layer.bg_opacity || 0) * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={layer.bg_opacity || 0}
              onChange={(e) => update({ bg_opacity: parseFloat(e.target.value) })}
              className="w-full accent-emerald-400"
            />
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Padding ({layer.bg_padding || 12}px)</span>
            <input
              type="range"
              min="4"
              max="32"
              step="2"
              value={layer.bg_padding || 12}
              onChange={(e) => update({ bg_padding: parseInt(e.target.value) })}
              className="w-full accent-emerald-400"
            />
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Radius ({layer.border_radius || 12}px)</span>
            <input
              type="range"
              min="0"
              max="30"
              step="2"
              value={layer.border_radius || 12}
              onChange={(e) => update({ border_radius: parseInt(e.target.value) })}
              className="w-full accent-emerald-400"
            />
          </div>
        </div>
      </div>

      {/* Outline & Shadow */}
      <div className="space-y-3">
        <label className="font-semibold text-slate-200 flex items-center gap-1">
          <Box className="w-3.5 h-3.5 text-indigo-400" /> Border Outline & Shadow
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Border Stroke ({layer.stroke_width || 0}px)</span>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1.5">
              <input
                type="color"
                value={layer.stroke_color || '#38bdf8'}
                onChange={(e) => update({ stroke_color: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              />
              <input
                type="range"
                min="0"
                max="6"
                step="1"
                value={layer.stroke_width || 0}
                onChange={(e) => update({ stroke_width: parseInt(e.target.value) })}
                className="w-full accent-indigo-400"
              />
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Drop Shadow Blur ({layer.shadow_blur || 0}px)</span>
            <input
              type="range"
              min="0"
              max="20"
              step="2"
              value={layer.shadow_blur || 0}
              onChange={(e) => update({ shadow_blur: parseInt(e.target.value) })}
              className="w-full mt-2.5 accent-indigo-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
