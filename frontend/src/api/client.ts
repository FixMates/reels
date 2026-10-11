import { Project, Scene, TTSVoice, RenderStatus, SystemHealth, ExportRecord } from '../types/project';

const API_BASE = '/api';

export const api = {
  // System Health
  async getSystemHealth(): Promise<SystemHealth> {
    const res = await fetch(`${API_BASE}/system/health`);
    if (!res.ok) throw new Error('Failed to fetch system health');
    return res.json();
  },

  async clearTempFiles(): Promise<{ ok: boolean; bytes_freed: number; mb_freed: number }> {
    const res = await fetch(`${API_BASE}/system/clear-temp`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to clear temporary files');
    return res.json();
  },

  // Projects CRUD
  async getProjects(): Promise<Project[]> {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  async getProject(id: string): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects/${id}`);
    if (!res.ok) throw new Error('Project not found');
    return res.json();
  },

  async createProject(data: Partial<Project>): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create project');
    return res.json();
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update project');
    return res.json();
  },

  async duplicateProject(id: string): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects/${id}/duplicate`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to duplicate project');
    return res.json();
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
    return res.json();
  },

  async duplicateScene(sceneId: string): Promise<Scene> {
    const res = await fetch(`${API_BASE}/scenes/${sceneId}/duplicate`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to duplicate scene');
    return res.json();
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
    return res.json();
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
    return res.json();
  },

  async uploadLogo(projectId: string, file: File): Promise<{ ok: boolean; logo_url: string }> {
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/media/upload-logo`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to upload logo');
    return res.json();
  },

  async uploadBGM(file: File): Promise<{ ok: boolean; filename: string; duration: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/media/upload-bgm`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to upload background music');
    return res.json();
  },

  async listBGM(): Promise<{ filename: string; duration: number; url: string }[]> {
    const res = await fetch(`${API_BASE}/media/bgm-list`);
    if (!res.ok) throw new Error('Failed to list BGM');
    return res.json();
  },

  async uploadAudioOverride(sceneId: string, file: File): Promise<{ ok: boolean; scene: Scene }> {
    const formData = new FormData();
    formData.append('scene_id', sceneId);
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/media/upload-audio-override`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to upload custom audio');
    return res.json();
  },

  // TTS
  async listVoices(): Promise<TTSVoice[]> {
    const res = await fetch(`${API_BASE}/tts/voices`);
    if (!res.ok) throw new Error('Failed to discover TTS voices');
    return res.json();
  },

  async previewTTS(data: { text: string; engine?: string; voice_id?: string; rate?: number; volume?: number }): Promise<{ ok: boolean; duration: number; audio_url: string }> {
    const res = await fetch(`${API_BASE}/tts/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to synthesize preview audio');
    return res.json();
  },

  async generateSceneVoice(sceneId: string, voiceId?: string, rate?: number, volume?: number): Promise<{ ok: boolean; scene: Scene; audio_url: string; duration: number }> {
    const res = await fetch(`${API_BASE}/tts/generate-scene`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId, voice_id: voiceId, rate, volume })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'TTS generation failed');
    }
    return res.json();
  },

  async generateAllVoices(projectId: string): Promise<{ ok: boolean; generated_count: number }> {
    const res = await fetch(`${API_BASE}/tts/generate-all/${projectId}`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to generate voices for project');
    return res.json();
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
    return res.json();
  },

  async getRenderStatus(jobId: string): Promise<RenderStatus> {
    const res = await fetch(`${API_BASE}/render/status/${jobId}`);
    if (!res.ok) throw new Error('Failed to get render status');
    return res.json();
  },

  async cancelRender(jobId: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/render/cancel/${jobId}`, { method: 'POST' });
    return res.ok;
  },

  async getExports(): Promise<ExportRecord[]> {
    const res = await fetch(`${API_BASE}/exports`);
    if (!res.ok) throw new Error('Failed to fetch exports history');
    return res.json();
  }
};
