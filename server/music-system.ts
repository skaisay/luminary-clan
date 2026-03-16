import { Client, TextChannel, VoiceBasedChannel, Guild, GuildMember } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
  entersState,
  StreamType,
  NoSubscriberBehavior,
  AudioPlayer,
  VoiceConnection,
} from '@discordjs/voice';
import play from 'play-dl';
import { spawn, execSync } from 'child_process';

// ========= FFmpeg detection =========
let ffmpegPath: string | null = null;
try {
  const systemFfmpeg = execSync('which ffmpeg 2>/dev/null || where ffmpeg 2>nul', { encoding: 'utf8' }).trim();
  if (systemFfmpeg) {
    ffmpegPath = systemFfmpeg;
    console.log('✅ Системный FFmpeg найден:', systemFfmpeg);
  }
} catch {
  // Системный FFmpeg не найден
}

if (!ffmpegPath) {
  (async () => {
    try {
      const ffmpegStatic = (await import('ffmpeg-static') as any);
      const ffmpegBin: string | null = ffmpegStatic.default ?? ffmpegStatic;
      if (ffmpegBin) {
        ffmpegPath = ffmpegBin;
        process.env.FFMPEG_PATH = ffmpegBin;
        console.log('✅ ffmpeg-static найден:', ffmpegBin);
      }
    } catch {
      console.log('⚠️ FFmpeg не найден! Музыка может не работать.');
    }
  })();
}

// ========= Типы =========
interface Song {
  title: string;
  url: string;
  duration: string;       // formatted: "3:45"
  durationSec: number;    // seconds
  thumbnail?: string;
  requestedBy: string;
}

interface GuildQueue {
  songs: Song[];
  player: AudioPlayer;
  connection: VoiceConnection | null;
  guildId: string;
  textChannel: TextChannel | null;
  volume: number;
  loopMode: number;  // 0 = off, 1 = song, 2 = queue
  isPlaying: boolean;
  isPaused: boolean;
  playStartedAt: number;      // timestamp when current song started playing
  currentStrategy: string;    // which strategy is currently playing
  streamRetryCount: number;   // how many times we retried the current song due to premature end
  isJumping: boolean;         // flag to prevent handleNextSong during jump
}

// ========= Strategy Cache =========
// Remember which strategy worked last to try it first next time
let lastSuccessfulStrategy: string = ''; // 'soundcloud', 'piped', 'invidious', 'cobalt', 'play-dl', 'yt-dlp'
let strategySuccessCount: Record<string, number> = {};

// ========= Loading Status =========
interface LoadingStatus {
  state: 'idle' | 'resolving' | 'connecting' | 'streaming' | 'playing' | 'error';
  progress: number;    // 0-100
  message: string;
  songTitle?: string;
  errorDetail?: string;
  timestamp: number;
}

// ========= Debug Log Ring Buffer =========
const MAX_LOG_ENTRIES = 100;
const debugLogs: { time: string; msg: string }[] = [];
function musicLog(msg: string) {
  const time = new Date().toISOString().substring(11, 23);
  debugLogs.push({ time, msg });
  if (debugLogs.length > MAX_LOG_ENTRIES) debugLogs.shift();
  console.log(`[Music] ${msg}`);
}
export function getDebugLogs(): { time: string; msg: string }[] {
  return [...debugLogs];
}

// ========= State =========
const queues = new Map<string, GuildQueue>();
const loadingStatuses = new Map<string, LoadingStatus>();
let botClient: Client | null = null;

function setLoadingStatus(guildId: string, state: LoadingStatus['state'], progress: number, message: string, extra?: Partial<LoadingStatus>) {
  const status: LoadingStatus = { state, progress, message, timestamp: Date.now(), ...extra };
  loadingStatuses.set(guildId, status);
  console.log(`[Music Loading] ${guildId}: ${state} ${progress}% - ${message}`);
}

export function getLoadingStatus(guildId: string): LoadingStatus {
  return loadingStatuses.get(guildId) || { state: 'idle', progress: 0, message: '', timestamp: Date.now() };
}

// ========= Helpers =========

/** Wraps a promise with a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Таймаут ${label} (${ms / 1000}с)`)), ms)
    ),
  ]);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getOrCreateQueue(guildId: string): GuildQueue {
  let q = queues.get(guildId);
  if (!q) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });
    q = {
      songs: [],
      player,
      connection: null,
      guildId,
      textChannel: null,
      volume: 100,
      loopMode: 0,
      isPlaying: false,
      isPaused: false,
      playStartedAt: 0,
      currentStrategy: '',
      streamRetryCount: 0,
      isJumping: false,
    };

    // Когда трек закончился — переходим к следующему
    player.on(AudioPlayerStatus.Idle, () => {
      const gq = queues.get(guildId);
      const playDur = gq?.playStartedAt ? ((Date.now() - gq.playStartedAt) / 1000).toFixed(1) : '?';
      musicLog(`Player → Idle (played ${playDur}s) guild=${guildId}`);
      handleNextSong(guildId);
    });

    player.on('error', (error) => {
      musicLog(`Player ERROR guild=${guildId}: ${error.message}`);
      const gq = queues.get(guildId);
      if (gq?.textChannel) {
        gq.textChannel.send(`❌ Ошибка воспроизведения: ${error.message.substring(0, 200)}`).catch(() => {});
      }
      handleNextSong(guildId);
    });

    // Log all player state transitions
    player.on('stateChange', (oldState, newState) => {
      musicLog(`Player: ${oldState.status} → ${newState.status} guild=${guildId}`);
    });

    queues.set(guildId, q);
  }
  return q;
}

async function handleNextSong(guildId: string) {
  const q = queues.get(guildId);
  if (!q) return;

  // If we're in a jump operation, ignore this Idle event
  if (q.isJumping) {
    musicLog(`handleNextSong: skipping (isJumping=true) guild=${guildId}`);
    q.isJumping = false;
    return;
  }

  const currentSong = q.songs[0];
  const playDuration = q.playStartedAt > 0 ? (Date.now() - q.playStartedAt) / 1000 : 0;

  // Detect premature stream end: if song played < 10 seconds, the stream likely died
  const MIN_PLAY_SECONDS = 10;
  if (currentSong && playDuration > 0 && playDuration < MIN_PLAY_SECONDS && q.streamRetryCount < 2) {
    q.streamRetryCount++;
    musicLog(`⚠️ Stream died after ${playDuration.toFixed(1)}s for "${currentSong.title}" (retry ${q.streamRetryCount}/2)`);
    setLoadingStatus(guildId, 'streaming', 50, `Поток прервался (${playDuration.toFixed(0)}с), повтор ${q.streamRetryCount}/2...`, { songTitle: currentSong.title });
    
    // Wait a bit before retrying
    await new Promise(r => setTimeout(r, 2000));
    await playSong(guildId);
    return;
  }

  if (currentSong && playDuration > 0 && playDuration < MIN_PLAY_SECONDS) {
    musicLog(`❌ Stream died after ${playDuration.toFixed(1)}s for "${currentSong.title}" — no more retries`);
    setLoadingStatus(guildId, 'error', 0, `Поток прервался через ${playDuration.toFixed(0)}с — не удалось воспроизвести`, { 
      songTitle: currentSong.title, 
      errorDetail: `Stream died after ${playDuration.toFixed(1)}s via ${q.currentStrategy}. Retried ${q.streamRetryCount} times.` 
    });
  }

  // Reset retry state for next song
  q.playStartedAt = 0;
  q.streamRetryCount = 0;
  q.currentStrategy = '';

  // Loop modes
  if (q.loopMode === 1 && q.songs.length > 0) {
    await playSong(guildId);
    return;
  }

  if (q.loopMode === 2 && q.songs.length > 0) {
    const current = q.songs.shift()!;
    q.songs.push(current);
    await playSong(guildId);
    return;
  }

  // Normal — remove current, play next
  q.songs.shift();
  if (q.songs.length > 0) {
    await playSong(guildId);
  } else {
    q.isPlaying = false;
    musicLog('Queue empty, stopping playback');
    if (q.textChannel) {
      q.textChannel.send('✅ Очередь завершена!').catch(() => {});
    }
    setTimeout(() => {
      const gq = queues.get(guildId);
      if (gq && gq.songs.length === 0) {
        destroyQueue(guildId);
      }
    }, 30000);
  }
}

// ========= URL Cleaning =========
/** Clean YouTube URLs: strip tracking params, normalize format */
function cleanYouTubeUrl(url: string): string {
  try {
    // Handle youtu.be short links
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return `https://www.youtube.com/watch?v=${shortMatch[1]}`;
    
    // Handle full YouTube URLs — strip tracking params
    const longMatch = url.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/);
    if (longMatch) return `https://www.youtube.com/watch?v=${longMatch[1]}`;
    
    return url;
  } catch { return url; }
}

