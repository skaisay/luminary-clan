import { User2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMemberByDiscordId, getMemberAvatarUrl, getMemberDisplayName } from "@/hooks/use-member-data";

interface MemberAvatarProps {
  discordId: string | null | undefined;
  fallbackUsername?: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  showDiscordId?: boolean;
}

export function MemberAvatar({
  discordId,
  fallbackUsername,
  size = "md",
  showName = false,
  showDiscordId = false,
}: MemberAvatarProps) {
  const { data: member } = useMemberByDiscordId(discordId);
  
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };
  
  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };
  
  const avatarUrl = getMemberAvatarUrl(member, discordId);
  const displayName = getMemberDisplayName(member, fallbackUsername);
  
  if (!showName) {
    return (
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={avatarUrl} alt={displayName} />
        <AvatarFallback>
          <User2 className={iconSizes[size]} />
        </AvatarFallback>
      </Avatar>
    );
  }
  
  return (
    <div className="flex items-center gap-3">
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={avatarUrl} alt={displayName} />
        <AvatarFallback>
          <User2 className={iconSizes[size]} />
        </AvatarFallback>
      </Avatar>
      <div>
        <p className="font-medium">{displayName}</p>
        {showDiscordId && discordId && (
          <p className="text-xs text-muted-foreground">Discord ID: {discordId}</p>
        )}
      </div>
    </div>
  );
}
