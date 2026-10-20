import { Project, Scene, TTSVoice, RenderStatus, SystemHealth, ExportRecord } from '../types/project';

const configuredApiBase = String((import.meta as any).env?.VITE_API_BASE || '').replace(/\/$/, '');
const API_BASE = configuredApiBase || '/api';
const API_ORIGIN = configuredApiBase.replace(/\/api$/, '');

function normalizeApiUrls<T>(value: T): T {
  if (!API_ORIGIN) return value;
  if (typeof value === 'string') return (value.startsWith('/api/') ? `${API_ORIGIN}${value}` : value) as T;
  if (Array.isArray(value)) return value.map(normalizeApiUrls) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeApiUrls(item)])) as T;
  }
  return value;
}

async function parseResponse<T>(response: Response): Promise<T> {
  return normalizeApiUrls(await response.json() as T);
}

export interface AIVideoJob {
  job_id: string;
  status: 'running' | 'completed' | 'failed';
  progress_pct: number;
  stage: string;
  message: string;
  project_id?: string | null;
  video_title?: string;
  video_duration?: number;
  download_url?: string | null;
  error?: string | null;
  content_package?: { video_description?: string; hashtags?: string[]; sources?: Array<{ title: string; url: string }> };
}

export const api = {
  async createAIVideo(data: { topic: string; title?: string; audience: string; language: string; style: string }): Promise<{ ok: boolean; job_id: string }> {
    const res = await fetch(`${API_BASE}/ai-video/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not start AI video generation');
    }
    return parseResponse(res);
  },

  async getAIVideoStatus(jobId: string): Promise<AIVideoJob> {
    const res = await fetch(`${API_BASE}/ai-video/status/${jobId}`);
    if (!res.ok) throw new Error('Could not retrieve AI video progress');
    return parseResponse(res);
  },

  // System Health
  async getSystemHealth(): Promise<SystemHealth> {
    const res = await fetch(`${API_BASE}/system/health`);
    if (!res.ok) throw new Error('Failed to fetch system health');
    return parseResponse(res);
  },

  async clearTempFiles(): Promise<{ ok: boolean; bytes_freed: number; mb_freed: number }> {
    const res = await fetch(`${API_BASE}/system/clear-temp`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to clear temporary files');
    return parseResponse(res);
  },

  // Projects CRUD
  async getProjects(): Promise<Project[]> {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    return parseResponse(res);
  },

  async getProject(id: string): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects/${id}`);
    if (!res.ok) throw new Error('Project not found');
    return parseResponse(res);
  },

  async createProject(data: Partial<Project>): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create project');
    return parseResponse(res);
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update project');
    return parseResponse(res);
  },

  async duplicateProject(id: string): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects/${id}/duplicate`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to duplicate project');
    return parseResponse(res);
  },

  async deleteProject(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete project');
    return true;
  },

  async reorderScenes(projectId: string, sceneIds: string[]): Promise<boolean> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/reorder-scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_ids: sceneIds })
    });
    if (!res.ok) throw new Error('Failed to reorder scenes');
    return true;
  },

  // Scenes
  async updateScene(sceneId: string, updates: Partial<Scene>): Promise<Scene> {
    const res = await fetch(`${API_BASE}/scenes/${sceneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update scene');
    return parseResponse(res);
  },

  async duplicateScene(sceneId: string): Promise<Scene> {
    const res = await fetch(`${API_BASE}/scenes/${sceneId}/duplicate`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to duplicate scene');
    return parseResponse(res);
  },

  async deleteScene(sceneId: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/scenes/${sceneId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete scene');
    return true;
  },

  // Media Uploads
  async uploadPDF(projectId: string, file: File): Promise<{ ok: boolean; scenes: Scene[]; pages_imported: number }> {
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/media/upload-pdf`, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload PDF');
    }
    return parseResponse(res);
  },

  async uploadImages(projectId: string, files: File[]): Promise<{ ok: boolean; scenes: Scene[]; images_imported: number }> {
    const formData = new FormData();
    formData.append('project_id', projectId);
    files.forEach(f => formData.append('files', f));
    const res = await fetch(`${API_BASE}/media/upload-images`, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload images');
    }
    return parseResponse(res);
  },

  async uploadLogo(projectId: string, file: File): Promise<{ ok: boolean; logo_url: string }> {
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/media/upload-logo`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to upload logo');
    return parseResponse(res);
  },

  async uploadBGM(file: File): Promise<{ ok: boolean; filename: string; duration: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/media/upload-bgm`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to upload background music');
    return parseResponse(res);
  },

  async listBGM(): Promise<{ filename: string; duration: number; url: string }[]> {
    const res = await fetch(`${API_BASE}/media/bgm-list`);
    if (!res.ok) throw new Error('Failed to list BGM');
    return parseResponse(res);
  },

  async uploadAudioOverride(sceneId: string, file: File): Promise<{ ok: boolean; scene: Scene }> {
    const formData = new FormData();
    formData.append('scene_id', sceneId);
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/media/upload-audio-override`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to upload custom audio');
    return parseResponse(res);
  },

  // TTS
  async listVoices(): Promise<TTSVoice[]> {
    const res = await fetch(`${API_BASE}/tts/voices`);
    if (!res.ok) throw new Error('Failed to discover TTS voices');
    return parseResponse(res);
  },

  async previewTTS(data: { text: string; engine?: string; voice_id?: string; rate?: number; volume?: number }): Promise<{ ok: boolean; duration: number; audio_url: string }> {
    const res = await fetch(`${API_BASE}/tts/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to synthesize preview audio');
    }
    return parseResponse(res);
  },

  async generateSceneVoice(sceneId: string, voiceId?: string, rate?: number, volume?: number, voiceEngine?: string): Promise<{ ok: boolean; scene: Scene; audio_url: string; duration: number }> {
    const res = await fetch(`${API_BASE}/tts/generate-scene`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId, voice_id: voiceId, rate, volume, voice_engine: voiceEngine })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'TTS generation failed');
    }
    return parseResponse(res);
  },

  async generateAllVoices(projectId: string): Promise<{ ok: boolean; generated_count: number; failed_count: number; failures: Array<{ scene_id: string; error: string }> }> {
    const res = await fetch(`${API_BASE}/tts/generate-all/${projectId}`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to generate voices for project');
    }
    return parseResponse(res);
  },

  // Rendering
  async triggerRender(projectId: string, options?: any): Promise<{ ok: boolean; job_id: string }> {
    const res = await fetch(`${API_BASE}/render/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {})
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to trigger render');
    }
    return parseResponse(res);
  },

  async getRenderStatus(jobId: string): Promise<RenderStatus> {
    const res = await fetch(`${API_BASE}/render/status/${jobId}`);
    if (!res.ok) throw new Error('Failed to get render status');
    return parseResponse(res);
  },

  async cancelRender(jobId: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/render/cancel/${jobId}`, { method: 'POST' });
    return res.ok;
  },

  async getExports(): Promise<ExportRecord[]> {
    const res = await fetch(`${API_BASE}/exports`);
    if (!res.ok) throw new Error('Failed to fetch exports history');
    return parseResponse(res);
  }
};