// ========= SoundCloud Fallback Strategy =========
/**
 * Search SoundCloud for a song by title and stream it.
 * SoundCloud doesn't block cloud datacenter IPs like YouTube does.
 */
let scInitialized = false;
async function ensureSoundCloudInit() {
  if (scInitialized) return;
  try {
    const clientId = await play.getFreeClientID();
    if (clientId) {
      await play.setToken({ soundcloud: { client_id: clientId } });
      scInitialized = true;
      musicLog('SoundCloud client_id initialized');
    }
  } catch (err: any) {
    musicLog(`SoundCloud init error: ${err.message}`);
  }
}

/** Clean a title for SoundCloud search: remove special chars, pipe separators, excessive words */
function cleanTitleForSearch(title: string): string {
  // Remove common noise: pipe separators, brackets, special suffixes
  let cleaned = title
    .replace(/\s*[|｜]\s*/g, ' ')           // pipe separators
    .replace(/\[.*?\]/g, '')                 // [brackets]
    .replace(/\(.*?\)/g, '')                 // (parentheses) 
    .replace(/【.*?】/g, '')                   // 【japanese brackets】
    .replace(/\s*(official\s*(video|audio|lyric|music\s*video)|lyrics?|hd|hq|mv|m\/v|full\s*album|playlist|плейлист|visualizer|audio)\s*/gi, ' ')
    .replace(/[🎵🎶💋🔥⚡✨💫🌙🌊🎤🎧🎸🎹🎺🎻🥁👑💜💙💚💛🧡❤️🖤🤍💕💖]/g, '')  // emoji
    .replace(/\s{2,}/g, ' ')
    .trim();
  
  // If still too long (>60 chars), take first meaningful part
  if (cleaned.length > 60) {
    const parts = cleaned.split(/[-–—:]/); // split on dashes/colons
    if (parts.length > 1 && parts[0].trim().length > 5) {
      cleaned = parts[0].trim();
    } else {
      cleaned = cleaned.substring(0, 60).trim();
    }
  }
  
  return cleaned;
}

async function streamFromSoundCloud(songTitle: string): Promise<{ resource: any; scUrl: string; scTitle: string }> {
  await ensureSoundCloudInit();
  
  // Clean the title for better SoundCloud search results
  const cleanedTitle = cleanTitleForSearch(songTitle);
  const searchQuery = cleanedTitle || songTitle;
  musicLog(`SC: searching SoundCloud for "${searchQuery}" (original: "${songTitle.substring(0, 50)}")...`);
  
  let results = await withTimeout(
    play.search(searchQuery, { limit: 3, source: { soundcloud: 'tracks' } }),
    12000, 'sc-search'
  );
  
  // If cleaned title found nothing, try several fallback search strategies
  if ((!results || results.length === 0) && cleanedTitle !== songTitle) {
    // Strategy A: try shorter version (first 3 words)
    const words = cleanedTitle.split(/\s+/);
    if (words.length > 3) {
      const shorterQuery = words.slice(0, 3).join(' ');
      musicLog(`SC: retrying with shorter query "${shorterQuery}"...`);
      results = await withTimeout(
        play.search(shorterQuery, { limit: 3, source: { soundcloud: 'tracks' } }),
        12000, 'sc-search-short'
      );
    }
  }
  
  // Strategy B: try English-only words from the title (useful for mixed Russian/English titles)
  if (!results || results.length === 0) {
    const englishWords = songTitle.match(/[a-zA-Z]{3,}/g);
    if (englishWords && englishWords.length >= 2) {
      const engQuery = englishWords.slice(0, 5).join(' ');
      musicLog(`SC: retrying with English words "${engQuery}"...`);
      results = await withTimeout(
        play.search(engQuery, { limit: 5, source: { soundcloud: 'tracks' } }),
        12000, 'sc-search-eng'
      );
    }
  }
  
  // Strategy C: try generic genre keywords if title has them
  if (!results || results.length === 0) {
    const genrePatterns = [
      /doomer\s*music/i, /post[\s-]*punk/i, /synthwave/i, /darkwave/i,
      /russian\s*(doomer|music|rock|punk)/i, /lofi|lo-fi/i, /ambient/i,
    ];
    for (const pattern of genrePatterns) {
      const match = songTitle.match(pattern);
      if (match) {
        const genreQuery = match[0];
        musicLog(`SC: retrying with genre "${genreQuery}"...`);
        results = await withTimeout(
          play.search(genreQuery, { limit: 5, source: { soundcloud: 'tracks' } }),
          12000, 'sc-search-genre'
        );
        if (results && results.length > 0) break;
      }
    }
  }
  
  if (!results || results.length === 0) {
    throw new Error('Не найдено на SoundCloud');
  }
  
  const track = results[0];
  const scTitle = track.name || (track as any).title || songTitle;
  const scUrl = track.url;
  musicLog(`SC: found "${scTitle}" (${scUrl})`);
  
  // Stream via play-dl
  const stream = await withTimeout(
    play.stream(scUrl),
    20000, 'sc-stream'
  );
  
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
    inlineVolume: true,
  });
  
  musicLog(`SC: ✅ stream ready for "${scTitle}"`);
  return { resource, scUrl, scTitle };
}

// ========= Spotify URL Resolution =========
/** Extract song title from a Spotify URL via oEmbed API */
async function resolveSpotifyTitle(spotifyUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data: any = await resp.json();
    // oEmbed returns: { title: "Song Name - Artist" }
    return data.title || null;
  } catch {
    return null;
  }
}

// ========= Piped / Invidious YouTube Proxy APIs =========
// These public APIs proxy YouTube and work from cloud datacenter IPs

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://piped-api.lunar.icu',
  'https://pipedapi.r4fo.com',
  'https://pipedapi.in.projectsegfau.lt',
  'https://pipedapi.darkness.services',
];

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://iv.datura.network',
  'https://yt.drgnz.club',
  'https://invidious.privacyredirect.com',
  'https://invidious.protokolla.fi',
  'https://inv.in.projectsegfau.lt',
  'https://invidious.perennialte.ch',
];

// ========= Cobalt API Strategy =========
// Cobalt (cobalt.tools) is a public media download API
// Official instance requires API key; self-hosted instances don't
const COBALT_INSTANCES = [
  'https://cobalt-api.ayo.tf',
  'https://co.eepy.today',
  'https://cobalt.tskau.team',
  'https://cobalt-api.kwiatekmiki.com',
  'https://api.cobalt.tools',
];

async function getCobaltAudioUrl(videoId: string): Promise<string> {
  const errors: string[] = [];
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  for (const instance of COBALT_INSTANCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const resp = await fetch(`${instance}/`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({
          url: youtubeUrl,
          downloadMode: 'audio',
          audioFormat: 'mp3',
          filenameStyle: 'basic',
        }),
      });
      clearTimeout(timer);
      
      if (!resp.ok) {
        // Try to read error body for more info
        let errBody = '';
        try { errBody = await resp.text(); } catch {}
        errors.push(`${instance}: HTTP ${resp.status} ${errBody.substring(0, 80)}`);
        continue;
      }
      
      const data: any = await resp.json();
      
      if (data.status === 'tunnel' || data.status === 'redirect' || data.status === 'stream') {
        const audioUrl = data.url;
        if (audioUrl) {
          musicLog(`Cobalt(${instance}): got audio URL (status=${data.status})`);
          return audioUrl;
        }
      }
      
      if (data.status === 'picker' && data.picker?.length > 0) {
        const audioItem = data.picker.find((p: any) => p.type === 'audio') || data.picker[0];
        if (audioItem?.url) {
          musicLog(`Cobalt(${instance}): got picker audio URL`);
          return audioItem.url;
        }
      }
      
      // Some instances return the URL directly without status
      if (data.url) {
        musicLog(`Cobalt(${instance}): got direct URL from response`);
        return data.url;
      }
      
      errors.push(`${instance}: unexpected response status=${data.status} keys=${Object.keys(data).join(',')}`);
    } catch (err: any) {
      errors.push(`${instance}: ${err.message}`);
    }
  }
  
  throw new Error(`All Cobalt instances failed: ${errors.join('; ')}`);
}

