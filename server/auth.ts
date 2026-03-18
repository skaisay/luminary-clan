import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import type { Admin } from "@shared/schema";

// Debug logging
console.log('[AUTH] Discord OAuth config:');
console.log('[AUTH]   CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? `${process.env.DISCORD_CLIENT_ID.substring(0, 6)}...` : 'NOT SET');
console.log('[AUTH]   BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? `${process.env.DISCORD_BOT_TOKEN.substring(0, 6)}...` : 'NOT SET');

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const admin = await storage.getAdminByUsername(username);
      
      if (!admin) {
        return done(null, false, { message: "Неверный логин или пароль" });
      }

      const isValid = await bcrypt.compare(password, admin.passwordHash);
      
      if (!isValid) {
        return done(null, false, { message: "Неверный логин или пароль" });
      }

      return done(null, { type: 'admin', ...admin });
    } catch (error) {
      return done(error);
    }
  })
);

passport.serializeUser((user: any, done) => {
  done(null, { type: user.type, id: user.id });
});

passport.deserializeUser(async (data: any, done) => {
  try {
    if (data.type === 'admin') {
      const admin = await storage.getAdminById(data.id);
      if (!admin) {
        return done(null, null);
      }
      const { passwordHash, ...safeAdminData } = admin;
      done(null, { type: 'admin', ...safeAdminData });
    } else if (data.type === 'discord') {
      const member = await storage.getClanMemberById(data.id);
      done(null, member ? { type: 'discord', ...member } : null);
    } else {
      done(null, null);
    }
  } catch (error) {
    done(error);
  }
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function requireAdmin(req: any, res: any, next: any) {
  if (req.isAuthenticated() && (req.user as any).type === 'admin') {
    return next();
  }
  res.status(401).json({ error: "Требуется авторизация администратора" });
}

export function requireDiscordAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated() && (req.user as any).type === 'discord') {
    return next();
  }
  res.status(401).json({ error: "Требуется авторизация через Discord" });
}
