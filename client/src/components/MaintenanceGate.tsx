import { useQuery } from "@tanstack/react-query";
import { Construction, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

type PageAvailabilityMap = Record<string, {
  isEnabled: boolean;
  titleRu: string | null;
  titleEn: string | null;
  messageRu: string | null;
  messageEn: string | null;
}>;

interface MaintenanceGateProps {
  pageId: string;
  children: React.ReactNode;
}

export function MaintenanceGate({ pageId, children }: MaintenanceGateProps) {
  const { language } = useLanguage();
  
  const { data: availability, isLoading } = useQuery<PageAvailabilityMap>({
    queryKey: ["/api/page-availability"],
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="glass-card w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const pageStatus = availability?.[pageId];
  
  if (!pageStatus || pageStatus.isEnabled) {
    return <>{children}</>;
  }

  const title = language === 'ru' 
    ? (pageStatus.titleRu || 'Технические работы')
    : (pageStatus.titleEn || 'Under Maintenance');
    
  const message = language === 'ru'
    ? (pageStatus.messageRu || 'Страница временно недоступна. Ведутся технические работы.')
    : (pageStatus.messageEn || 'Page temporarily unavailable. Under maintenance.');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="glass-card w-full max-w-2xl border-orange-500/20" data-testid="maintenance-screen">
        <CardHeader>
          <CardTitle className="text-3xl md:text-4xl font-bold neon-text-orange flex items-center gap-3">
            <Construction className="h-8 w-8 md:h-10 md:w-10" />
            {title}
          </CardTitle>
          <CardDescription className="text-lg">
            {language === 'ru' 
              ? 'Эта страница временно недоступна' 
              : 'This page is temporarily unavailable'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="glass-card p-6 rounded-lg border border-orange-500/20">
            <div className="flex gap-4">
              <AlertCircle className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
              <div className="space-y-2">
                <p className="text-lg font-medium text-foreground">{message}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ru'
                    ? 'Пожалуйста, попробуйте позже. Приносим извинения за неудобства.'
                    : 'Please try again later. We apologize for any inconvenience.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="animate-pulse flex space-x-2">
              <div className="h-3 w-3 bg-orange-500 rounded-full"></div>
              <div className="h-3 w-3 bg-orange-500 rounded-full animation-delay-200"></div>
              <div className="h-3 w-3 bg-orange-500 rounded-full animation-delay-400"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
