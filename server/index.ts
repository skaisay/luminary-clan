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
      CREATE TABLE IF NOT EXISTS ad_spots (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        discord_id TEXT NOT NULL,
        roblox_username TEXT NOT NULL,
        roblox_avatar_url TEXT,
        paid_amount INTEGER NOT NULL DEFAULT 500000,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[DB] Ensured all custom tables exist');
  } catch (e: any) {
    console.error('[DB] Failed to ensure tables:', e.message);
  }

  if (process.env.NODE_ENV === "production") {
    const { ensureProductionData } = await import("./production-seed");
    await ensureProductionData();
  }
  
  // Запуск Discord бота (DisTube инициализируется автоматически внутри)
  setupDiscordBot().catch(err => {
    console.error('Ошибка запуска Discord бота:', err);
  });
  
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
