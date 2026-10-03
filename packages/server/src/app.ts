import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { FolderRepository } from './repositories/folderRepository.js';
import { MovieRepository } from './repositories/movieRepository.js';
import { ScanRunRepository } from './repositories/scanRunRepository.js';
import { SettingRepository } from './repositories/settingRepository.js';
import { WatchStateRepository } from './repositories/watchStateRepository.js';
import { ShelfRepository } from './repositories/shelfRepository.js';
import { ShelfMovieRepository } from './repositories/shelfMovieRepository.js';
import { MediaTrackRepository } from './repositories/mediaTrackRepository.js';
import { PlaybackProgressRepository } from './repositories/playbackProgressRepository.js';
import { AccessPinRepository } from './repositories/accessPinRepository.js';
import { AuthSessionRepository } from './repositories/authSessionRepository.js';
import { FolderService } from './services/folderService.js';
import { MetadataMatchService } from './services/metadataMatchService.js';
import { PlaybackService } from './services/playbackService.js';
import { PosterCacheService } from './services/posterCacheService.js';
import { ScanService } from './services/scanService.js';
import { SchedulerService } from './services/schedulerService.js';
import { ServerInfoService } from './services/serverInfoService.js';
import { SettingsService } from './services/settingsService.js';
import { StreamService } from './services/streamService.js';
import { LibraryService } from './services/libraryService.js';
import { ShelfService } from './services/shelfService.js';
import { MediaInfoService } from './services/mediaInfoService.js';
import { MediaProbeService } from './services/mediaProbeService.js';
import { PlaybackProgressService } from './services/playbackProgressService.js';
import { NextPlaybackService } from './services/nextPlaybackService.js';
import { registerNextPlaybackRoutes } from './routes/nextPlayback.js';
import { AccessPinService } from './services/accessPinService.js';
import { registerFolderRoutes } from './routes/folders.js';
import { registerLibraryRoutes } from './routes/library.js';
import { registerPlaybackRoutes } from './routes/playback.js';
import { registerPlaybackProgressRoutes } from './routes/playbackProgress.js';
import { registerScanRoutes } from './routes/scan.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerStreamRoutes } from './routes/stream.js';
import { registerShelfRoutes } from './routes/shelves.js';
import { registerTorrentRoutes } from './routes/torrents.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAuthGuard } from './routes/authGuard.js';
import { QbittorrentClient } from './providers/torrent/qbittorrentClient.js';
import { QbittorrentSearch } from './providers/torrent/qbittorrentSearch.js';
import { QbittorrentTorrents } from './providers/torrent/qbittorrentTorrents.js';
import { TorrentSearchService } from './services/torrentSearchService.js';
import { TorrentHandoffService } from './services/torrentHandoffService.js';
import { TorrentConnectionService } from './services/torrentConnectionService.js';
import { TorrentDownloadService } from './services/torrentDownloadService.js';
import { DownloadedSubtitleRepository } from './repositories/downloadedSubtitleRepository.js';
import { SubtitleLibraryService } from './services/subtitles/subtitleLibraryService.js';
import { SubtitleService } from './services/subtitles/subtitleService.js';
import { subtitleProviders } from './providers/subtitles/subtitleProviders.js';
import { registerSubtitleRoutes } from './routes/subtitles.js';

export function buildApp(db: Database.Database, appDataPath: string, port: number) {
  const app = Fastify({ logger: true, trustProxy: false });
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const text = typeof body === 'string' ? body : body.toString('utf8');
    if (!text.trim()) { done(null, {}); return; }
    try { done(null, JSON.parse(text)); } catch (error) { done(error as Error); }
  });
  const movies = new MovieRepository(db); const folders = new FolderRepository(db); const settings = new SettingRepository(db); const watches = new WatchStateRepository(db); const runs = new ScanRunRepository(db); const shelfRecords = new ShelfRepository(db); const shelfMovies = new ShelfMovieRepository(db); const mediaTracks = new MediaTrackRepository(db); runs.failAbandonedRuns();
  const metadata = new MetadataMatchService(movies, settings, new PosterCacheService(appDataPath), runs);
  const scanner = new ScanService(folders, movies, runs, settings, metadata, new MediaInfoService(movies, mediaTracks, new MediaProbeService())); const scheduler = new SchedulerService(settings, scanner); const pins = new AccessPinService(new AccessPinRepository(db), new AuthSessionRepository(db));
  const subtitleLibrary = new SubtitleLibraryService(new DownloadedSubtitleRepository(db), appDataPath, id => pins.streamQuery(id));
  const playback = new PlaybackService(movies, (id) => pins.streamQuery(id), subtitleLibrary);
  const library = new LibraryService(movies, shelfMovies, mediaTracks); const progressRecords = new PlaybackProgressRepository(db); const nextPlayback = new NextPlaybackService(movies, shelfMovies, progressRecords, watches); const progress = new PlaybackProgressService(progressRecords, watches, nextPlayback); const shelves = new ShelfService(shelfRecords, shelfMovies, movies, library);
  const qbittorrent = new QbittorrentClient(() => settings.get()); const qbittorrentSearch = new QbittorrentSearch(qbittorrent); const qbittorrentTorrents = new QbittorrentTorrents(qbittorrent); const torrentSearch = new TorrentSearchService(qbittorrentSearch, movies, () => qbittorrent.isConfigured()); const torrentHandoff = new TorrentHandoffService(qbittorrentTorrents, qbittorrent, settings); const torrentConnection = new TorrentConnectionService(qbittorrent, qbittorrentSearch); const torrentDownloads = new TorrentDownloadService(qbittorrentTorrents, settings);
  registerAuthGuard(app, pins); registerAuthRoutes(app, pins);
  registerLibraryRoutes(app, movies, progress, metadata, library); registerPlaybackProgressRoutes(app, movies, progress); registerNextPlaybackRoutes(app, nextPlayback, progress, library); registerShelfRoutes(app, shelves); registerFolderRoutes(app, new FolderService(folders, movies)); registerSettingsRoutes(app, new SettingsService(settings, scheduler));
  registerScanRoutes(app, scanner, runs); registerStreamRoutes(app, new StreamService(playback), playback); registerPlaybackRoutes(app, playback);
  registerTorrentRoutes(app, torrentSearch, torrentHandoff, torrentConnection, torrentDownloads, () => settings.get().torrentSearchEnabled);
  registerSubtitleRoutes(app, new SubtitleService(subtitleProviders(() => settings.get()), movies, settings, playback, subtitleLibrary));
  app.get('/api/server-info', async () => new ServerInfoService(port, () => pins.enabled()).get());
  app.register(fastifyStatic, { root: appDataPath, prefix: '/media/', decorateReply: false });
  const clientDist = join(process.cwd(), 'packages', 'client', 'dist');
  if (existsSync(clientDist)) {
    app.register(fastifyStatic, { root: clientDist, prefix: '/' });
    app.setNotFoundHandler((request, reply) => request.raw.url?.startsWith('/api/') ? reply.code(404).send({ error: 'Not found' }) : reply.sendFile('index.html'));
  }
  scheduler.refresh(); void metadata.startMissingMediaTypeBackfill(); app.addHook('onClose', () => scheduler.stop());
  app.setErrorHandler((error, _request, reply) => reply.code(400).send({ error: error instanceof Error ? error.message : 'Invalid request' }));
  return app;
}
