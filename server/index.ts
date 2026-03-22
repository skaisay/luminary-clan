import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import passport from "passport";
import { registerRoutes } from "./routes";
import { log, serveStatic } from "./production";
import { setupDiscordBot } from "./bot-commands";
import { pool } from "./db";
import "./auth";

// Prevent unhandled promise rejections from crashing the process
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
  // Don't exit — let the server keep running
});

const app = express();
const PgStore = connectPg(session);

app.set('trust proxy', true);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    store: new PgStore({
      pool: pool as any,
      createTableIfMissing: true,
      tableName: 'session',
    }),
    name: 'luminary.sid',
    secret: process.env.SESSION_SECRET || "clan-command-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 90,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Ensure new tables exist (drizzle-kit push may fail silently during build)
  try {
    const { pool: dbPool } = await import("./db");
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS profile_decorations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'badge',
        emoji TEXT,
        image_url TEXT,
        css_effect TEXT,
        color TEXT,
        rarity TEXT NOT NULL DEFAULT 'common',
        price INTEGER NOT NULL DEFAULT 100,
        category TEXT NOT NULL DEFAULT 'general',
        is_available BOOLEAN NOT NULL DEFAULT true,
        max_owners INTEGER DEFAULT -1,
        current_owners INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS member_decorations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id VARCHAR NOT NULL,
        decoration_id VARCHAR NOT NULL,
        discord_id TEXT NOT NULL,
        is_equipped BOOLEAN NOT NULL DEFAULT false,
        acquired_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS game_history (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        discord_id TEXT NOT NULL,
        game TEXT NOT NULL,
        bet INTEGER NOT NULL,
        reward INTEGER NOT NULL,
        result TEXT NOT NULL,
        played_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS profile_customs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        discord_id TEXT NOT NULL UNIQUE,
        banner_color_1 TEXT DEFAULT '',
        banner_color_2 TEXT DEFAULT '',
        card_color TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        custom_avatar TEXT DEFAULT '',
        banner_image TEXT DEFAULT '',
        hidden_sections JSONB DEFAULT '[]',
        roblox_username TEXT DEFAULT '',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS og_screenshots (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        discord_id TEXT NOT NULL UNIQUE,
        image_base64 TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      ALTER TABLE clan_members ADD COLUMN IF NOT EXISTS guild_id TEXT;
      CREATE TABLE IF NOT EXISTS connected_servers (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        guild_id TEXT NOT NULL UNIQUE,
        guild_name TEXT NOT NULL,
        guild_icon TEXT,
        bot_token TEXT NOT NULL,
        owner_discord_id TEXT NOT NULL,
        owner_username TEXT NOT NULL,
        member_count INTEGER DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_primary BOOLEAN NOT NULL DEFAULT false,
        settings JSONB DEFAULT '{}',
        connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_sync_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ad_spots (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        discord_id TEXT NOT NULL,
        roblox_username TEXT NOT NULL,
        roblox_avatar_url TEXT,
        paid_amount INTEGER NOT NULL DEFAULT 500000,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS page_availability (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        page_id TEXT NOT NULL UNIQUE,
        page_name TEXT NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        maintenance_title_ru TEXT,
        maintenance_title_en TEXT,
        maintenance_message_ru TEXT,
        maintenance_message_en TEXT,
        updated_by TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS discord_channel_rules (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        channel_type TEXT NOT NULL DEFAULT 'text',
        language_restriction TEXT,
        block_profanity BOOLEAN NOT NULL DEFAULT false,
        block_discrimination BOOLEAN NOT NULL DEFAULT false,
        auto_delete BOOLEAN NOT NULL DEFAULT false,
        commands_only BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS flagged_messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_username TEXT NOT NULL,
        content TEXT NOT NULL,
        reason TEXT NOT NULL,
        reason_detail TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        message_timestamp TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Add commands_only column if it doesn't exist (for existing databases)
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'discord_channel_rules' AND column_name = 'commands_only'
        ) THEN
          ALTER TABLE discord_channel_rules ADD COLUMN commands_only BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END
      $$;

      CREATE TABLE IF NOT EXISTS bot_auto_responses (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        trigger_words TEXT NOT NULL,
        response TEXT NOT NULL,
        response_type TEXT NOT NULL DEFAULT 'text',
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        cooldown_ms INTEGER NOT NULL DEFAULT 30000,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[DB] Ensured all custom tables exist');

    // Seed default "arena" auto-response trigger if table is empty
    const { rows: triggerRows } = await dbPool.query('SELECT COUNT(*) FROM bot_auto_responses');
    if (parseInt(triggerRows[0].count) === 0) {
      await dbPool.query(`
        INSERT INTO bot_auto_responses (id, trigger_words, response, response_type, description, is_active, cooldown_ms)
        VALUES (
          gen_random_uuid(),
          'arena,арена',
          'https://www.roblox.com/games/15887744763/Arena-MWT',
          'link',
          'Ссылка на арену MWT для игроков',
          true,
          30000
        )
      `);
      console.log('[DB] Seeded default arena auto-response trigger');
    }

    // Seed page_availability if empty
    const { rows: pageRows } = await dbPool.query('SELECT COUNT(*) FROM page_availability');
    if (parseInt(pageRows[0].count) === 0) {
      const pages = [
        { id: 'dashboard', name: 'Главная' },
        { id: 'statistics', name: 'Статистика' },
        { id: 'leaderboard', name: 'Рейтинг' },
        { id: 'members', name: 'Участники' },
        { id: 'news', name: 'Новости' },
        { id: 'shop', name: 'Магазин' },
        { id: 'decorations', name: 'Декорации' },
        { id: 'inventory', name: 'Инвентарь' },
        { id: 'convert', name: 'Конвертация' },
        { id: 'about', name: 'О Клане' },
        { id: 'achievements', name: 'Достижения' },
        { id: 'quests', name: 'Квесты' },
        { id: 'trading', name: 'Торговля' },
        { id: 'boosters', name: 'Бустеры' },
        { id: 'daily-rewards', name: 'Ежедневные награды' },
        { id: 'profile', name: 'Профиль' },
        { id: 'mini-games', name: 'Мини-Игры' },
        { id: 'clan-wars', name: 'Клановые войны' },
      ];
      for (const p of pages) {
        await dbPool.query(
          `INSERT INTO page_availability (page_id, page_name, is_enabled, maintenance_title_ru, maintenance_title_en, maintenance_message_ru, maintenance_message_en)
           VALUES ($1, $2, true, 'Страница на обслуживании', 'Page Under Maintenance', 'Эта страница временно недоступна. Пожалуйста, зайдите позже.', 'This page is temporarily unavailable. Please come back later.')
           ON CONFLICT (page_id) DO NOTHING`,
          [p.id, p.name]
        );
      }
      console.log('[DB] Seeded page_availability with', pages.length, 'pages');
    }
  } catch (e: any) {
    console.error('[DB] Failed to ensure tables:', e.message);
  }

  if (process.env.NODE_ENV === "production") {
    const { ensureProductionData } = await import("./production-seed");
    await ensureProductionData();
  }
  
  // Запуск Discord бота с автоматическим retry при rate-limit
  const startBot = async (attempt = 1) => {
    try {
      await setupDiscordBot();
      console.log('[BOT] Discord бот успешно запущен');
    } catch (err: any) {
      const msg = err?.message || String(err);
      // Update diagnostic
      try {
        const botMod = await import("./bot-commands");
        (botMod as any).lastBotError = `startBot attempt ${attempt}: ${msg}`;
      } catch {}
      const isRateLimit = msg.includes('429') || msg.includes('rate') || msg.includes('1015');
      const nextDelay = isRateLimit ? 60 : Math.min(30 * attempt, 120); // 60s if rate-limited, else 30s * attempt (max 2min)
      console.error(`[BOT] Ошибка запуска бота (попытка ${attempt}): ${msg}`);
      console.log(`[BOT] Следующая попытка через ${nextDelay}с...`);
      setTimeout(() => startBot(attempt + 1), nextDelay * 1000);
    }
  };
  startBot();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    console.error('[Express Error]', err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);

    // Keep-alive: ping ourselves every 14 minutes to prevent Render free tier from sleeping
    if (process.env.NODE_ENV === "production") {
      const KEEP_ALIVE_URL = process.env.CALLBACK_URL
        ? process.env.CALLBACK_URL.replace('/auth/discord/callback', '/api/health')
        : `https://luminary-clan.onrender.com/api/health`;
      
      setInterval(async () => {
        try {
          const res = await fetch(KEEP_ALIVE_URL);
          log(`Keep-alive ping: ${res.status}`);
        } catch (err) {
          log(`Keep-alive ping failed: ${err}`);
        }
      }, 14 * 60 * 1000); // Every 14 minutes
      
      log(`Keep-alive enabled: pinging ${KEEP_ALIVE_URL} every 14 min`);
    }
  });
})();
