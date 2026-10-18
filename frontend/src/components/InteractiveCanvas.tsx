import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Move, Lock, Unlock, Eye, EyeOff, RotateCw, Trash2, Copy, 
  ArrowUp, ArrowDown, AlignCenter, Grid, Compass, Shield, Maximize2 
} from 'lucide-react';
import { OverlayLayer, Scene } from '../types/project';
import { SafeZoneOverlay } from './SafeZoneOverlay';

interface InteractiveCanvasProps {
  scene: Scene;
  layers: OverlayLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string | null) => void;
  onUpdateLayer: (layerId: string, updates: Partial<OverlayLayer>) => void;
  onAddLayer: (type: OverlayLayer['type']) => void;
  onDeleteLayer: (layerId: string) => void;
  onDuplicateLayer: (layerId: string) => void;
  onReorderLayer: (layerId: string, direction: 'up' | 'down') => void;
  showSafeZone: boolean;
  platformSafeZone?: 'reels' | 'tiktok' | 'shorts';
}

export const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({
  scene,
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onAddLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onReorderLayer,
  showSafeZone,
  platformSafeZone = 'reels'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [initialLayerPos, setInitialLayerPos] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [snapToCenter, setSnapToCenter] = useState(true);
  const [constrainEdges, setConstrainEdges] = useState(true);
  const [isNearCenterX, setIsNearCenterX] = useState(false);
  const [isNearCenterY, setIsNearCenterY] = useState(false);

  const [canvasScale, setCanvasScale] = useState(0.355);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        if (w > 0) setCanvasScale(w / 1080);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const hexToRgba = (hex: string, opacity: number = 1): string => {
    let c = (hex || '#000000').replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const r = parseInt(c.substring(0, 2), 16) || 0;
    const g = parseInt(c.substring(2, 4), 16) || 0;
    const b = parseInt(c.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
  };

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  // Handle Dragging
  const handlePointerDown = (e: React.PointerEvent, layer: OverlayLayer) => {
    e.stopPropagation();
    onSelectLayer(layer.id);
    if (layer.locked) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsDragging(true);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setInitialLayerPos({ x: layer.x, y: layer.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStartPos || !initialLayerPos || !selectedLayer || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = (e.clientX - dragStartPos.x) / rect.width;
    const deltaY = (e.clientY - dragStartPos.y) / rect.height;

    let newX = initialLayerPos.x + deltaX;
    let newY = initialLayerPos.y + deltaY;

    // Center snapping (snap threshold 2.5%)
    let nearX = false;
    let nearY = false;
    if (snapToCenter) {
      if (Math.abs(newX - 0.5) < 0.025) {
        newX = 0.5;
        nearX = true;
      }
      if (Math.abs(newY - 0.5) < 0.025) {
        newY = 0.5;
        nearY = true;
      }
    }
    setIsNearCenterX(nearX);
    setIsNearCenterY(nearY);

    // Boundary constraints
    if (constrainEdges) {
      newX = Math.max(0.1, Math.min(0.9, newX));
      newY = Math.max(0.08, Math.min(0.92, newY));
    }

    onUpdateLayer(selectedLayer.id, {
      x: Number(newX.toFixed(3)),
      y: Number(newY.toFixed(3))
    });
  }, [isDragging, dragStartPos, initialLayerPos, selectedLayer, snapToCenter, constrainEdges, onUpdateLayer]);

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      setDragStartPos(null);
      setInitialLayerPos(null);
      setIsNearCenterX(false);
      setIsNearCenterY(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  // Quick preset positioning
  const snapPosition = (pos: 'top' | 'upper_mid' | 'center' | 'lower_mid' | 'bottom') => {
    if (!selectedLayer || selectedLayer.locked) return;
    const yMap = {
      top: 0.14,
      upper_mid: 0.30,
      center: 0.50,
      lower_mid: 0.70,
      bottom: 0.84
    };
    onUpdateLayer(selectedLayer.id, { x: 0.5, y: yMap[pos] });
  };

  return (
    <div className="flex flex-col items-center w-full select-none">
      {/* Canvas Top Controls Toolbar */}
      <div className="w-full max-w-sm flex items-center justify-between gap-1.5 mb-2 px-2 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-300">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded-lg border transition-colors ${showGrid ? 'bg-sky-500/20 border-sky-400/50 text-sky-300' : 'bg-slate-800 border-slate-700 hover:text-white'}`}
            title="Toggle Alignment Grid"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSnapToCenter(!snapToCenter)}
            className={`p-1.5 rounded-lg border transition-colors ${snapToCenter ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300' : 'bg-slate-800 border-slate-700 hover:text-white'}`}
            title="Snap to Center Guidelines"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setConstrainEdges(!constrainEdges)}
            className={`p-1.5 rounded-lg border transition-colors ${constrainEdges ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-300' : 'bg-slate-800 border-slate-700 hover:text-white'}`}
            title={constrainEdges ? 'Keep Inside Canvas (Enabled)' : 'Allow Free Edge Placement'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Selected Layer Quick Actions */}
        {selectedLayer && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdateLayer(selectedLayer.id, { locked: !selectedLayer.locked })}
              className={`p-1.5 rounded-lg border transition-colors ${selectedLayer.locked ? 'bg-amber-500/20 border-amber-400/50 text-amber-300' : 'bg-slate-800 border-slate-700 hover:text-white'}`}
              title={selectedLayer.locked ? 'Unlock Layer' : 'Lock Layer (Prevent accidental move)'}
            >
              {selectedLayer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => onUpdateLayer(selectedLayer.id, { visible: !selectedLayer.visible })}
              className={`p-1.5 rounded-lg border transition-colors ${!selectedLayer.visible ? 'bg-red-500/20 border-red-400/50 text-red-300' : 'bg-slate-800 border-slate-700 hover:text-white'}`}
              title={selectedLayer.visible ? 'Hide Layer' : 'Show Layer'}
            >
              {selectedLayer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => onDuplicateLayer(selectedLayer.id)}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:text-white transition-colors"
              title="Duplicate Layer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDeleteLayer(selectedLayer.id)}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              title="Delete Layer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Portrait 9:16 Interactive Canvas */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={() => onSelectLayer(null)}
        className="w-full max-w-sm aspect-[9/16] relative rounded-3xl overflow-hidden border-2 border-slate-800 bg-slate-950 shadow-2xl touch-none cursor-default"
      >
        {/* Background Visual based on FitMode */}
        {scene.fit_mode === 'blur_bg' ? (
          <>
            <img
              src={scene.thumbnail_url}
              alt="bg blur"
              className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-40 pointer-events-none"
            />
            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
              <img
                src={scene.thumbnail_url}
                alt="content"
                style={{
                  transform: `rotate(${scene.rotation}deg) scaleX(${scene.flip_h ? -1 : 1})`
                }}
                className="max-h-[72%] max-w-[88%] object-contain rounded-2xl shadow-2xl border border-white/10"
              />
            </div>
          </>
        ) : scene.fit_mode === 'card' ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-slate-900/90 p-3 rounded-2xl border-2 border-sky-500/50 shadow-2xl max-h-[75%] max-w-[90%] flex items-center justify-center">
              <img
                src={scene.thumbnail_url}
                alt="card content"
                style={{
                  transform: `rotate(${scene.rotation}deg) scaleX(${scene.flip_h ? -1 : 1})`
                }}
                className="max-h-[280px] object-contain rounded-lg"
              />
            </div>
          </div>
        ) : scene.fit_mode === 'fill' ? (
          <img
            src={scene.thumbnail_url}
            alt="fill content"
            style={{
              transform: `rotate(${scene.rotation}deg) scaleX(${scene.flip_h ? -1 : 1})`
            }}
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <img
              src={scene.thumbnail_url}
              alt="fit content"
              style={{
                transform: `rotate(${scene.rotation}deg) scaleX(${scene.flip_h ? -1 : 1})`
              }}
              className="max-h-[82%] max-w-[90%] object-contain rounded-lg pointer-events-none shadow-xl"
            />
          </div>
        )}

        {/* Alignment Grid Overlay */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3">
            <div className="border-r border-b border-sky-400/20" />
            <div className="border-r border-b border-sky-400/20" />
            <div className="border-b border-sky-400/20" />
            <div className="border-r border-b border-sky-400/20" />
            <div className="border-r border-b border-sky-400/20" />
            <div className="border-b border-sky-400/20" />
            <div className="border-r border-sky-400/20" />
            <div className="border-r border-sky-400/20" />
            <div />
          </div>
        )}

        {/* Glowing Center Snapping Guidelines */}
        {isNearCenterX && (
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-cyan-400 shadow-[0_0_8px_#38bdf8] pointer-events-none z-30" />
        )}
        {isNearCenterY && (
          <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-cyan-400 shadow-[0_0_8px_#38bdf8] pointer-events-none z-30" />
        )}

        {/* Social Platform Safe Zone Guides */}
        <SafeZoneOverlay platform={platformSafeZone} visible={showSafeZone} />

        {/* Dynamic Interactive Layer Elements */}
        {layers
          .slice()
          .sort((a, b) => a.z_index - b.z_index)
          .map(layer => {
            const isSelected = layer.id === selectedLayerId;
            if (!layer.visible && !isSelected) return null;

            const transformStr = [
              `translate(-50%, -50%)`,
              layer.rotation ? `rotate(${layer.rotation}deg)` : '',
              layer.text_transform === 'uppercase' ? 'uppercase' : '',
            ].filter(Boolean).join(' ');

            return (
              <div
                key={layer.id}
                onPointerDown={(e) => handlePointerDown(e, layer)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLayer(layer.id);
                }}
                style={{
                  left: `${layer.x * 100}%`,
                  top: `${layer.y * 100}%`,
                  width: `${layer.width * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${layer.rotation || 0}deg)`,
                  zIndex: 20 + layer.z_index,
                  opacity: layer.visible ? 1 : 0.4
                }}
                className={`absolute group cursor-move transition-shadow ${
                  isSelected ? 'ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.5)]' : 'hover:ring-1 hover:ring-sky-400/50'
                }`}
              >
                {/* Styled Text Content Box */}
                <div
                  style={{
                    backgroundColor: layer.bg_opacity > 0 ? hexToRgba(layer.bg_color || '#000000', layer.bg_opacity) : 'transparent',
                    padding: `${Math.max(4, Math.round((layer.bg_padding || 14) * canvasScale))}px`,
                    borderRadius: `${Math.max(4, Math.round((layer.border_radius || 14) * canvasScale))}px`,
                    borderWidth: `${layer.stroke_width ? Math.max(1, Math.round(layer.stroke_width * canvasScale)) : 0}px`,
                    borderColor: layer.stroke_color || 'transparent',
                    borderStyle: layer.stroke_width ? 'solid' : 'none',
                    textAlign: layer.text_align || 'center',
                    boxShadow: layer.shadow_blur ? `${Math.round((layer.shadow_offset_x || 0) * canvasScale)}px ${Math.round((layer.shadow_offset_y || 2) * canvasScale)}px ${Math.round(layer.shadow_blur * canvasScale)}px ${layer.shadow_color || 'rgba(0,0,0,0.6)'}` : undefined
                  }}
                  className="w-full backdrop-blur-sm select-none"
                >
                  <p
                    style={{
                      color: layer.text_color || '#ffffff',
                      opacity: layer.text_opacity ?? 1.0,
                      fontSize: `${Math.max(10, Math.round((layer.font_size || 36) * canvasScale))}px`,
                      fontFamily: layer.font_family || 'Segoe UI, sans-serif',
                      fontWeight: layer.font_weight === 'bold' ? 700 : 400,
                      fontStyle: layer.italic ? 'italic' : 'normal',
                      textDecoration: layer.underline ? 'underline' : 'none',
                      textTransform: layer.text_transform === 'uppercase' ? 'uppercase' : (layer.text_transform === 'lowercase' ? 'lowercase' : (layer.text_transform === 'capitalize' ? 'capitalize' : 'none')),
                      lineHeight: 1.25,
                      textShadow: !layer.bg_opacity && layer.stroke_width ? `-1px -1px 0 ${layer.stroke_color}, 1px -1px 0 ${layer.stroke_color}, -1px 1px 0 ${layer.stroke_color}, 1px 1px 0 ${layer.stroke_color}` : undefined
                    }}
                    className="break-words leading-tight"
                  >
                    {layer.text || <span className="opacity-40 italic">Empty text</span>}
                  </p>
                </div>

                {/* Selection Drag Handles & Layer Badge */}
                {isSelected && (
                  <>
                    {/* Drag Handle Top Badge */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 border border-cyan-400 text-cyan-300 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1 shadow-md whitespace-nowrap pointer-events-none">
                      <Move className="w-2.5 h-2.5" />
                      <span>{layer.type.toUpperCase()}</span>
                      <span className="text-slate-400">({Math.round(layer.x * 100)}%, {Math.round(layer.y * 100)}%)</span>
                    </div>

                    {/* Corner Handles */}
                    <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-cyan-500 rounded-sm shadow pointer-events-none" />
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-cyan-500 rounded-sm shadow pointer-events-none" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-cyan-500 rounded-sm shadow pointer-events-none" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-cyan-500 rounded-sm shadow pointer-events-none" />
                  </>
                )}
              </div>
            );
          })}
      </div>

      {/* Quick Positioning Buttons */}
      {selectedLayer && (
        <div className="w-full max-w-sm flex items-center justify-between gap-1 mt-2.5 px-2 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-[11px] text-slate-300">
          <span className="text-[10px] text-slate-400 font-mono">Snap Y:</span>
          <button
            onClick={() => snapPosition('top')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Top
          </button>
          <button
            onClick={() => snapPosition('upper_mid')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Upper
          </button>
          <button
            onClick={() => snapPosition('center')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Center
          </button>
          <button
            onClick={() => snapPosition('lower_mid')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Lower
          </button>
          <button
            onClick={() => snapPosition('bottom')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Bottom
          </button>
        </div>
      )}
    </div>
  );
};
