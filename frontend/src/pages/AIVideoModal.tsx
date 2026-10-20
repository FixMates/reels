import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clapperboard, Download, Loader2, X } from 'lucide-react';
import { AIVideoJob, api } from '../api/client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenProject: (projectId: string) => void;
  geminiConfigured: boolean;
}

export const AIVideoModal: React.FC<Props> = ({ isOpen, onClose, onOpenProject, geminiConfigured }) => {
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState('Curious general audience');
  const [language, setLanguage] = useState('English');
  const [style, setStyle] = useState('Clear, friendly, energetic educator');
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<AIVideoJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!jobId || job?.status === 'completed' || job?.status === 'failed') return;
    let active = true;
    const poll = async () => {
      try {
        const status = await api.getAIVideoStatus(jobId);
        if (active) setJob(status);
      } catch (err: any) {
        if (active) setError(err.message || 'Could not retrieve generation status');
      }
    };
    poll();
    const timer = window.setInterval(poll, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [jobId, job?.status]);

  if (!isOpen) return null;

  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null); setStarting(true);
    try {
      const response = await api.createAIVideo({ topic: topic.trim(), title: title.trim() || undefined, audience, language, style });
      setJobId(response.job_id);
      setJob({ job_id: response.job_id, status: 'running', progress_pct: 0, stage: 'queued', message: 'Starting the video workflow...' });
    } catch (err: any) {
      setError(err.message || 'Could not start generation');
    } finally { setStarting(false); }
  };

  const reset = () => { setJobId(null); setJob(null); setError(null); setTopic(''); setTitle(''); onClose(); };
  const label: Record<string, string> = { script: 'Writing script', images: 'Creating images', narration: 'Making narration', rendering: 'Rendering video', completed: 'Ready' };

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget && !jobId) reset(); }}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 p-5 sm:p-7 border-b border-slate-800">
          <div className="flex gap-3">
            <div className="w-11 h-11 rounded-2xl bg-fuchsia-500/15 text-fuchsia-300 flex items-center justify-center"><Clapperboard className="w-5 h-5" /></div>
            <div><h2 className="text-xl font-bold text-white">Create a Reel with Gemini</h2><p className="text-sm text-slate-400 mt-1">Topic to script, images, voiceover, and finished MP4.</p></div>
          </div>
          {!jobId && <button onClick={reset} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close"><X className="w-5 h-5" /></button>}
        </div>

        {!jobId ? <form onSubmit={start} className="p-5 sm:p-7 space-y-4">
          {!geminiConfigured && <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>Set <code>GEMINI_API_KEY</code> in your Render service Environment settings, then redeploy. Keep the key private and out of this form.</span></div>}
          <label className="block text-sm font-medium text-slate-200">Video topic <span className="text-rose-300">*</span><textarea required minLength={3} maxLength={500} rows={3} value={topic} onChange={e => setTopic(e.target.value)} placeholder="For example: why the sky changes color at sunset" className="mt-2 w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400" /></label>
          <label className="block text-sm font-medium text-slate-200">Video title <span className="text-slate-500">(optional)</span><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Let Gemini write one" className="mt-2 w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400" /></label>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block text-xs font-medium text-slate-300">Audience<input value={audience} onChange={e => setAudience(e.target.value)} className="mt-1.5 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs font-medium text-slate-300">Language<input value={language} onChange={e => setLanguage(e.target.value)} className="mt-1.5 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs font-medium text-slate-300">Voice and tone<input value={style} onChange={e => setStyle(e.target.value)} className="mt-1.5 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white" /></label>
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <div className="flex items-center justify-between gap-3 pt-2"><p className="text-xs text-slate-500">Generates 7 portrait images and one narrated video. Gemini API usage may incur charges.</p><button disabled={!geminiConfigured || starting || topic.trim().length < 3} className="shrink-0 px-4 py-2.5 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center gap-2">{starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clapperboard className="w-4 h-4" />}Create video</button></div>
        </form> : <div className="p-5 sm:p-7 space-y-5">
          {job?.status === 'completed' ? <>
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex gap-3"><CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" /><div><div className="font-semibold text-emerald-200">Your video is ready</div><div className="text-sm text-emerald-100/70 mt-1">{job.video_title || topic} {job.video_duration ? `· ${job.video_duration.toFixed(1)} seconds` : ''}</div></div></div>
            {job.content_package?.video_description && <p className="text-sm text-slate-300 leading-relaxed">{job.content_package.video_description}</p>}
            {job.content_package?.hashtags?.length ? <p className="text-xs text-sky-300">{job.content_package.hashtags.join(' ')}</p> : null}
            {job.content_package?.sources?.length ? <div className="text-xs text-slate-400">Sources: {job.content_package.sources.map((source, i) => <React.Fragment key={source.url}>{i > 0 ? ' · ' : ''}<a className="text-sky-300 hover:underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a></React.Fragment>)}</div> : null}
            <div className="flex flex-wrap gap-3 pt-1">{job.download_url && <a href={job.download_url} download className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm flex items-center gap-2"><Download className="w-4 h-4" />Download MP4</a>}{job.project_id && <button onClick={() => { onOpenProject(job.project_id!); reset(); }} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-sm flex items-center gap-2">Edit in studio<ArrowRight className="w-4 h-4" /></button>}<button onClick={reset} className="px-4 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 text-sm">Close</button></div>
          </> : job?.status === 'failed' ? <>
            <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-200"><div className="font-semibold">Generation stopped</div><p className="text-sm mt-1">{job.error || job.message}</p></div>
            {job.project_id && <button onClick={() => { onOpenProject(job.project_id!); reset(); }} className="px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm">Open partially generated project</button>}
            <button onClick={() => { setJobId(null); setJob(null); }} className="px-4 py-2.5 rounded-xl bg-fuchsia-500 text-white text-sm">Try again</button>
          </> : <>
            <div className="flex justify-between text-sm"><span className="text-white flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-fuchsia-300" />{label[job?.stage || ''] || 'Preparing'}</span><span className="text-slate-400">{job?.progress_pct || 0}%</span></div>
            <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-sky-400 transition-all duration-500" style={{ width: `${Math.max(3, job?.progress_pct || 0)}%` }} /></div>
            <p className="text-sm text-slate-300">{job?.message || 'Gemini is preparing your video...'}</p>
            <p className="text-xs text-slate-500">This may take several minutes while the images, narration, and video are generated. Keep this page open.</p>
            {error && <p className="text-xs text-amber-300">Still waiting for job status: {error}</p>}
          </>}
        </div>}
      </div>
    </div>
  );
};
