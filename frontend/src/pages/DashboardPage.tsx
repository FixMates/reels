import React, { useState, useEffect } from 'react';
import { Plus, Upload, Film, FileText, Image as ImageIcon, Copy, Trash2, ArrowRight, Play, Download, Clock, HardDrive, CheckCircle2, AlertTriangle, Activity, Edit3, X, Check } from 'lucide-react';
import { Project, ExportRecord, SystemHealth } from '../types/project';
import { api } from '../api/client';

interface DashboardPageProps {
  onOpenNewProjectModal: () => void;
  onOpenProject: (projectId: string) => void;
  onOpenHealth: () => void;
  health: SystemHealth | null;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenNewProjectModal,
  onOpenProject,
  onOpenHealth,
  health
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [pList, eList] = await Promise.all([
        api.getProjects(),
        api.getExports()
      ]);
      setProjects(pList);
      setExports(eList);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setErrorMsg(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDuplicate = async (projectId: string) => {
    try {
      await api.duplicateProject(projectId);
      loadData();
    } catch (err: any) {
      alert(`Duplicate failed: ${err.message}`);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) return;
    try {
      await api.deleteProject(projectId);
      loadData();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleStartRename = (project: Project) => {
    setRenamingId(project.id);
    setRenamingTitle(project.title);
  };

  const handleSaveRename = async (projectId: string) => {
    if (!renamingTitle.trim()) return;
    try {
      await api.updateProject(projectId, { title: renamingTitle.trim() });
      setRenamingId(null);
      loadData();
    } catch (err: any) {
      alert(`Rename failed: ${err.message}`);
    }
  };

  const isFfmpegOk = health?.ffmpeg?.ffmpeg_available ?? true;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Welcome Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden p-5 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold">
            <Activity className="w-3.5 h-3.5" />
            <span>LOCAL-FIRST DESKTOP VIDEO ENGINE</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-4xl text-white tracking-tight">
            AI Content-to-Video Studio
          </h1>
          <p className="text-slate-300 text-xs sm:text-base leading-relaxed">
            Convert PDFs, single images, and photo collections into professional Instagram Reels, TikToks, and YouTube Shorts with local AI narration, synchronized captions, and branding.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-2 sm:pt-3">
            <button
              onClick={onOpenNewProjectModal}
              className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-heading font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-sky-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Project</span>
            </button>

            <button
              onClick={onOpenHealth}
              className="px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700/80 flex items-center gap-2 transition-colors"
            >
              <HardDrive className="w-4 h-4 text-slate-400" />
              <span>Engine Status</span>
            </button>
          </div>
        </div>

        {/* Subtle decorative glow */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-sky-500/10 to-transparent pointer-events-none" />
      </div>

      {/* Pre-flight Warnings if Degraded */}
      {!isFfmpegOk && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs sm:text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">FFmpeg Acceleration Warning</span>
            <span className="text-xs text-amber-200/80">
              FFmpeg is not yet detected on system PATH. The studio will use static Python binary fallbacks.
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            onClick={loadData}
            className="px-3 py-1 rounded-lg bg-red-500/20 text-white font-medium text-xs hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {/* Recent Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg sm:text-xl text-white flex items-center gap-2">
            <span>Recent Video Projects</span>
            <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {projects.length}
            </span>
          </h2>

          <button
            onClick={onOpenNewProjectModal}
            className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 border border-slate-800/80 rounded-3xl bg-slate-900/40 p-8 text-slate-400 text-sm animate-pulse">
            Loading your video projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 border border-slate-800/80 rounded-3xl bg-slate-900/40 p-8">
            <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="font-heading font-semibold text-slate-200 text-base">No video projects found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Get started by clicking Create New Project above or importing a PDF or image deck.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {projects.map(p => (
              <div
                key={p.id}
                className="group relative rounded-3xl overflow-hidden border border-slate-800 hover:border-slate-700 bg-slate-900/80 hover:bg-slate-900 p-4 sm:p-5 transition-all shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700/60">
                      {p.aspect_ratio} ({p.width}x{p.height})
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Title & Rename Mode */}
                  {renamingId === p.id ? (
                    <div className="flex items-center gap-1.5 my-1">
                      <input
                        type="text"
                        value={renamingTitle}
                        onChange={e => setRenamingTitle(e.target.value)}
                        className="flex-1 px-2.5 py-1 text-sm bg-slate-950 border border-sky-400 rounded-lg text-white focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveRename(p.id)}
                        className="p-1.5 rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400"
                        title="Save Name"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        onClick={() => onOpenProject(p.id)}
                        className="font-heading font-bold text-white text-base hover:text-sky-400 cursor-pointer transition-colors truncate flex-1"
                        title={p.title}
                      >
                        {p.title}
                      </h3>
                      <button
                        onClick={() => handleStartRename(p)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors shrink-0"
                        title="Rename Project"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 font-mono">
                    <span>{p.total_scenes} slides</span>
                    <span>•</span>
                    <span>{p.total_duration ? `${p.total_duration.toFixed(1)}s` : 'Unrendered'}</span>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => onOpenProject(p.id)}
                    className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition-all active:scale-95"
                  >
                    <span>Open Studio</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicate(p.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Duplicate Project"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export History Section */}
      <div className="space-y-4">
        <h2 className="font-heading font-bold text-lg sm:text-xl text-white flex items-center gap-2">
          <span>Exported Videos History</span>
          <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {exports.length}
          </span>
        </h2>

        {exports.length === 0 ? (
          <div className="text-center py-10 border border-slate-800/80 rounded-2xl bg-slate-900/30 text-xs text-slate-500">
            No exported MP4 videos yet. Renders will appear here with direct download links.
          </div>
        ) : (
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="divide-y divide-slate-800/80">
              {exports.map(exp => (
                <div key={exp.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                      <Film className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-semibold text-white text-sm block">
                        {exp.filename}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                        <span>{exp.project_title || 'Video Reel'}</span>
                        <span>•</span>
                        <span>{exp.resolution}</span>
                        <span>•</span>
                        <span>{exp.duration_seconds.toFixed(1)}s</span>
                        <span>•</span>
                        <span>{(exp.file_size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                      </div>
                    </div>
                  </div>

                  {exp.download_url && (
                    <a
                      href={exp.download_url}
                      download
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-400" />
                      <span>Download MP4</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

