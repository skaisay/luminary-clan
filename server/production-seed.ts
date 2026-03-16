import { db } from "./db";
import { admins, clanSettings, clanStats, profileDecorations } from "@shared/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";

export async function ensureProductionData() {
  try {
    console.log("[Production] Checking if initial data exists...");

    const existingAdmins = await db.select().from(admins).limit(1);
    
    if (existingAdmins.length === 0) {
      console.log("[Production] Creating initial admin user...");
      
      const adminPassword = process.env.ADMIN_PASSWORD || "Luminary2024!";
      
      if (!process.env.ADMIN_PASSWORD) {
        console.warn("[Production] ⚠️  WARNING: Using default admin password!");
        console.warn("[Production] ⚠️  Set ADMIN_PASSWORD environment variable for better security");
        console.warn("[Production] ⚠️  Current password: Luminary2024!");
      }
      
      await db.insert(admins).values({
        username: "admin",
        passwordHash: await hashPassword(adminPassword),
        email: "admin@luminary.clan",
      });
      console.log("[Production] Admin user created successfully");
    }

    const existingSettings = await db.select().from(clanSettings).limit(1);
    
    if (existingSettings.length === 0) {
      console.log("[Production] Creating initial clan settings...");
      await db.insert(clanSettings).values({
        clanName: "CLAN COMMAND",
        clanTag: "[CC]",
        description: "Элитный игровой клан с футуристичной эстетикой и профессиональным подходом к киберспорту",
        aiSystemPrompt: "Ты - AI советник игрового клана CLAN COMMAND. Помогай игрокам анализировать статистику, улучшать навыки и разрабатывать стратегии. Будь дружелюбным, но профессиональным.",
        primaryColor: "#06b6d4",
        accentColor: "#a855f7",
      });
      console.log("[Production] Clan settings created successfully");
    }

    const existingStats = await db.select().from(clanStats).limit(1);
    
    if (existingStats.length === 0) {
      console.log("[Production] Creating initial clan stats...");
      await db.insert(clanStats).values({
        totalMembers: 0,
        totalWins: 0,
        totalLosses: 0,
        averageRank: 0,
        monthlyActivity: 0,
      });
      console.log("[Production] Clan stats created successfully");
    }

    console.log("[Production] Initial data check complete");

    // Seed default profile decorations (additive — only inserts missing ones)
    const existingDecorations = await db.select().from(profileDecorations);
    const existingNames = new Set(existingDecorations.map(d => d.name));
    {
      console.log("[Production] Creating default profile decorations...");
      const defaultDecorations = [
        // ==================== BADGES (40 items) ====================
        // Common (500-1000 LC)
        { name: "Пламя 🔥", description: "Огненный значок — показывает горячий темперамент", type: "badge", emoji: "🔥", cssEffect: "drop-shadow(0 0 6px #f97316)", color: "#f97316", rarity: "common", price: 500, category: "general" },
        { name: "Молния ⚡", description: "Электрический разряд — скорость и мощь", type: "badge", emoji: "⚡", cssEffect: "drop-shadow(0 0 6px #eab308)", color: "#eab308", rarity: "common", price: 500, category: "general" },
        { name: "Звезда ✦", description: "Яркая звезда — сияй среди остальных", type: "badge", emoji: "✦", cssEffect: "drop-shadow(0 0 6px #60a5fa)", color: "#60a5fa", rarity: "common", price: 750, category: "general" },
        { name: "Сердце ❤️", description: "Горячее сердце — любовь к игре", type: "badge", emoji: "❤️", cssEffect: "drop-shadow(0 0 5px #ef4444)", color: "#ef4444", rarity: "common", price: 500, category: "general" },
        { name: "Щит 🛡️", description: "Надёжный щит — защита команды", type: "badge", emoji: "🛡️", cssEffect: "drop-shadow(0 0 5px #3b82f6)", color: "#3b82f6", rarity: "common", price: 600, category: "general" },
        { name: "Меч ⚔️", description: "Острый меч — мастер атаки", type: "badge", emoji: "⚔️", cssEffect: "drop-shadow(0 0 5px #94a3b8)", color: "#94a3b8", rarity: "common", price: 600, category: "general" },
        { name: "Музыка 🎵", description: "Нота — душа компании", type: "badge", emoji: "🎵", cssEffect: "drop-shadow(0 0 5px #a78bfa)", color: "#a78bfa", rarity: "common", price: 500, category: "general" },
        { name: "Кубок 🏆", description: "Свой первый трофей", type: "badge", emoji: "🏆", cssEffect: "drop-shadow(0 0 5px #fbbf24)", color: "#fbbf24", rarity: "common", price: 750, category: "general" },
        { name: "Ракета 🚀", description: "В космос на скорости света", type: "badge", emoji: "🚀", cssEffect: "drop-shadow(0 0 5px #06b6d4)", color: "#06b6d4", rarity: "common", price: 600, category: "general" },
        { name: "Снежинка ❄️", description: "Холодный как лёд", type: "badge", emoji: "❄️", cssEffect: "drop-shadow(0 0 5px #93c5fd)", color: "#93c5fd", rarity: "common", price: 500, category: "seasonal" },
        { name: "Лист 🍀", description: "Удача на вашей стороне", type: "badge", emoji: "🍀", cssEffect: "drop-shadow(0 0 5px #22c55e)", color: "#22c55e", rarity: "common", price: 500, category: "seasonal" },
        { name: "Луна 🌙", description: "Ночной хищник", type: "badge", emoji: "🌙", cssEffect: "drop-shadow(0 0 5px #fde68a)", color: "#fde68a", rarity: "common", price: 700, category: "general" },
        // Uncommon (1000-2500 LC)
        { name: "Корона 👑", description: "Королевская корона — властвуй над игрой", type: "badge", emoji: "👑", cssEffect: "drop-shadow(0 0 8px #f59e0b)", color: "#f59e0b", rarity: "uncommon", price: 1500, category: "general" },
        { name: "Алмаз 💠", description: "Чистый алмаз — блистай красотой", type: "badge", emoji: "💠", cssEffect: "drop-shadow(0 0 6px #67e8f9)", color: "#67e8f9", rarity: "uncommon", price: 1200, category: "general" },
        { name: "Череп 💀", description: "Знак опасности — не подходи", type: "badge", emoji: "💀", cssEffect: "drop-shadow(0 0 6px #a1a1aa)", color: "#a1a1aa", rarity: "uncommon", price: 1000, category: "general" },
        { name: "Волк 🐺", description: "Одинокий волк — сила в одиночестве", type: "badge", emoji: "🐺", cssEffect: "drop-shadow(0 0 6px #78716c)", color: "#78716c", rarity: "uncommon", price: 1500, category: "general" },
        { name: "Огненный Шар 🔮", description: "Магический огненный шар", type: "badge", emoji: "🔮", cssEffect: "drop-shadow(0 0 7px #c084fc)", color: "#c084fc", rarity: "uncommon", price: 1800, category: "general" },
        { name: "Якорь ⚓", description: "Стабильность и надёжность", type: "badge", emoji: "⚓", cssEffect: "drop-shadow(0 0 6px #6b7280)", color: "#6b7280", rarity: "uncommon", price: 1000, category: "general" },
        { name: "Тигр 🐅", description: "Быстрый и опасный хищник", type: "badge", emoji: "🐅", cssEffect: "drop-shadow(0 0 6px #fb923c)", color: "#fb923c", rarity: "uncommon", price: 2000, category: "general" },
        { name: "Компас 🧭", description: "Всегда знаешь путь к победе", type: "badge", emoji: "🧭", cssEffect: "drop-shadow(0 0 6px #2dd4bf)", color: "#2dd4bf", rarity: "uncommon", price: 1200, category: "general" },
        // Rare (2500-5000 LC)
        { name: "Кристалл 💎", description: "Редчайший кристалл — привлекай взгляды", type: "badge", emoji: "💎", cssEffect: "drop-shadow(0 0 8px #8b5cf6)", color: "#8b5cf6", rarity: "rare", price: 3000, category: "general" },
        { name: "Самурай ⛩️", description: "Путь воина — честь и сила", type: "badge", emoji: "⛩️", cssEffect: "drop-shadow(0 0 8px #dc2626)", color: "#dc2626", rarity: "rare", price: 3500, category: "general" },
        { name: "Трезубец 🔱", description: "Повелитель океанов", type: "badge", emoji: "🔱", cssEffect: "drop-shadow(0 0 8px #0ea5e9)", color: "#0ea5e9", rarity: "rare", price: 4000, category: "general" },
        { name: "Инь-Янь ☯️", description: "Баланс света и тьмы", type: "badge", emoji: "☯️", cssEffect: "drop-shadow(0 0 8px #e2e8f0)", color: "#e2e8f0", rarity: "rare", price: 3000, category: "general" },
        { name: "Метеор ☄️", description: "Разрушительная сила космоса", type: "badge", emoji: "☄️", cssEffect: "drop-shadow(0 0 8px #f97316)", color: "#f97316", rarity: "rare", price: 4500, category: "general" },
        { name: "Орёл 🦅", description: "Зоркий взгляд с высоты", type: "badge", emoji: "🦅", cssEffect: "drop-shadow(0 0 8px #a16207)", color: "#a16207", rarity: "rare", price: 3500, category: "general" },
        // Epic (7500-15000 LC)
        { name: "Дракон 🐉", description: "Древний дракон — непобедимая сила", type: "badge", emoji: "🐉", cssEffect: "drop-shadow(0 0 10px #ef4444) animate-bounce", color: "#ef4444", rarity: "epic", price: 7500, category: "exclusive" },
        { name: "Феникс 🔥", description: "Восставший из пепла — бессмертная легенда", type: "badge", emoji: "🕊️", cssEffect: "drop-shadow(0 0 10px #f97316) animate-pulse", color: "#f97316", rarity: "epic", price: 10000, category: "exclusive" },
        { name: "Единорог 🦄", description: "Мифическое существо — чистая магия", type: "badge", emoji: "🦄", cssEffect: "drop-shadow(0 0 10px #e879f9) animate-pulse", color: "#e879f9", rarity: "epic", price: 12000, category: "exclusive" },
        { name: "Ниндзя 🥷", description: "Тень во тьме — мастер скрытности", type: "badge", emoji: "🥷", cssEffect: "drop-shadow(0 0 10px #374151)", color: "#6b7280", rarity: "epic", price: 8000, category: "exclusive" },
        { name: "Атом ⚛️", description: "Сила расщеплённого атома", type: "badge", emoji: "⚛️", cssEffect: "drop-shadow(0 0 10px #06b6d4) animate-spin-slow", color: "#06b6d4", rarity: "epic", price: 9000, category: "exclusive" },
        { name: "Глаз Бури 🌀", description: "Повелитель штормов", type: "badge", emoji: "🌀", cssEffect: "drop-shadow(0 0 10px #818cf8) animate-spin-slow", color: "#818cf8", rarity: "epic", price: 11000, category: "exclusive" },
        // Legendary (25000-100000 LC)
        { name: "Космос 🌌", description: "Галактический путешественник", type: "badge", emoji: "🌌", cssEffect: "drop-shadow(0 0 12px #a855f7) animate-pulse", color: "#a855f7", rarity: "legendary", price: 25000, category: "exclusive" },
        { name: "Тёмный Рыцарь ⚔️", description: "Элитный воин тьмы — самый крутой значок", type: "badge", emoji: "⚔️", cssEffect: "drop-shadow(0 0 15px #dc2626) animate-pulse", color: "#dc2626", rarity: "legendary", price: 50000, category: "limited", maxOwners: 10 },
        { name: "Бесконечность ♾️", description: "За пределами всего существующего", type: "badge", emoji: "♾️", cssEffect: "drop-shadow(0 0 15px #fbbf24) animate-pulse", color: "#fbbf24", rarity: "legendary", price: 75000, category: "limited", maxOwners: 5 },
        { name: "Чёрная Дыра 🕳️", description: "Поглощает всё на своём пути", type: "badge", emoji: "🕳️", cssEffect: "drop-shadow(0 0 15px #7c3aed) animate-spin-slow", color: "#7c3aed", rarity: "legendary", price: 100000, category: "limited", maxOwners: 3 },
        { name: "Сверхновая 💥", description: "Взрыв невероятной силы", type: "badge", emoji: "💥", cssEffect: "drop-shadow(0 0 15px #f59e0b) animate-bounce", color: "#f59e0b", rarity: "legendary", price: 60000, category: "exclusive" },
        { name: "Знак Легенды 🏅", description: "Для тех кто стал легендой", type: "badge", emoji: "🏅", cssEffect: "drop-shadow(0 0 15px #eab308) animate-pulse", color: "#eab308", rarity: "legendary", price: 40000, category: "exclusive" },

        // ==================== NAME COLORS (20 items) ====================
        // Common
        { name: "Красный Ник", description: "Цвет крови — дерзко и смело", type: "name_color", emoji: null, cssEffect: "", color: "#ef4444", rarity: "common", price: 800, category: "general" },
        { name: "Зелёный Ник", description: "Цвет природы — спокойно и уверенно", type: "name_color", emoji: null, cssEffect: "", color: "#22c55e", rarity: "common", price: 800, category: "general" },
        { name: "Синий Ник", description: "Цвет океана — глубоко и мудро", type: "name_color", emoji: null, cssEffect: "", color: "#3b82f6", rarity: "common", price: 800, category: "general" },
        { name: "Розовый Ник", description: "Нежный розовый оттенок", type: "name_color", emoji: null, cssEffect: "", color: "#ec4899", rarity: "common", price: 800, category: "general" },
        { name: "Оранжевый Ник", description: "Яркий и тёплый", type: "name_color", emoji: null, cssEffect: "", color: "#f97316", rarity: "common", price: 800, category: "general" },
        // Uncommon
        { name: "Бирюзовый Ник", description: "Цвет тропического моря", type: "name_color", emoji: null, cssEffect: "", color: "#06b6d4", rarity: "uncommon", price: 1500, category: "general" },
        { name: "Фиолетовый Ник", description: "Цвет магии и тайн", type: "name_color", emoji: null, cssEffect: "", color: "#8b5cf6", rarity: "uncommon", price: 1500, category: "general" },
        { name: "Лаймовый Ник", description: "Свежий и яркий лайм", type: "name_color", emoji: null, cssEffect: "", color: "#84cc16", rarity: "uncommon", price: 1500, category: "general" },
        { name: "Коралловый Ник", description: "Тёплый коралловый оттенок", type: "name_color", emoji: null, cssEffect: "", color: "#f43f5e", rarity: "uncommon", price: 1800, category: "general" },
        // Rare
        { name: "Золотой Ник", description: "Твой никнейм сияет золотом", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #f59e0b, #fbbf24); -webkit-background-clip: text; -webkit-text-fill-color: transparent;", color: "#f59e0b", rarity: "rare", price: 5000, category: "general" },
        { name: "Серебряный Ник", description: "Холодный блеск серебра", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #9ca3af, #e5e7eb); -webkit-background-clip: text; -webkit-text-fill-color: transparent;", color: "#9ca3af", rarity: "rare", price: 4000, category: "general" },
        { name: "Изумрудный Ник", description: "Сияющий изумрудный градиент", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #059669, #34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent;", color: "#059669", rarity: "rare", price: 4500, category: "general" },
        // Epic
        { name: "Градиент Неон", description: "Неоновый градиент — киберпанк стиль", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #06b6d4, #a855f7, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent;", color: "#06b6d4", rarity: "epic", price: 15000, category: "exclusive" },
        { name: "Закат", description: "Градиент заката — от красного к фиолетовому", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #ef4444, #f97316, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent;", color: "#ef4444", rarity: "epic", price: 12000, category: "exclusive" },
        { name: "Лёд и Огонь", description: "Контраст холода и пламени", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #06b6d4, #ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent;", color: "#06b6d4", rarity: "epic", price: 13000, category: "exclusive" },
        { name: "Кислотный Ник", description: "Токсичный неоновый зелёный", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #22c55e, #a3e635, #22c55e); -webkit-background-clip: text; -webkit-text-fill-color: transparent;", color: "#22c55e", rarity: "epic", price: 10000, category: "exclusive" },
        // Legendary
        { name: "Радуга", description: "Все цвета радуги на нике", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-size: 200%;", color: "#ef4444", rarity: "legendary", price: 30000, category: "limited" },
        { name: "Галактический Ник", description: "Мерцание далёких звёзд", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #312e81, #7c3aed, #c084fc, #7c3aed, #312e81); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-size: 200%;", color: "#7c3aed", rarity: "legendary", price: 35000, category: "exclusive" },
        { name: "Хромированный", description: "Жидкий хром — абсолютный стиль", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #d4d4d8, #fafafa, #a1a1aa, #fafafa, #d4d4d8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-size: 200%;", color: "#d4d4d8", rarity: "legendary", price: 40000, category: "exclusive" },
        { name: "Плазменный Ник", description: "Энергия чистой плазмы", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #06b6d4, #22d3ee, #a5f3fc, #22d3ee, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-size: 200%;", color: "#06b6d4", rarity: "legendary", price: 45000, category: "limited", maxOwners: 20 },

        // ==================== AVATAR FRAMES (15 items) ====================
        // Common
        { name: "Простая Рамка", description: "Аккуратная тонкая рамка", type: "avatar_frame", emoji: null, cssEffect: "ring-1 ring-white/30", color: "#e2e8f0", rarity: "common", price: 500, category: "general" },
        { name: "Синяя Рамка", description: "Классическая синяя обводка", type: "avatar_frame", emoji: null, cssEffect: "ring-2 ring-blue-500/50", color: "#3b82f6", rarity: "common", price: 600, category: "general" },
        { name: "Зелёная Рамка", description: "Рамка цвета природы", type: "avatar_frame", emoji: null, cssEffect: "ring-2 ring-green-500/50", color: "#22c55e", rarity: "common", price: 600, category: "general" },
        // Uncommon
        { name: "Рамка Молнии", description: "Электрические искры по краям", type: "avatar_frame", emoji: null, cssEffect: "ring-2 ring-yellow-400 shadow-md shadow-yellow-500/30", color: "#eab308", rarity: "uncommon", price: 1500, category: "general" },
        { name: "Ледяная Рамка", description: "Замороженная обводка с инеем", type: "avatar_frame", emoji: null, cssEffect: "ring-2 ring-cyan-400 shadow-md shadow-cyan-500/30", color: "#22d3ee", rarity: "uncommon", price: 1500, category: "general" },
        { name: "Розовая Рамка", description: "Сладкая розовая обводка", type: "avatar_frame", emoji: null, cssEffect: "ring-2 ring-pink-400 shadow-md shadow-pink-500/30", color: "#ec4899", rarity: "uncommon", price: 1200, category: "general" },
        // Rare
        { name: "Огненная Рамка", description: "Аватар в кольце пламени", type: "avatar_frame", emoji: null, cssEffect: "ring-2 ring-orange-500 shadow-lg shadow-orange-500/50", color: "#f97316", rarity: "rare", price: 4000, category: "general" },
        { name: "Кровавая Рамка", description: "Тёмно-красная мрачная рамка", type: "avatar_frame", emoji: null, cssEffect: "ring-2 ring-red-600 shadow-lg shadow-red-600/50", color: "#dc2626", rarity: "rare", price: 3500, category: "general" },
        { name: "Алмазная Рамка", description: "Сверкающая алмазная обводка", type: "avatar_frame", emoji: null, cssEffect: "ring-2 ring-cyan-300 shadow-lg shadow-cyan-400/50", color: "#67e8f9", rarity: "rare", price: 5000, category: "general" },
        // Epic
        { name: "Космическая Рамка", description: "Мерцающая галактическая рамка", type: "avatar_frame", emoji: null, cssEffect: "ring-2 ring-purple-500 shadow-lg shadow-purple-500/50 animate-pulse", color: "#a855f7", rarity: "epic", price: 12000, category: "exclusive" },
        { name: "Неоновая Рамка", description: "Яркий неоновый контур", type: "avatar_frame", emoji: null, cssEffect: "ring-2 ring-emerald-400 shadow-lg shadow-emerald-400/60 animate-pulse", color: "#34d399", rarity: "epic", price: 10000, category: "exclusive" },
        { name: "Тёмная Аура", description: "Мрачная аура окутывает аватар", type: "avatar_frame", emoji: null, cssEffect: "ring-2 ring-gray-800 shadow-xl shadow-gray-900/80", color: "#1f2937", rarity: "epic", price: 9000, category: "exclusive" },
        // Legendary
        { name: "Радужная Рамка", description: "Переливающаяся всеми цветами", type: "avatar_frame", emoji: null, cssEffect: "ring-3 ring-yellow-400 shadow-xl shadow-yellow-500/40 animate-pulse", color: "#fbbf24", rarity: "legendary", price: 30000, category: "limited" },
        { name: "Плазменная Рамка", description: "Кипящая плазма вокруг аватара", type: "avatar_frame", emoji: null, cssEffect: "ring-3 ring-cyan-400 shadow-xl shadow-cyan-400/60 animate-pulse", color: "#22d3ee", rarity: "legendary", price: 35000, category: "limited", maxOwners: 15 },
        { name: "Абсолютная Рамка", description: "Идеальная рамка для легенд", type: "avatar_frame", emoji: null, cssEffect: "ring-4 ring-amber-400 shadow-2xl shadow-amber-500/50 animate-pulse", color: "#f59e0b", rarity: "legendary", price: 50000, category: "limited", maxOwners: 5 },

        // ==================== SQUARE AVATAR FRAMES (10 items) ====================
        // Common
        { name: "Квадрат Простой", description: "Квадратная тонкая рамка", type: "avatar_frame", emoji: null, cssEffect: "rounded-lg ring-1 ring-white/30", color: "#e2e8f0", rarity: "common", price: 500, category: "general" },
        { name: "Квадрат Синий", description: "Квадратная синяя обводка", type: "avatar_frame", emoji: null, cssEffect: "rounded-lg ring-2 ring-blue-500/50", color: "#3b82f6", rarity: "common", price: 600, category: "general" },
        // Uncommon
        { name: "Квадрат Молнии", description: "Квадрат с электрическими искрами", type: "avatar_frame", emoji: null, cssEffect: "rounded-lg ring-2 ring-yellow-400 shadow-md shadow-yellow-500/30", color: "#eab308", rarity: "uncommon", price: 1500, category: "general" },
        { name: "Квадрат Ледяной", description: "Квадратная замороженная обводка", type: "avatar_frame", emoji: null, cssEffect: "rounded-lg ring-2 ring-cyan-400 shadow-md shadow-cyan-500/30", color: "#22d3ee", rarity: "uncommon", price: 1500, category: "general" },
        // Rare
        { name: "Квадрат Огненный", description: "Квадратная рамка в кольце пламени", type: "avatar_frame", emoji: null, cssEffect: "rounded-lg ring-2 ring-orange-500 shadow-lg shadow-orange-500/50", color: "#f97316", rarity: "rare", price: 4000, category: "general" },
        { name: "Квадрат Алмазный", description: "Квадратная сверкающая алмазная обводка", type: "avatar_frame", emoji: null, cssEffect: "rounded-lg ring-2 ring-cyan-300 shadow-lg shadow-cyan-400/50", color: "#67e8f9", rarity: "rare", price: 5000, category: "general" },
        // Epic
        { name: "Квадрат Космический", description: "Квадратная мерцающая галактическая рамка", type: "avatar_frame", emoji: null, cssEffect: "rounded-lg ring-2 ring-purple-500 shadow-lg shadow-purple-500/50 animate-pulse", color: "#a855f7", rarity: "epic", price: 12000, category: "exclusive" },
        { name: "Квадрат Неоновый", description: "Квадратный яркий неоновый контур", type: "avatar_frame", emoji: null, cssEffect: "rounded-lg ring-2 ring-emerald-400 shadow-lg shadow-emerald-400/60 animate-pulse", color: "#34d399", rarity: "epic", price: 10000, category: "exclusive" },
        // Legendary
        { name: "Квадрат Радужный", description: "Квадратная переливающаяся рамка", type: "avatar_frame", emoji: null, cssEffect: "rounded-lg ring-3 ring-yellow-400 shadow-xl shadow-yellow-500/40 animate-pulse", color: "#fbbf24", rarity: "legendary", price: 30000, category: "limited" },
        { name: "Квадрат Абсолют", description: "Квадратная идеальная рамка для легенд", type: "avatar_frame", emoji: null, cssEffect: "rounded-lg ring-4 ring-amber-400 shadow-2xl shadow-amber-500/50 animate-pulse", color: "#f59e0b", rarity: "legendary", price: 50000, category: "limited", maxOwners: 5 },

        // ==================== PROFILE EFFECTS (15 items) ====================
        // Common
        { name: "Искры", description: "Лёгкие искорки на профиле", type: "profile_effect", emoji: "✨", cssEffect: "sparkle-subtle", color: "#fbbf24", rarity: "common", price: 700, category: "general" },
        { name: "Снегопад", description: "Снежинки падают по профилю", type: "profile_effect", emoji: "❄️", cssEffect: "snow-fall", color: "#bae6fd", rarity: "common", price: 700, category: "seasonal" },
        { name: "Листопад", description: "Осенние листья кружатся", type: "profile_effect", emoji: "🍂", cssEffect: "leaves-fall", color: "#d97706", rarity: "common", price: 600, category: "seasonal" },
        // Uncommon
        { name: "Пузыри", description: "Лёгкие пузырьки поднимаются вверх", type: "profile_effect", emoji: "🫧", cssEffect: "bubbles-rise", color: "#06b6d4", rarity: "uncommon", price: 1500, category: "general" },
        { name: "Звёздный Дождь", description: "Звёздочки летят по диагонали", type: "profile_effect", emoji: "⭐", cssEffect: "star-rain", color: "#fbbf24", rarity: "uncommon", price: 2000, category: "general" },
        { name: "Лепестки Сакуры", description: "Розовые лепестки кружатся в воздухе", type: "profile_effect", emoji: "🌸", cssEffect: "sakura-petals", color: "#f9a8d4", rarity: "uncommon", price: 2000, category: "seasonal" },
        // Rare
        { name: "Огненные Частицы", description: "Пылающие угольки вокруг профиля", type: "profile_effect", emoji: "🔥", cssEffect: "fire-particles", color: "#ef4444", rarity: "rare", price: 5000, category: "general" },
        { name: "Электрические Разряды", description: "Молнии проскакивают по профилю", type: "profile_effect", emoji: "⚡", cssEffect: "electric-sparks", color: "#60a5fa", rarity: "rare", price: 5000, category: "general" },
        { name: "Матрица", description: "Зелёный код падает как в Матрице", type: "profile_effect", emoji: "🟢", cssEffect: "matrix-rain", color: "#22c55e", rarity: "rare", price: 4000, category: "general" },
        // Epic
        { name: "Вихрь Энергии", description: "Мощный энергетический вихрь", type: "profile_effect", emoji: "🌀", cssEffect: "energy-vortex", color: "#818cf8", rarity: "epic", price: 10000, category: "exclusive" },
        { name: "Северное Сияние", description: "Аврора бореалис на вашем профиле", type: "profile_effect", emoji: "🌌", cssEffect: "aurora-borealis", color: "#34d399", rarity: "epic", price: 12000, category: "exclusive" },
        { name: "Тёмная Магия", description: "Тёмные руны парят вокруг", type: "profile_effect", emoji: "🔮", cssEffect: "dark-magic", color: "#7c3aed", rarity: "epic", price: 11000, category: "exclusive" },
        // Legendary
        { name: "Галактика", description: "Целая галактика вращается позади", type: "profile_effect", emoji: "🌠", cssEffect: "galaxy-spin", color: "#a855f7", rarity: "legendary", price: 35000, category: "limited" },
        { name: "Солнечная Вспышка", description: "Ослепительная солнечная энергия", type: "profile_effect", emoji: "☀️", cssEffect: "solar-flare", color: "#f59e0b", rarity: "legendary", price: 40000, category: "limited", maxOwners: 10 },
        { name: "Апокалипсис", description: "Хаос и разрушение — для истинных злодеев", type: "profile_effect", emoji: "💀", cssEffect: "apocalypse", color: "#dc2626", rarity: "legendary", price: 80000, category: "limited", maxOwners: 3 },

        // ==================== BANNERS (10 items) ====================
        // Uncommon
        { name: "Закат Пустыни", description: "Тёплые оранжевые тона заката", type: "banner", emoji: "🌅", cssEffect: "linear-gradient(135deg, #f97316, #dc2626)", color: "#f97316", rarity: "uncommon", price: 2000, category: "general" },
        { name: "Ночное Небо", description: "Тёмно-синее звёздное небо", type: "banner", emoji: "🌃", cssEffect: "linear-gradient(135deg, #1e3a5f, #0f172a)", color: "#1e3a5f", rarity: "uncommon", price: 2000, category: "general" },
        { name: "Весенний Луг", description: "Свежая зелень весеннего поля", type: "banner", emoji: "🌿", cssEffect: "linear-gradient(135deg, #22c55e, #059669)", color: "#22c55e", rarity: "uncommon", price: 2000, category: "seasonal" },
        // Rare
        { name: "Киберпанк Город", description: "Неоновые огни ночного мегаполиса", type: "banner", emoji: "🏙️", cssEffect: "linear-gradient(135deg, #06b6d4, #7c3aed, #ec4899)", color: "#06b6d4", rarity: "rare", price: 5000, category: "general" },
        { name: "Лавовый Поток", description: "Расплавленная лава течёт вниз", type: "banner", emoji: "🌋", cssEffect: "linear-gradient(135deg, #ef4444, #f97316, #450a0a)", color: "#ef4444", rarity: "rare", price: 5000, category: "general" },
        // Epic
        { name: "Северное Сияние", description: "Магические огни в полярном небе", type: "banner", emoji: "🌌", cssEffect: "linear-gradient(135deg, #059669, #06b6d4, #7c3aed)", color: "#059669", rarity: "epic", price: 12000, category: "exclusive" },
        { name: "Чёрная Бездна", description: "Глубже, чем сама тьма", type: "banner", emoji: "🕳️", cssEffect: "linear-gradient(135deg, #030712, #1f2937, #030712)", color: "#030712", rarity: "epic", price: 10000, category: "exclusive" },
        { name: "Розовый Рассвет", description: "Нежные краски восходящего солнца", type: "banner", emoji: "🌄", cssEffect: "linear-gradient(135deg, #fda4af, #f472b6, #c084fc)", color: "#fda4af", rarity: "epic", price: 11000, category: "exclusive" },
        // Legendary
        { name: "Хроматик", description: "Переливающийся всеми цветами баннер", type: "banner", emoji: "🎨", cssEffect: "linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ec4899); background-size: 200%;", color: "#ef4444", rarity: "legendary", price: 50000, category: "limited", maxOwners: 10 },
        { name: "Вселенная", description: "Бескрайний космос у тебя на профиле", type: "banner", emoji: "🪐", cssEffect: "linear-gradient(135deg, #0f0520, #1e1b4b, #312e81, #1e1b4b, #0f0520); background-size: 200%;", color: "#312e81", rarity: "legendary", price: 60000, category: "limited", maxOwners: 7 },
      ];

      const toInsert = defaultDecorations.filter(d => !existingNames.has(d.name));
      if (toInsert.length > 0) {
        console.log(`[Production] Inserting ${toInsert.length} new decorations...`);
        for (const d of toInsert) {
          try {
            await db.insert(profileDecorations).values(d as any);
          } catch (e) {
            console.error(`[Production] Error inserting decoration ${d.name}:`, e);
          }
        }
        console.log(`[Production] Done. Total decorations: ${existingDecorations.length + toInsert.length}`);
      } else {
        console.log(`[Production] All ${existingDecorations.length} decorations already exist.`);
      }
    }
  } catch (error) {
    console.error("[Production] Error ensuring initial data:", error);
  }
}
