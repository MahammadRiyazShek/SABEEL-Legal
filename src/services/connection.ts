export interface ConnectionSettings { backendUrl: string; model: string }
export interface BackendHealth { status: string; service: string; geminiConfigured: boolean; whatsappConfigured: boolean; webhookSignatureConfigured: boolean; whatsappVerifyConfigured?: boolean; model?: string }
const KEY = 'drivegenie_connections_v1';
export function normalizeBackend(value: string): string {
  if (!value.trim()) return '';
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Use an HTTPS backend URL (HTTP is allowed only for localhost).');
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('Enter the backend origin only, such as https://your-service.run.app, without /api, credentials or query parameters.');
  if (url.hostname.endsWith('.github.io')) throw new Error('GitHub Pages cannot run your backend. Enter your Cloud Run or other API server URL.');
  return url.origin;
}
export function readSettings(): ConnectionSettings {
  try { return {backendUrl:'', model:'gemini-2.5-flash', ...JSON.parse(localStorage.getItem(KEY) || '{}')}; } catch { return {backendUrl:'',model:'gemini-2.5-flash'}; }
}
export function saveSettings(settings: ConnectionSettings) {
  const backendUrl = normalizeBackend(settings.backendUrl);
  if (!/^[a-zA-Z0-9._-]+$/.test(settings.model)) throw new Error('Invalid Gemini model name.');
  localStorage.setItem(KEY, JSON.stringify({...settings,backendUrl}));
  window.dispatchEvent(new Event('connections-changed'));
}
export function backendOrigin(): string {
  const explicit = readSettings().backendUrl;
  if (explicit) return normalizeBackend(explicit);
  return location.hostname.endsWith('.github.io') ? '' : location.origin;
}
export async function apiRequest(path: string, init: RequestInit = {}): Promise<any> {
  const origin = backendOrigin();
  if (!origin) throw new Error('No backend connected. Open Connections and enter your deployed API URL, or use a personal Gemini key for browser chat.');
  const headers = new Headers(init.headers);
  const token = sessionStorage.getItem('assistant_dashboard_token');
  if (token) headers.set('X-Assistant-Token', token);
  const response = await fetch(origin + path, {...init,headers,signal:init.signal || AbortSignal.timeout(90000)});
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error('The URL returned a web page, not the assistant API. Check the backend URL.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}
export async function checkBackend(): Promise<BackendHealth> {
  const data = await apiRequest('/api/health', {signal:AbortSignal.timeout(12000)});
  if (data.service !== 'whatsapp-ai-drive-assistant' || data.status !== 'healthy') throw new Error('The server is not a compatible DriveGenie backend.');
  return data;
}
export function personalKey(): string { try { return sessionStorage.getItem('assistant_custom_gemini_key') || ''; } catch { return ''; } }