// ========= play-dl YouTube Direct Strategy =========
// play-dl uses its own internal YouTube client (Innertube) which may bypass IP blocks
async function getPlayDlYouTubeResource(url: string): Promise<any> {
  try {
    // Ensure play-dl YouTube token is set
    if (play.is_expired()) {
      await play.refreshToken();
    }
  } catch { /* token refresh not critical */ }
  
  const stream = await withTimeout(
    play.stream(url, { quality: 2 }), // quality 2 = highest audio
    20000, 'play-dl-yt'
  );
  
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
    inlineVolume: true,
  });
  
  return resource;
}

/** Get direct audio URL via Piped API (public YouTube proxy) */
async function getPipedAudioUrl(videoId: string): Promise<string> {
  const errors: string[] = [];
  
  for (const instance of PIPED_INSTANCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(`${instance}/streams/${videoId}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      clearTimeout(timer);
      
      if (!resp.ok) {
        errors.push(`${instance}: HTTP ${resp.status}`);
        continue;
      }
      
      const data: any = await resp.json();
      
      // Find best audio stream
      const audioStreams = data.audioStreams || [];
      if (audioStreams.length === 0) {
        errors.push(`${instance}: no audio streams`);
        continue;
      }
      
      // Sort by bitrate (highest first) and pick best one
      const sorted = audioStreams
        .filter((s: any) => s.url && s.mimeType?.startsWith('audio/'))
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      
      if (sorted.length === 0) {
        errors.push(`${instance}: no valid audio URLs`);
        continue;
      }
      
      musicLog(`Piped(${instance}): found ${sorted.length} audio streams, best=${sorted[0].bitrate}bps`);
      return sorted[0].url;
    } catch (err: any) {
      errors.push(`${instance}: ${err.message}`);
    }
  }
  
  throw new Error(`All Piped instances failed: ${errors.join('; ')}`);
}

/** Get direct audio URL via Invidious API (another YouTube proxy) */
async function getInvidiousAudioUrl(videoId: string): Promise<string> {
  const errors: string[] = [];
  
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      clearTimeout(timer);
      
      if (!resp.ok) {
        errors.push(`${instance}: HTTP ${resp.status}`);
        continue;
      }
      
      const data: any = await resp.json();
      
      // Invidious provides adaptiveFormats with audio-only streams
      const adaptiveFormats = data.adaptiveFormats || [];
      const audioFormats = adaptiveFormats
        .filter((f: any) => f.type?.startsWith('audio/') && f.url)
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      
      if (audioFormats.length > 0) {
        musicLog(`Invidious(${instance}): found ${audioFormats.length} audio streams, best=${audioFormats[0].bitrate}bps`);
        return audioFormats[0].url;
      }
      
      // Fallback: try formatStreams (combined audio+video, lowest quality)  
      const formatStreams = data.formatStreams || [];
      if (formatStreams.length > 0 && formatStreams[0].url) {
        musicLog(`Invidious(${instance}): using combined format stream`);
        return formatStreams[0].url;
      }
      
      errors.push(`${instance}: no audio formats found`);
    } catch (err: any) {
      errors.push(`${instance}: ${err.message}`);
    }
  }
  
  throw new Error(`All Invidious instances failed: ${errors.join('; ')}`);
}

async function playSong(guildId: string): Promise<{ success: boolean; error?: string }> {
  const q = queues.get(guildId);
  if (!q || q.songs.length === 0) return { success: false, error: 'No songs' };

  const song = q.songs[0];
  const errors: string[] = [];
  
  // Clean URL to remove tracking params
  song.url = cleanYouTubeUrl(song.url);
  const videoId = extractVideoId(song.url);
  musicLog(`▶ playSong start: "${song.title}" (url=${song.url}, videoId=${videoId})`);

  // Retry loop: 2 attempts with 3s cooldown
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      musicLog(`Retry attempt ${attempt + 1} for "${song.title}" (3s cooldown)`);
      setLoadingStatus(guildId, 'streaming', 55, `Повторная попытка (${attempt + 1}/2)...`, { songTitle: song.title });
      await new Promise(r => setTimeout(r, 3000));
    }

    try {
      let resource;
      let strategyUsed = '';

      // ============================================================
      // PHASE 1: If SoundCloud worked before, try it FIRST (fastest path)
      // ============================================================
      if (!resource && lastSuccessfulStrategy === 'soundcloud' && song.title && song.title !== 'YouTube видео') {
        setLoadingStatus(guildId, 'streaming', 60, 'SoundCloud (кэш)...', { songTitle: song.title });
        try {
          musicLog(`FAST: SoundCloud (cached strategy) for "${song.title.substring(0, 50)}"...`);
          const sc = await streamFromSoundCloud(song.title);
          resource = sc.resource;
          strategyUsed = `SoundCloud: ${sc.scTitle}`;
          lastSuccessfulStrategy = 'soundcloud';
          strategySuccessCount['soundcloud'] = (strategySuccessCount['soundcloud'] || 0) + 1;
          musicLog(`✅ FAST SoundCloud OK ("${sc.scTitle}")`);
        } catch (scErr: any) {
          musicLog(`FAST SoundCloud failed: ${scErr.message}`);
        }
      }

      // ============================================================
      // PHASE 2: Run fast API strategies in PARALLEL (P1+P2+P3)
      // These are quick HTTP calls — run simultaneously, take first success
      // ============================================================
      if (!resource && videoId) {
        setLoadingStatus(guildId, 'streaming', 60, 'Быстрые API...', { songTitle: song.title });
        try {
          musicLog(`PARALLEL: Running P1(Piped)+P2(Invidious)+P3(Cobalt) simultaneously...`);
          const winner = await Promise.any([
            getPipedAudioUrl(videoId).then(url => ({ url, name: 'Piped' })),
            getInvidiousAudioUrl(videoId).then(url => ({ url, name: 'Invidious' })),
            getCobaltAudioUrl(videoId).then(url => ({ url, name: 'Cobalt' })),
          ]);
          musicLog(`PARALLEL: ${winner.name} won! Starting ffmpeg...`);
          setLoadingStatus(guildId, 'streaming', 72, `Аудиопоток (${winner.name})...`, { songTitle: song.title });
          resource = await streamViaFfmpeg(winner.url);
          strategyUsed = `${winner.name} API + ffmpeg`;
          lastSuccessfulStrategy = winner.name.toLowerCase();
          musicLog(`✅ PARALLEL OK via ${winner.name}`);
        } catch (parallelErr: any) {
          errors.push(`PARALLEL(P1+P2+P3): All fast APIs failed`);
          musicLog(`PARALLEL: All fast APIs failed`);
        }
      }

      // ============================================================
      // PHASE 3: SoundCloud — fast and reliable from cloud IPs
      // Try BEFORE slow yt-dlp strategies
      // ============================================================
      if (!resource) {
        setLoadingStatus(guildId, 'streaming', 75, 'Поиск на SoundCloud...', { songTitle: song.title });
        try {
          let searchTitle = song.title;
          if (searchTitle === 'YouTube видео' && videoId) {
            try {
              const ctrl = new AbortController();
              const tmr = setTimeout(() => ctrl.abort(), 5000);
              const resp = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { signal: ctrl.signal });
              clearTimeout(tmr);
              if (resp.ok) { const d: any = await resp.json(); if (d.title) searchTitle = d.title; }
            } catch {}
          }
          if (searchTitle && searchTitle !== 'YouTube видео') {
            musicLog(`SC: SoundCloud for "${searchTitle.substring(0, 50)}"...`);
            const sc = await streamFromSoundCloud(searchTitle);
            resource = sc.resource;
            strategyUsed = `SoundCloud: ${sc.scTitle}`;
            lastSuccessfulStrategy = 'soundcloud';
            musicLog(`✅ SC OK ("${sc.scTitle}")`);
          }
        } catch (scErr: any) {
          errors.push(`SC: ${scErr.message}`);
          musicLog(`SC failed: ${scErr.message}`);
        }
      }

      // ============================================================
      // PHASE 4: play-dl direct — YouTube Innertube
      // ============================================================
      if (!resource) {
        setLoadingStatus(guildId, 'streaming', 80, 'play-dl (YouTube)...', { songTitle: song.title });
        try {
          musicLog(`P4: play-dl for ${song.url}...`);
          resource = await getPlayDlYouTubeResource(song.url);
          strategyUsed = 'play-dl YouTube';
          lastSuccessfulStrategy = 'play-dl';
          musicLog(`✅ P4 OK`);
        } catch (p4Err: any) {
          errors.push(`P4: ${p4Err.message}`);
          musicLog(`P4 failed: ${p4Err.message}`);
        }
      }

      // ============================================================
      // PHASE 5: yt-dlp (slowest, skip on retry)
      // ============================================================
      if (!resource && attempt === 0) {
        setLoadingStatus(guildId, 'streaming', 85, 'yt-dlp (резерв)...', { songTitle: song.title });
        try {
          musicLog(`S0: yt-dlp --get-url...`);
          const directUrl = await getYtDlpDirectUrl(song.url, 'bestaudio/best');
          resource = await streamViaFfmpeg(directUrl);
          strategyUsed = 'yt-dlp + ffmpeg';
          lastSuccessfulStrategy = 'yt-dlp';
          musicLog(`✅ S0 OK`);
        } catch (s0Err: any) {
          errors.push(`S0: ${s0Err.message}`);
          musicLog(`S0 failed: ${s0Err.message}`);
        }
      }

      if (!resource && attempt === 0) {
        setLoadingStatus(guildId, 'streaming', 90, 'yt-dlp pipe...', { songTitle: song.title });
        try {
          musicLog('S1: yt-dlp pipe...');
          resource = await getYtDlpPipeResource(song.url);
          strategyUsed = 'yt-dlp pipe';
          lastSuccessfulStrategy = 'yt-dlp';
          musicLog('✅ S1 OK');
        } catch (s1Err: any) {
          errors.push(`S1: ${s1Err.message}`);
          musicLog(`S1 failed: ${s1Err.message}`);
        }
      }

      if (!resource) {
        if (attempt === 0) continue;
        throw new Error(`Все стратегии не сработали. ${errors.slice(-3).join('; ')}`);
      }

      setLoadingStatus(guildId, 'streaming', 92, 'Запуск плеера...', { songTitle: song.title });

      // Set volume
      if (resource.volume) {
        resource.volume.setVolume(q.volume / 100);
      }

      // Play and wait for confirmation
      musicLog(`Playing resource via ${strategyUsed}, waiting for Playing state...`);
      q.player.play(resource);
      
      try {
        await entersState(q.player, AudioPlayerStatus.Playing, 8_000);
        q.isPlaying = true;
        q.isPaused = false;
        q.playStartedAt = Date.now();
        q.currentStrategy = strategyUsed;
        setLoadingStatus(guildId, 'playing', 100, `Играет: ${song.title}`, { songTitle: song.title });
        musicLog(`▶️ Playing: "${song.title}" via ${strategyUsed} (guild=${guildId})`);
        
        // Wait an extra 3 seconds and verify the player is still playing
        // This catches streams that die immediately after starting
        await new Promise(r => setTimeout(r, 3000));
        const stateAfter3s = q.player.state.status;
        if (stateAfter3s !== AudioPlayerStatus.Playing && stateAfter3s !== AudioPlayerStatus.Paused) {
          musicLog(`⚠️ Player died after 3s check: state=${stateAfter3s} via ${strategyUsed}`);
          const msg = `Stream died within 3s (state=${stateAfter3s}) via ${strategyUsed}`;
          errors.push(msg);
          if (attempt === 0) continue; // retry with different strategy
          throw new Error(msg);
        }
        musicLog(`✅ Player still alive after 3s check: state=${stateAfter3s}`);
        
        if (q.textChannel) {
          q.textChannel.send(`🎵 **Играет:** ${song.title} - \`${song.duration}\``).catch(() => {});
        }
        return { success: true };
      } catch (stateErr: any) {
        const currentState = q.player.state.status;
        const msg = `Player не начал воспроизведение (${currentState}) via ${strategyUsed}`;
        errors.push(msg);
        musicLog(`❌ ${msg}`);
        if (attempt === 0) continue;
        throw new Error(msg);
      }
    } catch (error: any) {
      if (attempt < 1) continue;
      
      musicLog(`❌ All strategies failed for "${song.title}": ${error.message}`);
      setLoadingStatus(guildId, 'error', 0, `Не удалось: ${error.message}`, { songTitle: song.title, errorDetail: errors.join(' | ') });
      if (q.textChannel) {
        q.textChannel.send(`❌ Не удалось воспроизвести: ${song.title}\n${error.message?.substring(0, 150)}`).catch(() => {});
      }
      // Skip to next
      q.songs.shift();
      if (q.songs.length > 0) {
        await playSong(guildId);
      } else {
        q.isPlaying = false;
      }
      return { success: false, error: error.message };
    }
  }

  // Should never reach here, but just in case
  return { success: false, error: 'Unexpected end of playSong' };
}

