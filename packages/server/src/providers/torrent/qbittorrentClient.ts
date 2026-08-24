import type { Settings } from '@ottlib/shared';
import { externalRequestTimeoutMs } from '../../config/defaults.js';

export type QbittorrentErrorKind = 'not-configured' | 'unreachable' | 'login-rejected' | 'ip-banned' | 'request-failed';

export class QbittorrentError extends Error {
  public constructor(message: string, public readonly kind: QbittorrentErrorKind, public readonly status?: number) {
    super(message);
    this.name = 'QbittorrentError';
  }
}

type FetchImplementation = typeof fetch;

interface QbittorrentConfiguration {
  baseUrl: string;
  username: string;
  password: string;
}

export class QbittorrentClient {
  private sid: string | undefined;
  private sessionFingerprint: string | undefined;

  public constructor(private readonly getSettings: () => Settings, private readonly fetchImplementation: FetchImplementation = fetch) {}

  public isConfigured(): boolean {
    const settings = this.getSettings();
    return Boolean(settings.qbittorrentUrl.trim() && settings.qbittorrentUsername.trim() && settings.qbittorrentPassword);
  }

  public async get<T>(endpoint: string): Promise<T> { return this.request<T>('GET', endpoint); }
  public async postForm<T>(endpoint: string, values: Record<string, string | number | undefined>): Promise<T> {
    const body = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => { if (value !== undefined) body.set(key, String(value)); });
    return this.request<T>('POST', endpoint, body);
  }

  private async request<T>(method: 'GET' | 'POST', endpoint: string, body?: URLSearchParams): Promise<T> {
    const config = this.configuration();
    const fingerprint = `${config.baseUrl}\u0000${config.username}\u0000${config.password}`;
    if (this.sessionFingerprint !== fingerprint) { this.sid = undefined; this.sessionFingerprint = fingerprint; }
    if (!this.sid) await this.login(config);

    let response = await this.perform(method, endpoint, config, body);
    if (response.status === 403) {
      this.sid = undefined;
      await this.login(config);
      response = await this.perform(method, endpoint, config, body);
    }
    if (!response.ok) throw await this.requestError(response);
    return this.readPayload<T>(response);
  }

  private configuration(): QbittorrentConfiguration {
    const settings = this.getSettings();
    if (!this.isConfigured()) throw new QbittorrentError('qBittorrent is not configured. Add its URL, username, and password in Settings.', 'not-configured');
    let parsed: URL;
    try { parsed = new URL(settings.qbittorrentUrl.trim()); } catch { throw new QbittorrentError('qBittorrent URL must be a valid http or https URL.', 'not-configured'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new QbittorrentError('qBittorrent URL must use http or https.', 'not-configured');
    return { baseUrl: parsed.toString().replace(/\/+$/, ''), username: settings.qbittorrentUsername.trim(), password: settings.qbittorrentPassword };
  }

  private async login(config: QbittorrentConfiguration): Promise<void> {
    const form = new URLSearchParams({ username: config.username, password: config.password });
    const response = await this.perform('POST', 'auth/login', config, form, false);
    if (response.status === 403) throw new QbittorrentError('qBittorrent has temporarily banned this server IP after repeated failed login attempts. Wait before trying again.', 'ip-banned', 403);
    if (!response.ok) throw new QbittorrentError('qBittorrent rejected the username or password.', 'login-rejected', response.status);
    const setCookie = response.headers.get('set-cookie') ?? '';
    const sid = /(?:^|[,;\s])SID=([^;\s,]+)/.exec(setCookie)?.[1];
    if (!sid) {
      const responseBody = (await response.text()).trim();
      if (/^fails?\.?$/i.test(responseBody)) throw new QbittorrentError('qBittorrent rejected the WebUI username or password.', 'login-rejected');
      throw new QbittorrentError('qBittorrent did not return a session cookie. If the credentials work in its WebUI, check whether a reverse proxy is stripping Set-Cookie.', 'login-rejected');
    }
    this.sid = sid;
  }

  private async perform(method: 'GET' | 'POST', endpoint: string, config: QbittorrentConfiguration, body?: URLSearchParams, withSession = true): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), externalRequestTimeoutMs);
    try {
      // qBittorrent validates Referer against its WebUI host as a CSRF defense.
      const headers = new Headers({ Referer: config.baseUrl });
      if (withSession && this.sid) headers.set('Cookie', `SID=${this.sid}`);
      if (body) headers.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
      return await this.fetchImplementation(`${config.baseUrl}/api/v2/${endpoint.replace(/^\/+/, '')}`, { method, headers, body, signal: controller.signal });
    } catch (error) {
      const detail = error instanceof Error && error.name === 'AbortError' ? `did not respond within ${externalRequestTimeoutMs / 1000} seconds` : 'could not be reached';
      throw new QbittorrentError(`qBittorrent ${detail}. Check its URL and WebUI availability.`, 'unreachable');
    } finally { clearTimeout(timeout); }
  }

  private async readPayload<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text.trim()) return undefined as T;
    try { return JSON.parse(text) as T; } catch { return text as T; }
  }

  private async requestError(response: Response): Promise<QbittorrentError> {
    const text = (await response.text()).trim();
    return new QbittorrentError(text || `qBittorrent request failed (${response.status}).`, 'request-failed', response.status);
  }
}
