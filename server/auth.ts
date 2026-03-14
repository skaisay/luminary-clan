import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as DiscordStrategy } from "passport-discord";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import type { Admin } from "@shared/schema";

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';

const getCallbackURL = () => {
  if (process.env.CALLBACK_URL) {
    return process.env.CALLBACK_URL;
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return `${process.env.RENDER_EXTERNAL_URL}/auth/discord/callback`;
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/auth/discord/callback`;
  }
  
  return "http://localhost:5000/auth/discord/callback";
};

const CALLBACK_URL = getCallbackURL();

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

if (DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET) {
  passport.use(
    new DiscordStrategy(
      {
        clientID: DISCORD_CLIENT_ID,
        clientSecret: DISCORD_CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ["identify"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          let member = await storage.getClanMemberByDiscordId(profile.id);
          
          if (!member) {
            member = await storage.createClanMember({
              discordId: profile.id,
              username: profile.username,
              avatar: profile.avatar 
                ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                : undefined,
              role: "Member",
            });
          } else {
            await storage.updateClanMember(member.id, {
              username: profile.username,
              avatar: profile.avatar 
                ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                : member.avatar,
            });
          }

          return done(null, { type: 'discord', ...member });
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
} else {
  console.log('⚠️ DISCORD_CLIENT_ID/SECRET не установлены — авторизация через Discord отключена');
}

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
