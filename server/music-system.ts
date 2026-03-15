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
  try {
    const ffmpegStatic = await import('ffmpeg-static');
    if (ffmpegStatic.default) {
      ffmpegPath = ffmpegStatic.default;
      process.env.FFMPEG_PATH = ffmpegStatic.default;
      console.log('✅ ffmpeg-static найден:', ffmpegStatic.default);
    }
  } catch {
    console.log('⚠️ FFmpeg не найден! Музыка может не работать.');
  }
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
}

// ========= State =========
const queues = new Map<string, GuildQueue>();
let botClient: Client | null = null;

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
    };

    // Когда трек закончился — переходим к следующему
    player.on(AudioPlayerStatus.Idle, () => {
      handleNextSong(guildId);
    });

    player.on('error', (error) => {
      console.error(`[Music] Player error guild=${guildId}:`, error.message);
      const gq = queues.get(guildId);
      if (gq?.textChannel) {
        gq.textChannel.send(`❌ Ошибка воспроизведения: ${error.message.substring(0, 200)}`).catch(() => {});
      }
      // Переходим к следующему треку при ошибке
      handleNextSong(guildId);
    });

    queues.set(guildId, q);
  }
  return q;
}

async function handleNextSong(guildId: string) {
  const q = queues.get(guildId);
  if (!q) return;

  // Loop modes
  if (q.loopMode === 1 && q.songs.length > 0) {
    // Loop current song — replay songs[0]
    await playSong(guildId);
    return;
  }

  if (q.loopMode === 2 && q.songs.length > 0) {
    // Loop queue — move current to end
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
    // Queue empty — disconnect after short delay
    q.isPlaying = false;
    if (q.textChannel) {
      q.textChannel.send('✅ Очередь завершена!').catch(() => {});
    }
    setTimeout(() => {
      const gq = queues.get(guildId);
      if (gq && gq.songs.length === 0) {
        destroyQueue(guildId);
      }
    }, 30000); // Wait 30s before disconnecting
  }
}

async function playSong(guildId: string) {
  const q = queues.get(guildId);
  if (!q || q.songs.length === 0) return;

  const song = q.songs[0];

  try {
    let resource;
    
    // Strategy 1: yt-dlp --get-url → ffmpeg (fastest & most reliable)
    // yt-dlp extracts the direct audio URL, ffmpeg streams & transcodes it
    try {
      const directUrl = await getYtDlpDirectUrl(song.url);
      resource = await streamFromDirectUrl(directUrl);
      console.log(`[Music] ✅ Strategy 1 (yt-dlp URL + ffmpeg) for "${song.title}"`);
    } catch (s1Err: any) {
      console.log(`[Music] Strategy 1 (yt-dlp URL + ffmpeg) failed: ${s1Err.message}`);
    }

    // Strategy 2: yt-dlp pipe directly to player
    if (!resource) {
      try {
        resource = await getYtDlpPipeResource(song.url);
        console.log(`[Music] ✅ Strategy 2 (yt-dlp pipe) for "${song.title}"`);
      } catch (s2Err: any) {
        console.log(`[Music] Strategy 2 (yt-dlp pipe) failed: ${s2Err.message}`);
      }
    }

    // Strategy 3: play-dl stream (rarely works on cloud, but worth trying)
    if (!resource) {
      try {
        const stream = await withTimeout(play.stream(song.url), 12000, 'play-dl stream');
        resource = createAudioResource(stream.stream, {
          inputType: stream.type,
          inlineVolume: true,
        });
        console.log(`[Music] ✅ Strategy 3 (play-dl) for "${song.title}"`);
      } catch (s3Err: any) {
        console.log(`[Music] Strategy 3 (play-dl) failed: ${s3Err.message}`);
      }
    }

    if (!resource) {
      throw new Error('Все стратегии стриминга не сработали');
    }

    // Set volume
    if (resource.volume) {
      resource.volume.setVolume(q.volume / 100);
    }

    q.player.play(resource);
    q.isPlaying = true;

    if (q.textChannel) {
      q.textChannel.send(`🎵 **Играет:** ${song.title} - \`${song.duration}\``).catch(() => {});
    }

    console.log(`[Music] Playing: "${song.title}" in guild ${guildId}`);
  } catch (error: any) {
    console.error(`[Music] All stream strategies failed for "${song.title}":`, error.message);
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
  }
}

/** Extract YouTube video ID from various URL formats */
function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] || null;
}

/** Use yt-dlp --get-url to quickly extract direct audio URL (no download, just URL extraction) */
function getYtDlpDirectUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn('yt-dlp', [
      '--get-url',
      '-f', 'bestaudio[ext=webm]/bestaudio/best',
      '--no-playlist',
      '--no-check-certificates',
      '--no-warnings',
      url,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    ytdlp.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    ytdlp.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timeout = setTimeout(() => {
      ytdlp.kill();
      reject(new Error(`yt-dlp --get-url timeout (20s). stderr: ${stderr.substring(0, 200)}`));
    }, 20000);

    ytdlp.on('error', (err: any) => {
      clearTimeout(timeout);
      reject(new Error(`yt-dlp not available: ${err.message}`));
    });

    ytdlp.on('close', (code: number) => {
      clearTimeout(timeout);
      const directUrl = stdout.trim().split('\n')[0];
      if (code === 0 && directUrl && directUrl.startsWith('http')) {
        console.log(`[Music] yt-dlp extracted URL (${directUrl.length} chars)`);
        resolve(directUrl);
      } else {
        reject(new Error(`yt-dlp --get-url failed (code ${code}): ${stderr.substring(0, 200)}`));
      }
    });
  });
}