/** Extract YouTube video ID from various URL formats */
function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] || null;
}

/** Use yt-dlp --get-url to quickly extract direct audio URL (no download, just URL extraction) */
// yt-dlp client types to try, in order of likelihood to work from cloud IPs
const YT_DLP_CLIENTS = ['android_vr', 'ios', 'tv_embedded', 'mweb', 'web_creator'];

function getYtDlpDirectUrl(url: string, format: string = 'bestaudio/best'): Promise<string> {
  return new Promise(async (resolve, reject) => {
    // Try multiple YouTube client types
    for (const client of YT_DLP_CLIENTS) {
      try {
        const result = await tryYtDlpClient(url, format, client);
        resolve(result);
        return;
      } catch (err: any) {
        musicLog(`S0: yt-dlp client=${client} failed: ${err.message.substring(0, 100)}`);
        // If it's rate limited (429), don't try more clients
        if (err.message.includes('429') || err.message.includes('Too Many')) {
          reject(err);
          return;
        }
      }
    }
    reject(new Error(`yt-dlp --get-url failed with all clients (${YT_DLP_CLIENTS.join(', ')})`));
  });
}

function tryYtDlpClient(url: string, format: string, client: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn('yt-dlp', [
      '--get-url',
      '-f', format,
      '--no-playlist',
      '--no-check-certificates',
      '--no-warnings',
      '--socket-timeout', '12',
      '--force-ipv4',
      '--extractor-args', `youtube:player_client=${client}`,
      url,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    ytdlp.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    ytdlp.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timeout = setTimeout(() => {
      ytdlp.kill();
      reject(new Error(`yt-dlp --get-url timeout (15s, client=${client}). stderr: ${stderr.substring(0, 150)}`));
    }, 15000);

    ytdlp.on('error', (err: any) => {
      clearTimeout(timeout);
      reject(new Error(`yt-dlp not available: ${err.message}`));
    });

    ytdlp.on('close', (code: number) => {
      clearTimeout(timeout);
      const directUrl = stdout.trim().split('\n')[0];
      if (code === 0 && directUrl && directUrl.startsWith('http')) {
        musicLog(`yt-dlp client=${client} extracted URL (${directUrl.length} chars)`);
        resolve(directUrl);
      } else {
        reject(new Error(`yt-dlp --get-url failed (code ${code}, client=${client}): ${stderr.substring(0, 200)}`));
      }
    });
  });
}

/** Stream from a direct audio URL using ffmpeg → raw PCM → AudioResource */
function streamViaFfmpeg(directUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const ffmpegCmd = ffmpegPath || 'ffmpeg';
    
    const ffmpegProc = spawn(ffmpegCmd, [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '-loglevel', 'warning',
      '-i', directUrl,
      '-vn',
      '-f', 's16le',        // raw PCM
      '-ar', '48000',
      '-ac', '2',
      '-bufsize', '64k',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderrData = '';
    ffmpegProc.stderr.on('data', (chunk: Buffer) => { stderrData += chunk.toString(); });

    ffmpegProc.on('error', (err: any) => {
      reject(new Error(`ffmpeg not available: ${err.message}`));
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        ffmpegProc.kill();
        reject(new Error(`ffmpeg stream timeout (30s). stderr: ${stderrData.substring(0, 300)}`));
      }
    }, 30000);

    let resolved = false;
    ffmpegProc.stdout.once('data', () => {
      resolved = true;
      clearTimeout(timeout);
      const resource = createAudioResource(ffmpegProc.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });
      resolve(resource);
    });

    ffmpegProc.on('close', (code: number) => {
      clearTimeout(timeout);
      if (!resolved) {
        reject(new Error(`ffmpeg exited ${code}: ${stderrData.substring(0, 300)}`));
      }
    });
  });
}

