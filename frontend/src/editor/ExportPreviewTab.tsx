import React, { useState, useEffect } from 'react';
import { Film, Download, Play, RefreshCw, XCircle, CheckCircle2, AlertTriangle, FileText, Sparkles } from 'lucide-react';
import { Project, RenderStatus } from '../types/project';
import { api } from '../api/client';

interface ExportPreviewTabProps {
  project: Project;
  onProjectUpdate: (p: Project) => void;
}

export const ExportPreviewTab: React.FC<ExportPreviewTabProps> = ({
  project,
  onProjectUpdate
}) => {
  const [isRendering, setIsRendering] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [qualityPreset, setQualityPreset] = useState('veryfast');
  const [crf, setCrf] = useState(21);
  const [latestVideoUrl, setLatestVideoUrl] = useState<string | null>(null);

  // Poll for render status when jobId is active
  useEffect(() => {
    if (!jobId || !isRendering) return;

    const interval = setInterval(async () => {
      try {
        const st = await api.getRenderStatus(jobId);
        setRenderStatus(st);

        if (st.status === 'completed') {
          setIsRendering(false);
          if (st.download_url) {
            setLatestVideoUrl(st.download_url);
          }
          clearInterval(interval);
        } else if (st.status === 'failed' || st.status === 'cancelled') {
          setIsRendering(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error polling render status:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId, isRendering]);

  const handleStartRender = async () => {
    try {
      setIsRendering(true);
      setRenderStatus(null);
      const res = await api.triggerRender(project.id, {
        burn_subtitles: project.subtitle_style?.burn_in ?? true,
        quality_preset: qualityPreset,
        crf: crf
      });
      setJobId(res.job_id);
    } catch (err: any) {
      setIsRendering(false);
      alert(`Failed to start render: ${err.message}`);
    }
  };

  const handleCancelRender = async () => {
    if (!jobId) return;
    await api.cancelRender(jobId);
    setIsRendering(false);
  };

  const activeScenesCount = project.scenes.filter(s => s.is_included).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div>
          <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
            <Film className="w-5 h-5 text-sky-400" />
            <span>Video Render & Final Export</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Export a high-definition H.264/AAC MP4 optimized for Instagram Reels and YouTube Shorts.
          </p>
        </div>

        <button
          onClick={handleStartRender}
          disabled={isRendering || activeScenesCount === 0}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-400 hover:to-indigo-500 text-white font-heading font-bold text-sm flex items-center gap-2.5 shadow-xl shadow-sky-500/25 transition-all active:scale-95 disabled:opacity-50"
        >
          {isRendering ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Rendering Video ({renderStatus?.progress_pct || 0}%)...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Render MP4 Reel Now</span>
            </>
          )}
        </button>
      </div>

      {/* Progress Box if Rendering */}
      {isRendering && renderStatus && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-sky-500/40 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
              <div>
                <span className="font-heading font-bold text-white text-base capitalize">
                  {renderStatus.stage.replace('_', ' ')}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  {renderStatus.message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-mono text-xl font-bold text-sky-400">
                {renderStatus.progress_pct}%
              </span>
              <button
                onClick={handleCancelRender}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold border border-red-500/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              style={{ width: `${renderStatus.progress_pct}%` }}
              className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-300 shadow-sm"
            />
          </div>
        </div>
      )}

      {/* Render Failure Notice */}
      {renderStatus?.status === 'failed' && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
          <div>
            <span className="font-semibold text-sm block">Render Encountered an Error</span>
            <span className="block mt-1 font-mono">{renderStatus.error}</span>
          </div>
        </div>
      )}

      {/* Video Preview Player & Download */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Player */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-sm aspect-[9/16] relative rounded-3xl overflow-hidden border-2 border-slate-800 bg-black shadow-2xl flex items-center justify-center">
            {latestVideoUrl ? (
              <video
                src={latestVideoUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="p-6 text-center text-slate-500 flex flex-col items-center">
                <Film className="w-12 h-12 text-slate-700 mb-3" />
                <span className="text-xs">No rendered video available yet. Click "Render MP4 Reel Now" to compile.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Export Details and Options */}
        <div className="lg:col-span-7 space-y-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <span className="font-heading font-bold text-white text-base block">
            Export Specifications
          </span>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Resolution & Aspect</span>
              <span className="font-mono text-white font-bold text-sm mt-1 block">
                {project.width} × {project.height} ({project.aspect_ratio})
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Frame Rate & Codec</span>
              <span className="font-mono text-white font-bold text-sm mt-1 block">
                {project.fps} FPS / H.264 + AAC
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Active Slide Count</span>
              <span className="font-mono text-white font-bold text-sm mt-1 block">
                {activeScenesCount} Slides
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Estimated Video Duration</span>
              <span className="font-mono text-sky-400 font-bold text-sm mt-1 block">
                {project.total_duration.toFixed(1)} Seconds
              </span>
            </div>
          </div>

          {/* Preset Quality Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Encoding Speed & Quality</label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { id: 'ultrafast', label: 'Ultra Fast', desc: 'Instant preview speed' },
                { id: 'veryfast', label: 'Balanced (Recommended)', desc: 'High quality & fast' },
                { id: 'medium', label: 'Maximum Quality', desc: 'Smaller file size' },
              ].map(q => (
                <button
                  key={q.id}
                  onClick={() => setQualityPreset(q.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    qualityPreset === q.id
                      ? 'border-sky-500 bg-sky-500/10 text-white font-semibold'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block text-xs font-semibold">{q.label}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">{q.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Completed Video Actions */}
          {latestVideoUrl && (
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Video compiled and validated successfully!</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={latestVideoUrl}
                  download
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Download MP4 Video</span>
                </a>

                {renderStatus?.output_filename && (
                  <>
                    <a
                      href={`/api/exports/download/${renderStatus.output_filename.replace('.mp4', '.srt')}`}
                      download
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Download SRT</span>
                    </a>

                    <a
                      href={`/api/exports/download/${renderStatus.output_filename.replace('.mp4', '.vtt')}`}
                      download
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Download VTT</span>
                    </a>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
