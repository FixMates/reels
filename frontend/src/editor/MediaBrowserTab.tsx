import React, { useState } from 'react';
import { Upload, FileText, Image as ImageIcon, CheckSquare, Square, Trash2, Copy, RotateCw, FlipHorizontal, ArrowUp, ArrowDown, Crop, Plus } from 'lucide-react';
import { Project, Scene } from '../types/project';
import { api } from '../api/client';

interface MediaBrowserTabProps {
  project: Project;
  onProjectUpdate: (p: Project) => void;
  onSelectItem: (sceneId: string) => void;
}

export const MediaBrowserTab: React.FC<MediaBrowserTabProps> = ({
  project,
  onProjectUpdate,
  onSelectItem
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setUploading(true);
      await api.uploadPDF(project.id, file);
      const updated = await api.getProject(project.id);
      onProjectUpdate(updated);
    } catch (err: any) {
      alert(`PDF import failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    try {
      setUploading(true);
      await api.uploadImages(project.id, files);
      const updated = await api.getProject(project.id);
      onProjectUpdate(updated);
    } catch (err: any) {
      alert(`Images import failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const toggleInclude = async (scene: Scene) => {
    try {
      await api.updateScene(scene.id, { is_included: !scene.is_included });
      const updated = await api.getProject(project.id);
      onProjectUpdate(updated);
    } catch (err: any) {
      alert(`Failed to update scene: ${err.message}`);
    }
  };

  const selectAll = async (include: boolean) => {
    try {
      for (const s of project.scenes) {
        if (s.is_included !== include) {
          await api.updateScene(s.id, { is_included: include });
        }
      }
      const updated = await api.getProject(project.id);
      onProjectUpdate(updated);
    } catch (err: any) {
      alert(`Error updating scenes: ${err.message}`);
    }
  };

  const moveScene = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= project.scenes.length) return;

    const newScenes = [...project.scenes];
    const temp = newScenes[index];
    newScenes[index] = newScenes[targetIdx];
    newScenes[targetIdx] = temp;

    const ids = newScenes.map(s => s.id);
    await api.reorderScenes(project.id, ids);
    const updated = await api.getProject(project.id);
    onProjectUpdate(updated);
  };

  const duplicateScene = async (sceneId: string) => {
    await api.duplicateScene(sceneId);
    const updated = await api.getProject(project.id);
    onProjectUpdate(updated);
  };

  const deleteScene = async (sceneId: string) => {
    if (!confirm('Are you sure you want to delete this scene?')) return;
    await api.deleteScene(sceneId);
    const updated = await api.getProject(project.id);
    onProjectUpdate(updated);
  };

  const rotateScene = async (scene: Scene) => {
    const nextRot = (scene.rotation + 90) % 360;
    await api.updateScene(scene.id, { rotation: nextRot });
    const updated = await api.getProject(project.id);
    onProjectUpdate(updated);
  };

  const flipScene = async (scene: Scene) => {
    await api.updateScene(scene.id, { flip_h: !scene.flip_h });
    const updated = await api.getProject(project.id);
    onProjectUpdate(updated);
  };

  return (
    <div className="space-y-6">
      {/* Upload Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PDF Import Box */}
        <label className="border-2 border-dashed border-slate-700 hover:border-sky-500/80 bg-slate-900/60 hover:bg-slate-900/90 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group shadow-lg">
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handlePdfUpload}
            disabled={uploading}
          />
          <div className="w-12 h-12 rounded-xl bg-red-500/10 group-hover:bg-red-500/20 text-red-400 flex items-center justify-center mb-3 transition-colors">
            <FileText className="w-6 h-6" />
          </div>
          <span className="font-heading font-semibold text-white text-sm">
            Import PDF Document
          </span>
          <span className="text-xs text-slate-400 mt-1 text-center">
            Extracts all pages with automatic text detection
          </span>
        </label>

        {/* Images Import Box */}
        <label className="border-2 border-dashed border-slate-700 hover:border-sky-500/80 bg-slate-900/60 hover:bg-slate-900/90 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group shadow-lg">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImagesUpload}
            disabled={uploading}
          />
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 group-hover:bg-sky-500/20 text-sky-400 flex items-center justify-center mb-3 transition-colors">
            <ImageIcon className="w-6 h-6" />
          </div>
          <span className="font-heading font-semibold text-white text-sm">
            Import Image Collections
          </span>
          <span className="text-xs text-slate-400 mt-1 text-center">
            Upload multiple JPG, PNG, WebP images
          </span>
        </label>
      </div>

      {uploading && (
        <div className="p-4 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 text-sm flex items-center justify-center gap-3 animate-pulse">
          <Upload className="w-4 h-4 animate-spin" />
          <span>Processing and rasterizing media into studio resolution...</span>
        </div>
      )}

      {/* Sheet Browser Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div>
          <h3 className="font-heading font-bold text-lg text-white flex items-center gap-2">
            <span>Project Sheets & Slides</span>
            <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {project.scenes.length} Items ({project.scenes.filter(s => s.is_included).length} Active)
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Organize, reorder, rotate, and manage slides for your short video.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => selectAll(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            Select All
          </button>
          <button
            onClick={() => selectAll(false)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Grid of Scenes */}
      {project.scenes.length === 0 ? (
        <div className="text-center py-16 border border-slate-800 rounded-2xl bg-slate-900/30">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="font-heading font-semibold text-slate-300 text-base">No media uploaded yet</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Upload a PDF or multiple images above to start crafting your video reel.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {project.scenes.map((scene, idx) => {
            const hasAudio = !!scene.audio_path;
            const hasNarration = !!scene.narration_script.trim();

            return (
              <div
                key={scene.id}
                className={`group relative rounded-2xl overflow-hidden border transition-all flex flex-col ${
                  scene.is_included
                    ? 'border-slate-700/80 bg-slate-900/80 shadow-md hover:border-sky-500/60'
                    : 'border-slate-800/40 bg-slate-950/40 opacity-50'
                }`}
              >
                {/* Header Badge */}
                <div className="p-2 flex items-center justify-between text-xs bg-slate-950/70 border-b border-slate-800/60">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleInclude(scene)}
                      className="p-1 text-slate-400 hover:text-sky-400 transition-colors"
                      title={scene.is_included ? "Exclude scene" : "Include scene"}
                    >
                      {scene.is_included ? (
                        <CheckSquare className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                    <span className="font-mono font-bold text-white text-[11px]">
                      #{idx + 1}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono">
                    {scene.scene_duration.toFixed(1)}s
                  </span>
                </div>

                {/* Thumbnail Preview */}
                <div
                  onClick={() => onSelectItem(scene.id)}
                  className="aspect-[9/16] relative bg-slate-950 flex items-center justify-center cursor-pointer overflow-hidden p-1"
                >
                  <img
                    src={scene.thumbnail_url}
                    alt={scene.headline || `Scene ${idx+1}`}
                    style={{
                      transform: `rotate(${scene.rotation}deg) scaleX(${scene.flip_h ? -1 : 1})`
                    }}
                    className="max-h-full max-w-full object-contain rounded transition-transform"
                  />

                  {/* Overlaid Tags */}
                  <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1 pointer-events-none">
                    {hasNarration && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900/90 text-sky-300 font-medium truncate backdrop-blur-sm border border-slate-700/60">
                        {scene.narration_script}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Quick Actions */}
                <div className="p-2 border-t border-slate-800/70 bg-slate-950/60 flex flex-wrap items-center justify-between gap-1 text-slate-400">
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => moveScene(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-slate-800 hover:text-white disabled:opacity-20"
                      title="Move Left"
                    >
                      <ArrowUp className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                    <button
                      onClick={() => moveScene(idx, 'down')}
                      disabled={idx === project.scenes.length - 1}
                      className="p-1 rounded hover:bg-slate-800 hover:text-white disabled:opacity-20"
                      title="Move Right"
                    >
                      <ArrowDown className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => rotateScene(scene)}
                      className="p-1 rounded hover:bg-slate-800 hover:text-white"
                      title="Rotate 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => flipScene(scene)}
                      className="p-1 rounded hover:bg-slate-800 hover:text-white"
                      title="Flip Horizontal"
                    >
                      <FlipHorizontal className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => duplicateScene(scene.id)}
                      className="p-1 rounded hover:bg-slate-800 hover:text-white"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteScene(scene.id)}
                      className="p-1 rounded hover:bg-red-500/20 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