/** Get audio resource using yt-dlp piping audio directly to stdout */
function getYtDlpPipeResource(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // yt-dlp → stdout → ffmpeg → opus pipe
    const ffmpegCmd = ffmpegPath || 'ffmpeg';
    
    const ytdlp = spawn('yt-dlp', [
      '-f', 'bestaudio/best',
      '-o', '-',
      '--no-playlist',
      '--no-check-certificates',
      '--force-ipv4',
      '--socket-timeout', '15',
      '--extractor-args', 'youtube:player_client=android_vr',
      url,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    const ffmpegProc = spawn(ffmpegCmd, [
      '-i', 'pipe:0',
      '-vn',
      '-f', 's16le',        // raw PCM
      '-ar', '48000',
      '-ac', '2',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    // Pipe yt-dlp stdout → ffmpeg stdin
    ytdlp.stdout.pipe(ffmpegProc.stdin);

    let ytdlpStderr = '';
    let ffmpegStderr = '';
    ytdlp.stderr.on('data', (chunk: Buffer) => { ytdlpStderr += chunk.toString(); });
    ffmpegProc.stderr.on('data', (chunk: Buffer) => { ffmpegStderr += chunk.toString(); });

    ytdlp.on('error', (err: any) => {
      reject(new Error(`yt-dlp not available: ${err.message}`));
    });
    ffmpegProc.on('error', (err: any) => {
      reject(new Error(`ffmpeg not available: ${err.message}`));
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        ytdlp.kill();
        ffmpegProc.kill();
        reject(new Error(`yt-dlp pipe timeout (40s). yt-dlp: ${ytdlpStderr.substring(0, 150)}; ffmpeg: ${ffmpegStderr.substring(0, 150)}`));
      }
    }, 40000);

    let resolved = false;
    ffmpegProc.stdout.once('data', () => {
      resolved = true;
      clearTimeout(timeout);
      const resource = createAudioResource(ffmpegProc.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });
      resolve(resource);
    });

    ffmpegProc.on('close', (code: number) => {
      clearTimeout(timeout);
      if (!resolved) {
        reject(new Error(`ffmpeg pipe exited ${code}. yt-dlp: ${ytdlpStderr.substring(0, 150)}; ffmpeg: ${ffmpegStderr.substring(0, 150)}`));
      }
    });

    ytdlp.on('close', (code: number) => {
      if (code !== 0 && !resolved) {
        clearTimeout(timeout);
        ffmpegProc.kill();
        reject(new Error(`yt-dlp pipe exited ${code}: ${ytdlpStderr.substring(0, 200)}`));
      }
    });
  });
}

function destroyQueue(guildId: string) {
  const q = queues.get(guildId);
  if (!q) return;
  q.player.stop(true);
  q.connection?.destroy();
  queues.delete(guildId);
}

async function connectToVoice(guild: Guild, voiceChannel: VoiceBasedChannel): Promise<VoiceConnection> {
  // Check for existing connection
  let connection = getVoiceConnection(guild.id);
  if (connection) {
    if (connection.state.status === VoiceConnectionStatus.Ready) {
      return connection; // Already connected and ready
    }
    // Existing connection is in a bad state — destroy it and recreate
    console.log(`[Music] Existing connection in state '${connection.state.status}', destroying and recreating...`);
    try { connection.destroy(); } catch {}
  }

  console.log(`[Music] Joining voice channel ${voiceChannel.id} in guild ${guild.id}...`);
  connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    debug: true,
  });

  // Log all state transitions for debugging
  connection.on('stateChange', (oldState: any, newState: any) => {
    console.log(`[Voice] State: ${oldState.status} → ${newState.status}`);
    // NOTE: Removed UDP keepAlive workaround — it was killing connections prematurely
  });

  connection.on('debug', (msg: string) => {
    console.log(`[Voice Debug] ${msg}`);
  });

  // Auto-reconnect on disconnect
  connection.on(VoiceConnectionStatus.Disconnected, () => {
    // Use .then/.catch instead of async to prevent unhandled rejection
    Promise.race([
      entersState(connection!, VoiceConnectionStatus.Signalling, 5_000),
      entersState(connection!, VoiceConnectionStatus.Connecting, 5_000),
    ]).catch(() => {
      // Can't reconnect, destroy safely
      try { destroyQueue(guild.id); } catch {}
    });
  });

  // Catch any errors from the connection itself
  connection.on('error', (error: any) => {
    console.error('[Voice Connection Error]', error?.message || error);
  });

  // Wait for the connection to be ready before returning — 30s timeout for cloud hosting
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    console.log(`[Music] Voice connection ready for guild ${guild.id}`);
  } catch {
    console.error(`[Music] Voice connection failed to reach Ready state within 30s, current: ${connection.state.status}`);
    // Don't throw — let the caller handle the player state check
  }

  return connection;
}

// ========= Public API =========

export function initializeMusicSystem(client: Client) {
  botClient = client;
  console.log('✅ Music system initialized (play-dl + @discordjs/voice)');
}

/**
 * Compatibility shim — routes.ts and discord.ts use getDistube().client
 */
export function getDistube(): { client: Client } {
  if (!botClient) {
    throw new Error('Music system не инициализирован');
  }
  return { client: botClient };
}

