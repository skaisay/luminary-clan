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

async function playSong(guildId: string): Promise<{ success: boolean; error?: string }> {
  const q = queues.get(guildId);
  if (!q || q.songs.length === 0) return { success: false, error: 'No songs' };

  const song = q.songs[0];

  try {
    let resource;
    let strategyUsed = '';
    
    // Strategy 1: yt-dlp --get-url → ffmpeg (fastest & most reliable)
    try {
      const directUrl = await getYtDlpDirectUrl(song.url);
      resource = await streamViaFfmpeg(directUrl);
      strategyUsed = 'yt-dlp URL + ffmpeg';
      console.log(`[Music] ✅ Strategy 1 (yt-dlp URL + ffmpeg) for "${song.title}"`);
    } catch (s1Err: any) {
      console.log(`[Music] Strategy 1 failed: ${s1Err.message}`);
    }

    // Strategy 2: yt-dlp pipe → ffmpeg → player
    if (!resource) {
      try {
        resource = await getYtDlpPipeResource(song.url);
        strategyUsed = 'yt-dlp pipe + ffmpeg';
        console.log(`[Music] ✅ Strategy 2 (yt-dlp pipe) for "${song.title}"`);
      } catch (s2Err: any) {
        console.log(`[Music] Strategy 2 failed: ${s2Err.message}`);
      }
    }

    // Strategy 3: play-dl stream
    if (!resource) {
      try {
        const stream = await withTimeout(play.stream(song.url), 12000, 'play-dl stream');
        resource = createAudioResource(stream.stream, {
          inputType: stream.type,
          inlineVolume: true,
        });
        strategyUsed = 'play-dl';
        console.log(`[Music] ✅ Strategy 3 (play-dl) for "${song.title}"`);
      } catch (s3Err: any) {
        console.log(`[Music] Strategy 3 failed: ${s3Err.message}`);
      }
    }

    if (!resource) {
      throw new Error('Все стратегии стриминга не сработали');
    }

    // Set volume
    if (resource.volume) {
      resource.volume.setVolume(q.volume / 100);
    }

    // Play and wait for confirmation that it actually starts
    q.player.play(resource);
    
    // Wait up to 5s for player to enter Playing state
    try {
      await entersState(q.player, AudioPlayerStatus.Playing, 5_000);
      q.isPlaying = true;
      console.log(`[Music] ▶️ Confirmed playing: "${song.title}" via ${strategyUsed} in guild ${guildId}`);
      
      if (q.textChannel) {
        q.textChannel.send(`🎵 **Играет:** ${song.title} - \`${song.duration}\``).catch(() => {});
      }
      return { success: true };
    } catch (stateErr: any) {
      // Player didn't enter Playing state — check what state it's in
      const currentState = q.player.state.status;
      console.error(`[Music] Player failed to enter Playing state. Current: ${currentState}. Strategy: ${strategyUsed}`);
      throw new Error(`Player не начал воспроизведение (${currentState}) via ${strategyUsed}`);
    }
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
    return { success: false, error: error.message };
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

/** Stream from a direct audio URL using ffmpeg → raw PCM → AudioResource */
function streamViaFfmpeg(directUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const ffmpegCmd = ffmpegPath || 'ffmpeg';
    
    const ffmpegProc = spawn(ffmpegCmd, [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-i', directUrl,
      '-vn',
      '-f', 's16le',        // raw PCM
      '-ar', '48000',
      '-ac', '2',
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
      '-f', 'bestaudio[ext=webm]/bestaudio/best',
      '-o', '-',
      '--no-playlist',
      '--no-check-certificates',
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
        reject(new Error(`yt-dlp pipe timeout (25s). yt-dlp: ${ytdlpStderr.substring(0, 150)}; ffmpeg: ${ffmpegStderr.substring(0, 150)}`));
      }
    }, 25000);

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
    const connection = await connectToVoice(guild, voiceChannel);
    q.connection = connection;
    connection.subscribe(q.player);

    // Add song to queue
    q.songs.push(songInfo);

    // If this is the only song, start playing and verify it works
    if (q.songs.length === 1) {
      const playResult = await playSong(guild.id);
      if (!playResult.success) {
        return {
          success: false,
          message: `❌ Не удалось воспроизвести: ${playResult.error || 'Неизвестная ошибка'}`,
        };
      }
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
      debugLog.push(msg.substring(0, 200));
      console.log(`[AudioTest Debug] ${msg}`);
    });
    connection.on('error', (err: any) => {
      stateLog.push(`error:${err?.message}`);
      console.error(`[AudioTest] Voice error:`, err?.message);
    });

    // Wait for Ready with 30s timeout
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
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
