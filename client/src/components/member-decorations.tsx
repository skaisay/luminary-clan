import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type DecorationData = {
  emoji: string | null;
  type: string;
  color: string | null;
  name: string;
  rarity: string;
};

type AllEquippedDecorations = Record<string, DecorationData[]>;

const rarityGlow: Record<string, string> = {
  common: "",
  uncommon: "drop-shadow(0 0 2px rgba(34,197,94,0.5))",
  rare: "drop-shadow(0 0 3px rgba(59,130,246,0.6))",
  epic: "drop-shadow(0 0 4px rgba(168,85,247,0.7))",
  legendary: "drop-shadow(0 0 5px rgba(245,158,11,0.8))",
};

export function useAllDecorations() {
  return useQuery<AllEquippedDecorations>({
    queryKey: ["/api/decorations/all-equipped"],
    staleTime: 5000,
    refetchInterval: 30000,
    refetchOnMount: 'always' as const,
  });
}

export function MemberDecorations({ discordId, decorations }: { 
  discordId?: string | null; 
  decorations?: AllEquippedDecorations;
}) {
  if (!discordId || !decorations || !decorations[discordId]) return null;
  
  const memberDecs = decorations[discordId];
  if (memberDecs.length === 0) return null;
  
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {memberDecs.map((dec, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <span
              className="inline-block text-sm cursor-default transition-transform hover:scale-125"
              style={{ 
                filter: rarityGlow[dec.rarity] || undefined,
                color: dec.color || undefined,
              }}
            >
              {dec.emoji || "✦"}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {dec.name}
          </TooltipContent>
        </Tooltip>
      ))}
    </span>
  );
}