export async function addSong(
  guild: Guild,
  voiceChannel: VoiceBasedChannel,
  textChannel: any,
  query: string,
  requestedBy: string
): Promise<{ success: boolean; message: string; song?: any }> {
  try {
    if (!botClient) throw new Error('Music system не инициализирован');

    setLoadingStatus(guild.id, 'resolving', 10, 'Получение информации о треке...', { songTitle: query.substring(0, 60) });

    // Resolve query → song info
    let songInfo: Song;

    // Clean YouTube URL if applicable
    const cleanedQuery = cleanYouTubeUrl(query);
    musicLog(`addSong: query="${query.substring(0, 60)}" → cleaned="${cleanedQuery.substring(0, 60)}"`);

    // Check if URL or search query
    const validated = play.yt_validate(cleanedQuery) || play.yt_validate(query);

    // Handle Spotify URLs — extract track name and search YouTube
    const isSpotify = /open\.spotify\.com\/(track|album|playlist)\//.test(query);
    if (isSpotify) {
      musicLog(`addSong: detected Spotify URL, resolving title...`);
      const spotifyTitle = await resolveSpotifyTitle(query);
      if (spotifyTitle) {
        musicLog(`addSong: Spotify title = "${spotifyTitle}"`);
        // Search YouTube for the Spotify track
        const results = await withTimeout(
          play.search(spotifyTitle, { limit: 1, source: { youtube: 'video' } }),
          15000, 'spotify-yt-search'
        );
        if (results?.length) {
          const video = results[0];
          songInfo = {
            title: video.title || spotifyTitle,
            url: video.url,
            duration: formatDuration(video.durationInSec || 0),
            durationSec: video.durationInSec || 0,
            thumbnail: video.thumbnails?.[0]?.url,
            requestedBy,
          };
        } else {
          // YouTube search failed — try SoundCloud directly
          musicLog(`addSong: YouTube search failed for Spotify track, trying SoundCloud...`);
          const scResults = await withTimeout(
            play.search(spotifyTitle, { limit: 1, source: { soundcloud: 'tracks' } }),
            12000, 'spotify-sc-search'
          );
          if (scResults?.length) {
            const track = scResults[0];
            songInfo = {
              title: track.name || (track as any).title || spotifyTitle,
              url: track.url,
              duration: formatDuration(track.durationInSec || 0),
              durationSec: track.durationInSec || 0,
              thumbnail: track.thumbnail || undefined,
              requestedBy,
            };
          } else {
            return { success: false, message: `❌ Не удалось найти "${spotifyTitle}" на YouTube и SoundCloud` };
          }
        }
      } else {
        return { success: false, message: '❌ Не удалось получить информацию о треке из Spotify' };
      }
    } else if (validated === 'video') {
      // Direct YouTube URL — use youtube-sr for metadata (play.video_info times out on cloud)
      try {
        const YouTube = await import('youtube-sr');
        const videoId = cleanedQuery.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
        if (videoId) {
          const video = await withTimeout(
            YouTube.default.getVideo(`https://www.youtube.com/watch?v=${videoId}`),
            10000, 'youtube-sr'
          );
          songInfo = {
            title: video?.title || 'YouTube видео',
            url: `https://www.youtube.com/watch?v=${videoId}`,
            duration: video?.durationFormatted || '0:00',
            durationSec: (video?.duration || 0) / 1000,
            thumbnail: video?.thumbnail?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            requestedBy,
          };
        } else {
          // Can't parse video ID — treat as search
          const results = await withTimeout(
            play.search(query, { limit: 1, source: { youtube: 'video' } }),
            15000, 'search-fallback'
          );
          if (!results?.length) return { success: false, message: '❌ Видео не найдено' };
          const v = results[0];
          songInfo = {
            title: v.title || 'Неизвестно',
            url: v.url,
            duration: formatDuration(v.durationInSec || 0),
            durationSec: v.durationInSec || 0,
            thumbnail: v.thumbnails?.[0]?.url,
            requestedBy,
          };
        }
      } catch {
        // youtube-sr failed — try oEmbed for title, use standard YouTube thumbnail
        const videoId = cleanedQuery.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
        let title = 'YouTube видео';
        let thumbnail: string | undefined;
        
        if (videoId) {
          thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 6000);
            const oembedResp = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
              signal: controller.signal,
            });
            clearTimeout(timer);
            if (oembedResp.ok) {
              const oembedData: any = await oembedResp.json();
              if (oembedData.title) title = oembedData.title;
              if (oembedData.thumbnail_url) thumbnail = oembedData.thumbnail_url;
            }
          } catch { /* oEmbed also failed */ }
        }
        
        musicLog(`addSong: youtube-sr failed, oEmbed fallback title="${title}"`);
        songInfo = {
          title,
          url: cleanedQuery,
          duration: '0:00',
          durationSec: 0,
          thumbnail,
          requestedBy,
        };
      }
    } else if (validated === 'playlist') {
      // Handle playlist — redirect to addPlaylist
      return addPlaylist(guild, voiceChannel, textChannel, query, requestedBy) as any;
    } else {
      // Search YouTube
      const results = await withTimeout(
        play.search(query, { limit: 1, source: { youtube: 'video' } }),
        15000, 'search'
      );
      if (!results || results.length === 0) {
        return { success: false, message: '❌ Ничего не найдено по запросу' };
      }
      const video = results[0];
      songInfo = {
        title: video.title || 'Неизвестно',
        url: video.url,
        duration: formatDuration(video.durationInSec || 0),
        durationSec: video.durationInSec || 0,
        thumbnail: video.thumbnails?.[0]?.url,
        requestedBy,
      };
    }

    setLoadingStatus(guild.id, 'resolving', 30, `Найден: ${songInfo.title}`, { songTitle: songInfo.title });

    // Connect to voice
    setLoadingStatus(guild.id, 'connecting', 40, 'Подключение к голосовому каналу...', { songTitle: songInfo.title });
    const q = getOrCreateQueue(guild.id);
    q.textChannel = textChannel;
    const connection = await connectToVoice(guild, voiceChannel);
    q.connection = connection;
    connection.subscribe(q.player);

    setLoadingStatus(guild.id, 'connecting', 50, 'Подключено! Добавляю в очередь...', { songTitle: songInfo.title });

    // Add song to queue
    q.songs.push(songInfo);

    // If this is the only song, start playing and verify it works
    if (q.songs.length === 1) {
      setLoadingStatus(guild.id, 'streaming', 60, 'Запуск воспроизведения...', { songTitle: songInfo.title });
      const playResult = await playSong(guild.id);
      if (!playResult.success) {
        setLoadingStatus(guild.id, 'error', 0, `Ошибка: ${playResult.error}`, { songTitle: songInfo.title, errorDetail: playResult.error });
        return {
          success: false,
          message: `❌ Не удалось воспроизвести: ${playResult.error || 'Неизвестная ошибка'}`,
        };
      }
      setLoadingStatus(guild.id, 'playing', 100, `Играет: ${songInfo.title}`, { songTitle: songInfo.title });
    } else {
      setLoadingStatus(guild.id, 'playing', 100, `Добавлено в очередь: ${songInfo.title}`, { songTitle: songInfo.title });
    }

    return {
      success: true,
      message: q.songs.length === 1
        ? `🎵 Играет: **${songInfo.title}**`
        : `✅ Добавлено в очередь (#${q.songs.length}): **${songInfo.title}**`,
      song: {
        title: songInfo.title,
        url: songInfo.url,
        duration: songInfo.duration,
        thumbnail: songInfo.thumbnail,
        requestedBy,
      },
    };
  } catch (error: any) {
    console.error('[Music] addSong error:', error);
    setLoadingStatus(guild.id, 'error', 0, `Ошибка: ${error.message}`, { errorDetail: error.message });

    let message = `❌ Ошибка: ${error.message || 'Не удалось добавить трек'}`;

    if (error.message?.includes('Sign in') || error.message?.includes('confirm your age') || error.message?.includes('bot')) {
      message = '❌ YouTube заблокировал запрос. Попробуйте другой трек или прямую ссылку.';
    } else if (error.message?.includes('No result') || error.message?.includes('not found')) {
      message = '❌ Трек не найден. Проверьте ссылку или название.';
    } else if (error.message?.includes('private') || error.message?.includes('unavailable')) {
      message = '❌ Видео недоступно (приватное или удалено).';
    }

    return { success: false, message };
  }
}