/** Stream from a direct audio URL using ffmpeg → AudioResource */
function streamFromDirectUrl(directUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const ffmpegCmd = ffmpegPath || 'ffmpeg';
    
    const ffmpegProc = spawn(ffmpegCmd, [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-i', directUrl,
      '-vn',
      '-acodec', 'libopus',
      '-f', 'opus',
      '-ar', '48000',
      '-ac', '2',
      '-b:a', '96k',
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
        reject(new Error(`ffmpeg stream timeout (20s). stderr: ${stderrData.substring(0, 300)}`));
      }
    }, 20000);

    let resolved = false;
    ffmpegProc.stdout.once('data', () => {
      resolved = true;
      clearTimeout(timeout);
      const resource = createAudioResource(ffmpegProc.stdout, {
        inputType: StreamType.OggOpus,
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
      '-f', 'bestaudio[ext=webm]/bestaudio/best',
      '-o', '-',
      '--no-playlist',
      '--no-check-certificates',
      url,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    const ffmpegProc = spawn(ffmpegCmd, [
      '-i', 'pipe:0',
      '-vn',
      '-acodec', 'libopus',
      '-f', 'opus',
      '-ar', '48000',
      '-ac', '2',
      '-b:a', '96k',
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
        reject(new Error(`yt-dlp pipe timeout (25s). yt-dlp: ${ytdlpStderr.substring(0, 150)}; ffmpeg: ${ffmpegStderr.substring(0, 150)}`));
      }
    }, 25000);

    let resolved = false;
    ffmpegProc.stdout.once('data', () => {
      resolved = true;
      clearTimeout(timeout);
      const resource = createAudioResource(ffmpegProc.stdout, {
        inputType: StreamType.OggOpus,
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

function connectToVoice(guild: Guild, voiceChannel: VoiceBasedChannel): VoiceConnection {
  // Check for existing connection
  let connection = getVoiceConnection(guild.id);
  if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
    return connection;
  }

  connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  // ===== UDP keepAlive workaround for cloud hosting =====
  // Render/Railway/Heroku have issues with UDP keepAlive timeouts
  connection.on('stateChange', (_old: any, newS: any) => {
    const networking = Reflect.get(newS, 'networking');
    networking?.on?.('stateChange', (_: any, ns: any) => {
      const udp = Reflect.get(ns, 'udp');
      if (udp) clearInterval(udp.keepAliveInterval);
    });
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

    // Resolve query → song info
    let songInfo: Song;

    // Check if URL or search query
    const validated = play.yt_validate(query);

    if (validated === 'video') {
      // Direct YouTube URL — use youtube-sr for metadata (play.video_info times out on cloud)
      try {
        const YouTube = await import('youtube-sr');
        const videoId = query.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
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
            thumbnail: video?.thumbnail?.url,
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
        // Fallback: just use the URL with minimal info
        songInfo = {
          title: 'YouTube видео',
          url: query,
          duration: '0:00',
          durationSec: 0,
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

    // Connect to voice
    const q = getOrCreateQueue(guild.id);
    q.textChannel = textChannel;
    const connection = connectToVoice(guild, voiceChannel);
    q.connection = connection;
    connection.subscribe(q.player);

    // Add song to queue
    q.songs.push(songInfo);

    // If this is the only song, start playing
    if (q.songs.length === 1) {
      await playSong(guild.id);
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
    if (!q || !q.isPlaying) return { success: false, message: '❌ Ничего не играет' };

    q.player.pause();
    return { success: true, message: '⏸️ Пауза' };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function resumeSong(guildId: string): Promise<{ success: boolean; message: string }> {
  try {
    const q = queues.get(guildId);
    if (!q) return { success: false, message: '❌ Ничего не играет' };

    q.player.unpause();
    return { success: true, message: '▶️ Продолжаем' };
  } catch (error: any) {
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

export async function getCurrentSong(guildId: string): Promise<{ success: boolean; message?: string; song?: any }> {
  try {
    const q = queues.get(guildId);
    if (!q || q.songs.length === 0 || !q.isPlaying) {
      return { success: false, message: '❌ Ничего не играет' };
    }

    const song = q.songs[0];
    return {
      success: true,
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
    const connection = connectToVoice(guild, voiceChannel);
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

    // Remove songs before the target position (keep current loop behavior)
    const target = q.songs[position - 1];
    q.songs = q.songs.slice(position - 1);
    q.player.stop(); // Triggers Idle → handleNextSong will play new songs[0]

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

// Функция для совместимости со старым кодом
export async function initializePlayDl() {
  console.log('✅ play-dl music system ready');
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
