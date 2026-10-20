import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Trash2, Cpu, HardDrive, Volume2, RefreshCw } from 'lucide-react';
import { SystemHealth } from '../types/project';
import { api } from '../api/client';

interface SystemHealthModalProps {
  health: SystemHealth | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const SystemHealthModal: React.FC<SystemHealthModalProps> = ({
  health,
  isOpen,
  onClose,
  onRefresh
}) => {
  const [clearing, setClearing] = useState(false);
  const [clearedMsg, setClearedMsg] = useState<string | null>(null);

  if (!isOpen || !health) return null;

  const handleClearTemp = async () => {
    try {
      setClearing(true);
      const res = await api.clearTempFiles();
      setClearedMsg(`Cleaned ${res.mb_freed} MB of temporary files!`);
      onRefresh();
      setTimeout(() => setClearedMsg(null), 4000);
    } catch (e: any) {
      alert(`Error cleaning temp files: ${e.message}`);
    } finally {
      setClearing(false);
    }
  };

  const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-sky-400" />
            <h3 className="font-heading font-bold text-lg text-white">System Diagnostics & Storage</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-sm">
          {/* FFmpeg Engine Status */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-3">
            {health.ffmpeg.ffmpeg_available ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">FFmpeg & FFprobe Acceleration</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${health.ffmpeg.ffmpeg_available ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                  {health.ffmpeg.ffmpeg_available ? 'Available' : 'Missing'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 truncate">
                {health.ffmpeg.version}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono truncate">
                Path: {health.ffmpeg.ffmpeg_path || 'Not detected'}
              </p>
            </div>
          </div>

          {/* Local TTS Engines */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-3">
            <Volume2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Text-to-Speech Engines</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${health.tts.voices_count ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                  {health.tts.voices_count ? `${health.tts.voices_count} voices ready` : 'Unavailable'}
                </span>
              </div>
              <div className="text-xs text-slate-300 mt-2 space-y-1">
                {health.tts.sapi_available && <div className="flex items-center justify-between"><span>Windows SAPI:</span><span className="text-emerald-400 font-medium">Ready</span></div>}
                <div className="flex items-center justify-between">
                  <span>eSpeak NG (Linux / Render):</span>
                  <span className={health.tts.espeak_available ? "text-emerald-400 font-medium" : "text-slate-400"}>
                    {health.tts.espeak_available ? "Ready" : "Not installed"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Piper Neural TTS (ONNX Engine):</span>
                  <span className={health.tts.piper_available ? "text-emerald-400 font-medium" : "text-slate-400"}>
                    {health.tts.piper_available ? "Ready" : "Models Optional"}
                  </span>
                </div>
                {!health.tts.voices_count && <p className="pt-2 text-rose-200">Install a speech engine in the server image, then redeploy. eSpeak NG is included in the Render Docker setup.</p>}
              </div>
            </div>
          </div>

          {/* Storage Usage */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-purple-400" />
                Local Disk Storage
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Total: {formatMB(health.storage.total_storage_bytes)} MB
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Exports</span>
                <span className="font-semibold text-white mt-1 block">
                  {formatMB(health.storage.exports_storage_bytes)} MB
                </span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[11px]">TTS Cache</span>
                <span className="font-semibold text-white mt-1 block">
                  {formatMB(health.storage.cache_storage_bytes)} MB
                </span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Temp Renders</span>
                <span className="font-semibold text-white mt-1 block">
                  {formatMB(health.storage.temp_storage_bytes)} MB
                </span>
              </div>
            </div>

            {clearedMsg && (
              <div className="mt-3 p-2 text-xs bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 text-center">
                {clearedMsg}
              </div>
            )}

            <button
              onClick={handleClearTemp}
              disabled={clearing}
              className="mt-4 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-amber-400" />
              {clearing ? 'Clearing Temp Files...' : 'Clear Temporary Work Files'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Python {health.platform.python_version} on {health.platform.os}</span>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