export async function pauseSong(guildId: string): Promise<{ success: boolean; message: string }> {
  try {
    const q = queues.get(guildId);
    if (!q || !q.isPlaying || q.songs.length === 0) return { success: false, message: '❌ Ничего не играет' };
    if (q.isPaused) return { success: true, message: '⏸️ Уже на паузе' };

    const result = q.player.pause(true); // force pause
    q.isPaused = true;
    console.log(`[Music] Paused in guild ${guildId}, player state: ${q.player.state.status}, pause result: ${result}`);
    return { success: true, message: '⏸️ Пауза' };
  } catch (error: any) {
    console.error('[Music] Pause error:', error);
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function resumeSong(guildId: string): Promise<{ success: boolean; message: string }> {
  try {
    const q = queues.get(guildId);
    if (!q || q.songs.length === 0) return { success: false, message: '❌ Ничего не играет' };
    if (!q.isPaused) return { success: true, message: '▶️ Уже играет' };

    const result = q.player.unpause();
    q.isPaused = false;
    console.log(`[Music] Resumed in guild ${guildId}, player state: ${q.player.state.status}, unpause result: ${result}`);
    return { success: true, message: '▶️ Продолжаем' };
  } catch (error: any) {
    console.error('[Music] Resume error:', error);
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function skipSong(guildId: string): Promise<{ success: boolean; message: string }> {
  try {
    const q = queues.get(guildId);
    if (!q || q.songs.length === 0) return { success: false, message: '❌ Ничего не играет' };

    const skipped = q.songs[0];
    // Stop current — triggers Idle event which calls handleNextSong
    q.player.stop();
    return { success: true, message: `⏭️ Пропущено: **${skipped.title}**` };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function stopSong(guildId: string): Promise<{ success: boolean; message: string }> {
  try {
    const q = queues.get(guildId);
    if (!q) return { success: false, message: '❌ Ничего не играет' };

    destroyQueue(guildId);
    return { success: true, message: '⏹️ Остановлено' };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function shuffleQueue(guildId: string): Promise<{ success: boolean; message: string }> {
  try {
    const q = queues.get(guildId);
    if (!q || q.songs.length <= 1) return { success: false, message: '❌ Недостаточно треков для перемешивания' };

    // Shuffle everything except current (songs[0])
    const current = q.songs[0];
    const rest = q.songs.slice(1);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    q.songs = [current, ...rest];

    return { success: true, message: '🔀 Очередь перемешана' };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function toggleLoop(guildId: string): Promise<{ success: boolean; message: string; loopMode?: number }> {
  try {
    const q = queues.get(guildId);
    if (!q) return { success: false, message: '❌ Ничего не играет' };

    q.loopMode = (q.loopMode + 1) % 3;
    const messages = ['🔁 Повтор выключен', '🔂 Повтор трека', '🔁 Повтор очереди'];
    return { success: true, message: messages[q.loopMode], loopMode: q.loopMode };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function getCurrentSong(guildId: string): Promise<{ success: boolean; message?: string; song?: any; isPaused?: boolean; loading?: LoadingStatus }> {
  try {
    const loadingStatus = getLoadingStatus(guildId);
    const q = queues.get(guildId);
    
    // If loading is in progress, return loading state even if not yet playing
    if (loadingStatus.state !== 'idle' && loadingStatus.state !== 'playing' && loadingStatus.state !== 'error') {
      return {
        success: true,
        loading: loadingStatus,
        song: q?.songs[0] ? {
          title: q.songs[0].title,
          duration: q.songs[0].duration,
          url: q.songs[0].url,
          thumbnail: q.songs[0].thumbnail,
          requestedBy: q.songs[0].requestedBy,
        } : undefined,
      };
    }
    
    // If there was an error recently (last 2 min), return it
    if (loadingStatus.state === 'error' && (Date.now() - loadingStatus.timestamp) < 120000) {
      return {
        success: false,
        message: loadingStatus.message,
        loading: loadingStatus,
      };
    }
    
    if (!q || q.songs.length === 0 || (!q.isPlaying && !q.isPaused)) {
      return { success: false, message: '❌ Ничего не играет' };
    }

    const song = q.songs[0];
    const playerState = q.player.state.status;
    return {
      success: true,
      isPaused: q.isPaused || playerState === AudioPlayerStatus.Paused || playerState === AudioPlayerStatus.AutoPaused,
      song: {
        title: song.title,
        duration: song.duration,
        url: song.url,
        thumbnail: song.thumbnail,
        requestedBy: song.requestedBy,
      },
    };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function getQueue(guildId: string): Promise<{ success: boolean; message?: string; queue?: any[]; totalSongs?: number; loop?: boolean }> {
  try {
    const q = queues.get(guildId);
    if (!q || q.songs.length === 0) {
      return { success: false, message: '❌ Очередь пуста' };
    }

    const songs = q.songs.slice(0, 10).map((song, index) => ({
      position: index + 1,
      title: song.title,
      duration: song.duration,
      url: song.url,
      thumbnail: song.thumbnail,
      isPlaying: index === 0,
    }));

    return {
      success: true,
      queue: songs,
      totalSongs: q.songs.length,
      loop: q.loopMode !== 0,
    };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function setVolume(guildId: string, volume: number): Promise<{ success: boolean; message: string }> {
  try {
    const q = queues.get(guildId);
    if (!q) return { success: false, message: '❌ Ничего не играет' };

    q.volume = Math.max(0, Math.min(200, volume));
    // Volume is applied per-resource at play time; current resource can't be changed easily
    // But we store it for the next song  
    return { success: true, message: `🔊 Громкость: ${q.volume}%` };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function searchSongs(query: string, limit: number = 5): Promise<{ success: boolean; message?: string; results?: any[] }> {
  try {
    const results = await withTimeout(
      play.search(query, { limit, source: { youtube: 'video' } }),
      15000, 'search'
    );

    if (!results || results.length === 0) {
      return { success: false, message: '❌ Ничего не найдено' };
    }

    const formattedResults = results.map((video, index) => ({
      index: index + 1,
      title: video.title || 'Неизвестно',
      url: video.url,
      duration: formatDuration(video.durationInSec || 0),
      thumbnail: video.thumbnails?.[0]?.url,
    }));

    return { success: true, results: formattedResults };
  } catch (error: any) {
    console.error('[Music] Search error:', error);
    return { success: false, message: '❌ Ошибка при поиске' };
  }
}

export async function addPlaylist(
  guild: Guild,
  voiceChannel: VoiceBasedChannel,
  textChannel: any,
  playlistUrl: string,
  requestedBy: string
): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    if (!botClient) throw new Error('Music system не инициализирован');

    const playlistInfo = await withTimeout(
      play.playlist_info(playlistUrl, { incomplete: true }),
      20000, 'playlist_info'
    );
    if (!playlistInfo) {
      return { success: false, message: '❌ Плейлист не найден' };
    }

    const videos = await playlistInfo.all_videos();
    if (!videos || videos.length === 0) {
      return { success: false, message: '❌ Плейлист пуст' };
    }

    // Connect to voice
    const q = getOrCreateQueue(guild.id);
    q.textChannel = textChannel;
    const connection = await connectToVoice(guild, voiceChannel);
    q.connection = connection;
    connection.subscribe(q.player);

    const wasEmpty = q.songs.length === 0;

    // Add all songs
    for (const video of videos) {
      q.songs.push({
        title: video.title || 'Неизвестно',
        url: video.url,
        duration: formatDuration(video.durationInSec || 0),
        durationSec: video.durationInSec || 0,
        thumbnail: video.thumbnails?.[0]?.url,
        requestedBy,
      });
    }

    // Start playing if queue was empty
    if (wasEmpty && q.songs.length > 0) {
      await playSong(guild.id);
    }

    return {
      success: true,
      message: `✅ Добавлен плейлист: **${playlistInfo.title || 'Плейлист'}** (${videos.length} треков)`,
      count: videos.length,
    };
  } catch (error: any) {
    console.error('[Music] Playlist error:', error);
    return {
      success: false,
      message: `❌ Ошибка: ${error.message || 'Не удалось добавить плейлист'}`,
    };
  }
}

export async function jumpToSong(guildId: string, position: number): Promise<{ success: boolean; message: string }> {
  try {
    const q = queues.get(guildId);
    if (!q || q.songs.length === 0) return { success: false, message: '❌ Ничего не играет' };

    if (position < 1 || position > q.songs.length) {
      return { success: false, message: '❌ Неверная позиция в очереди' };
    }

    // Already playing this track
    if (position === 1) {
      return { success: true, message: `▶️ Уже играет: **${q.songs[0].title}**` };
    }

    // Move the target to position 0, keeping ALL other songs (including currently playing)
    const target = q.songs[position - 1];
    q.songs.splice(position - 1, 1);  // remove target from its current position
    q.songs.unshift(target);            // insert target at position 0, old songs shift down
    
    // Set jumping flag to prevent handleNextSong from firing when player switches
    q.isJumping = true;
    
    // Reset retry state for the new song
    q.streamRetryCount = 0;
    q.playStartedAt = 0;
    q.currentStrategy = '';
    
    // Stop current player (will trigger Idle → handleNextSong sees isJumping and returns)
    q.player.stop();
    
    // Small delay to ensure Idle event is processed
    await new Promise(r => setTimeout(r, 100));
    
    // Start playing the new song
    const playResult = await playSong(guildId);
    if (!playResult.success) {
      return { success: false, message: `❌ Не удалось воспроизвести: ${playResult.error}` };
    }

    return { success: true, message: `⏭️ Переход к: **${target.title}**` };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function removeSong(guildId: string, position: number): Promise<{ success: boolean; message: string }> {
  try {
    const q = queues.get(guildId);
    if (!q || q.songs.length === 0) return { success: false, message: '❌ Ничего не играет' };

    if (position < 1 || position > q.songs.length) {
      return { success: false, message: '❌ Неверная позиция в очереди' };
    }

    // If removing currently playing song, skip to next
    if (position === 1) {
      const removed = q.songs[0];
      q.player.stop(); // Triggers next song via Idle
      return { success: true, message: `🗑️ Удалено (текущий): **${removed.title}**` };
    }

    const removed = q.songs.splice(position - 1, 1)[0];
    return { success: true, message: `🗑️ Удалено: **${removed?.title || 'Неизвестный трек'}**` };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function clearQueue(guildId: string): Promise<{ success: boolean; message: string }> {
  try {
    const q = queues.get(guildId);
    if (!q || q.songs.length === 0) return { success: false, message: '❌ Ничего не играет' };

    // Keep current song, remove rest
    q.songs.splice(1);
    return { success: true, message: '🧹 Очередь очищена (текущий трек продолжает играть)' };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

// Функция для инициализации play-dl с SoundCloud support
export async function initializePlayDl() {
  try {
    // Initialize SoundCloud client_id for play-dl
    const clientId = await play.getFreeClientID();
    if (clientId) {
      await play.setToken({ soundcloud: { client_id: clientId } });
      console.log('✅ play-dl + SoundCloud ready (client_id obtained)');
    } else {
      console.log('⚠️ play-dl ready, SoundCloud client_id not available');
    }
  } catch (err: any) {
    console.log('⚠️ play-dl init warning:', err.message, '— SoundCloud fallback may not work');
  }
}

/** Diagnostic: test each streaming strategy and return results */
export async function testStreaming(videoId: string): Promise<any> {
  const results: any = { videoId, strategies: {} };
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  
  // Test yt-dlp --get-url (Strategy 1 first step)
  try {
    const t0 = Date.now();
    const directUrl = await getYtDlpDirectUrl(url);
    results.strategies.ytdlpGetUrl = {
      success: true,
      timeMs: Date.now() - t0,
      urlPreview: directUrl.substring(0, 120) + '...',
    };
  } catch (e: any) {
    results.strategies.ytdlpGetUrl = { success: false, error: e.message };
  }

  // Test yt-dlp availability
  try {
    const version = execSync('yt-dlp --version 2>/dev/null', { encoding: 'utf8', timeout: 5000 }).trim();
    results.strategies.ytdlp = { available: true, version };
  } catch {
    results.strategies.ytdlp = { available: false, error: 'yt-dlp not found in PATH' };
  }

  // Test ffmpeg availability
  try {
    const version = execSync(`${ffmpegPath || 'ffmpeg'} -version 2>/dev/null | head -1`, { encoding: 'utf8', timeout: 5000 }).trim();
    results.strategies.ffmpeg = { available: true, version: version.substring(0, 100) };
  } catch {
    results.strategies.ffmpeg = { available: false, error: 'ffmpeg not found' };
  }

  return results;
}

/** Full end-to-end audio diagnostic — generates test tone, plays it, reports at each step */
export async function testAudioEndToEnd(
  guild: Guild,
  voiceChannel: VoiceBasedChannel
): Promise<any> {
  const steps: any[] = [];
  const addStep = (name: string, status: string, detail?: any) => {
    steps.push({ step: name, status, detail, timestamp: Date.now() });
    console.log(`[AudioTest] ${status === 'ok' ? '✅' : '❌'} ${name}: ${JSON.stringify(detail || '')}`);
  };

  // Step 1: Check required dependencies
  // 1a: Opus encoder
  let opusOk = false;
  try {
    // @discordjs/voice checks for these
    try { require('@discordjs/opus'); opusOk = true; addStep('opus-encoder', 'ok', '@discordjs/opus'); }
    catch {
      try { require('opusscript'); opusOk = true; addStep('opus-encoder', 'ok', 'opusscript'); }
      catch { addStep('opus-encoder', 'fail', 'Neither @discordjs/opus nor opusscript found'); }
    }
  } catch (e: any) { addStep('opus-encoder', 'fail', e.message); }

  // 1b: Sodium encryption
  let sodiumOk = false;
  try {
    try { require('sodium-native'); sodiumOk = true; addStep('sodium', 'ok', 'sodium-native'); }
    catch {
      try { require('libsodium-wrappers'); sodiumOk = true; addStep('sodium', 'ok', 'libsodium-wrappers'); }
      catch {
        try { require('tweetnacl'); sodiumOk = true; addStep('sodium', 'ok', 'tweetnacl'); }
        catch { addStep('sodium', 'fail', 'No sodium library found (need sodium-native, libsodium-wrappers, or tweetnacl)'); }
      }
    }
  } catch (e: any) { addStep('sodium', 'fail', e.message); }

  // 1c: FFmpeg
  try {
    const ver = execSync(`${ffmpegPath || 'ffmpeg'} -version 2>/dev/null | head -1`, { encoding: 'utf8', timeout: 5000 }).trim();
    addStep('ffmpeg', 'ok', ver.substring(0, 80));
  } catch {
    addStep('ffmpeg', 'fail', 'ffmpeg not found');
  }

  if (!opusOk || !sodiumOk) {
    return { success: false, message: 'Missing required dependencies', steps };
  }

  // Step 2: Connect to voice channel with detailed adapter diagnostics
  let connection: VoiceConnection;
  try {
    // First, destroy any existing connections
    const existing = getVoiceConnection(guild.id);
    if (existing) {
      addStep('voice-cleanup', 'ok', `Destroyed existing connection in state: ${existing.state.status}`);
      try { existing.destroy(); } catch {}
    }

    // Create a wrapped adapter that logs sendPayload
    let adapterSendPayloadResult: boolean | null = null;
    const originalAdapterCreator = guild.voiceAdapterCreator;
    const wrappedAdapterCreator = (methods: any) => {
      const adapter = originalAdapterCreator(methods);
      const origSendPayload = adapter.sendPayload;
      adapter.sendPayload = (data: any) => {
        const result = origSendPayload(data);
        adapterSendPayloadResult = result;
        console.log(`[AudioTest] sendPayload called, op=${data?.op}, d.channel_id=${data?.d?.channel_id}, result=${result}`);
        return result;
      };
      return adapter;
    };

    addStep('voice-joining', 'ok', `Joining channel ${voiceChannel.id}...`);
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: wrappedAdapterCreator as any,
      selfDeaf: true,
      debug: true,
    });

    // Track state changes and debug messages
    const stateLog: string[] = [];
    const debugLog: string[] = [];
    connection.on('stateChange', (oldState: any, newState: any) => {
      stateLog.push(`${oldState.status}→${newState.status}`);
      console.log(`[AudioTest] Voice state: ${oldState.status} → ${newState.status}`);
    });
    connection.on('debug', (msg: string) => {
      debugLog.push(msg.substring(0, 500));
      console.log(`[AudioTest Debug] ${msg}`);
    });
    connection.on('error', (err: any) => {
      stateLog.push(`error:${err?.message}`);
      console.error(`[AudioTest] Voice error:`, err?.message);
    });

    // Wait for Ready with 15s timeout (Render has 30s proxy limit)
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    } catch {}

    const connState = connection.state.status;
    addStep('voice-connect', connState === VoiceConnectionStatus.Ready ? 'ok' : 'fail', {
      state: connState,
      sendPayloadResult: adapterSendPayloadResult,
      stateTransitions: stateLog,
      debugMessages: debugLog.slice(0, 20),
    });
    if (connState !== VoiceConnectionStatus.Ready) {
      return { success: false, message: `Voice connection not ready: ${connState}`, steps };
    }
  } catch (e: any) {
    addStep('voice-connect', 'fail', e.message);
    return { success: false, message: `Cannot connect to voice: ${e.message}`, steps };
  }

  // Step 3: Create audio player
  let player: AudioPlayer;
  try {
    player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    connection.subscribe(player);
    addStep('player-create', 'ok', 'Player created and subscribed');
  } catch (e: any) {
    addStep('player-create', 'fail', e.message);
    return { success: false, message: `Cannot create player: ${e.message}`, steps };
  }

  // Step 4: Generate a 440Hz sine wave test tone (3 seconds) as raw PCM s16le 48kHz stereo
  try {
    const { Readable } = require('stream');
    const sampleRate = 48000;
    const channels = 2;
    const durationSec = 3;
    const frequency = 440; // A4 note
    const totalSamples = sampleRate * durationSec;
    const buf = Buffer.alloc(totalSamples * channels * 2); // 2 bytes per sample (s16le)

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * frequency * t) * 0.5; // 50% volume
      const intSample = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
      // Write to both channels (stereo)
      buf.writeInt16LE(intSample, (i * channels) * 2);      // left
      buf.writeInt16LE(intSample, (i * channels + 1) * 2);  // right
    }

    const pcmStream = Readable.from(buf);
    addStep('generate-tone', 'ok', { frequency: 440, durationSec: 3, bufferSize: buf.length });

    // Step 5: Create audio resource from the PCM stream
    const resource = createAudioResource(pcmStream, {
      inputType: StreamType.Raw,
    });
    addStep('create-resource', 'ok', 'AudioResource created from PCM tone');

    // Step 6: Play it
    player.play(resource);
    addStep('player-play-called', 'ok', `Player state after play(): ${player.state.status}`);

    // Step 7: Wait for Playing state
    try {
      await entersState(player, AudioPlayerStatus.Playing, 5_000);
      addStep('player-playing', 'ok', `Player confirmed Playing state`);
    } catch {
      addStep('player-playing', 'fail', `Player did not reach Playing. State: ${player.state.status}`);
      player.stop(true);
      return { success: false, message: `Player did not start playing`, steps };
    }

    // Step 8: Wait 3 seconds and check if still playing
    await new Promise(r => setTimeout(r, 2000));
    const stateAfter2s = player.state.status;
    addStep('player-after-2s', stateAfter2s === AudioPlayerStatus.Playing ? 'ok' : 'fail', { state: stateAfter2s });

    // Wait for it to finish or timeout
    await new Promise(r => setTimeout(r, 2000));
    const finalState = player.state.status;
    addStep('player-final', 'ok', { state: finalState });

    // Cleanup
    player.stop(true);

    return {
      success: true,
      message: 'Test tone played successfully! Check if you heard a 440Hz beep in Discord voice channel.',
      steps,
    };
  } catch (e: any) {
    addStep('test-tone', 'fail', e.message);
    return { success: false, message: `Test tone failed: ${e.message}`, steps };
  }
}
