import { useQuery } from "@tanstack/react-query";
import type { ClanMember } from "@shared/schema";

export function useMemberByDiscordId(discordId: string | null | undefined) {
  return useQuery<ClanMember>({
    queryKey: ["/api/members/by-discord", discordId],
    enabled: !!discordId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function getMemberAvatarUrl(member: ClanMember | undefined | null, discordId: string | null | undefined): string {
  if (member?.avatar) {
    return member.avatar;
  }
  
  if (discordId) {
    const defaultAvatar = parseInt(discordId) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`;
  }
  
  return "";
}

export function getMemberDisplayName(member: ClanMember | undefined | null, fallbackUsername?: string): string {
  if (member?.username) {
    return member.username;
  }
  
  if (fallbackUsername) {
    return fallbackUsername;
  }
  
  return "Неизвестный пользователь";
}
