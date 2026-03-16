import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type DecorationEntry = {
  emoji: string | null;
  type: string;
  color: string | null;
  name: string;
  rarity: string;
  cssEffect?: string | null;
};

type AllEquipped = Record<string, DecorationEntry[]>;

/**
 * Hook: fetch all equipped decorations (cached, shared across components)
 */
export function useEquippedDecorations() {
  return useQuery<AllEquipped>({
    queryKey: ["/api/decorations/all-equipped"],
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

const rarityGlow: Record<string, string> = {
  common: "",
  rare: "drop-shadow(0 0 4px var(--color))",
  epic: "drop-shadow(0 0 8px var(--color))",
  legendary: "drop-shadow(0 0 12px var(--color)) drop-shadow(0 0 20px var(--color))",
};

/**
 * Renders badge icons for a given discordId.
 * Place this next to usernames – it reads from the global cache.
 */
export function UserBadges({ discordId, className = "" }: { discordId: string; className?: string }) {
  const { data: allEquipped } = useEquippedDecorations();
  const badges = allEquipped?.[discordId]?.filter(d => d.type === "badge") || [];
  if (badges.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <span className={`inline-flex items-center gap-0.5 ${className}`}>
        {badges.map((b, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <span
                className="inline-flex text-sm cursor-default select-none transition-transform hover:scale-125"
                style={{
                  color: b.color || undefined,
                  filter: (rarityGlow[b.rarity] || "").replace(/var\(--color\)/g, b.color || "#fff"),
                }}
              >
                {b.emoji}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <span className="font-semibold" style={{ color: b.color || undefined }}>{b.name}</span>
              <span className="ml-1 text-muted-foreground capitalize">({b.rarity})</span>
            </TooltipContent>
          </Tooltip>
        ))}
      </span>
    </TooltipProvider>
  );
}

/**
 * Renders a username with name_color decoration applied (if any)
 */
export function StyledUsername({ discordId, username, className = "" }: { discordId: string; username: string; className?: string }) {
  const { data: allEquipped } = useEquippedDecorations();
  const nameColors = allEquipped?.[discordId]?.filter(d => d.type === "name_color") || [];
  const activeColor = nameColors[0]; // Use the first equipped name_color

  if (!activeColor) {
    return <span className={className}>{username}</span>;
  }

  // Parse cssEffect into style object
  const style: Record<string, string> = {};
  if (activeColor.cssEffect && activeColor.cssEffect.trim()) {
    activeColor.cssEffect.split(";").forEach((rule: string) => {
      const [prop, val] = rule.split(":").map((s: string) => s.trim());
      if (prop && val) {
        const camelProp = prop.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
        style[camelProp] = val;
      }
    });
  } else if (activeColor.color) {
    // Fallback: use plain color when no cssEffect (common name_colors)
    style.color = activeColor.color;
  }

  if (Object.keys(style).length === 0) {
    return <span className={className}>{username}</span>;
  }

  return <span className={className} style={style}>{username}</span>;
}

/**
 * Renders an avatar frame decoration around an element
 */
export function AvatarFrame({ discordId, children }: { discordId: string; children: React.ReactNode }) {
  const { data: allEquipped } = useEquippedDecorations();
  const frames = allEquipped?.[discordId]?.filter(d => d.type === "avatar_frame") || [];
  const frame = frames[0];

  if (!frame?.cssEffect) return <>{children}</>;

  // Auto-detect square frames (they include rounded-lg in cssEffect)
  const isSquare = frame.cssEffect.includes("rounded-lg");

  return (
    <div className={`relative ${frame.cssEffect} ${isSquare ? '' : 'rounded-full'}`}>
      {isSquare ? (
        <div style={{ borderRadius: '0.5rem' }} className="overflow-hidden [&_*]:!rounded-lg">
          {children}
        </div>
      ) : children}
    </div>
  );
}

/**
 * Get the equipped banner CSS gradient for a user (from decoration system)
 */
export function useEquippedBanner(discordId: string | undefined) {
  const { data: allEquipped } = useEquippedDecorations();
  if (!discordId || !allEquipped?.[discordId]) return null;
  const banners = allEquipped[discordId].filter(d => d.type === "banner");
  return banners[0] || null;
}
