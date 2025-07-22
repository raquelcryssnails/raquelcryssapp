
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"; // Added CardFooter and CardDescription
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, Trash2, Loader2, BellRing, Info, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { formatDistanceToNow, parseISO, isValid, format } from "date-fns"; // Added format
import { ptBR } from "date-fns/locale";
import type { ClientNotification } from "@/types/firestore";
import { getClientNotificationsFS, markClientNotificationAsReadFS, clearReadClientNotificationsFS } from "@/lib/firebase/firestoreService";
import { useClientAuth } from "@/contexts/ClientAuthContext";

const notificationIcons: Record<ClientNotification["type"], React.ElementType> = {
  info: Info,
  success: CheckCircle2,
  promo: Sparkles,
  warning: AlertTriangle,
  alert: AlertTriangle, // Alert for client might be same as warning
};

const notificationColors: Record<ClientNotification["type"], string> = {
  info: "border-blue-500",
  success: "border-green-500",
  promo: "border-purple-500",
  warning: "border-yellow-500",
  alert: "border-red-500",
};

export default function ClientNotificacoesPage() {
  const { currentClient, isLoadingClient } = useClientAuth();
  const [notifications, setNotifications] = React.useState<ClientNotification[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const { toast } = useToast();

  const fetchNotifications = React.useCallback(async (clientId: string) => {
    setIsLoading(true);
    try {
      const fetchedNotifications = await getClientNotificationsFS(clientId);
      setNotifications(fetchedNotifications);
    } catch (error) {
      console.error("Error fetching client notifications:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar suas notificações." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (currentClient?.id) {
      fetchNotifications(currentClient.id);
    } else if (!isLoadingClient) {
      // If loading is done and there's no client, stop loading the page.
      setIsLoading(false);
    }
  }, [currentClient, isLoadingClient, fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    if (!currentClient?.id) return;
    setIsUpdating(true);
    try {
      await markClientNotificationAsReadFS(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível marcar a notificação como lida." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearRead = async () => {
    if (!currentClient?.id) return;
    setIsUpdating(true);
    try {
      await clearReadClientNotificationsFS(currentClient.id);
      await fetchNotifications(currentClient.id);
      toast({ title: "Limpeza Concluída", description: "Notificações lidas foram removidas." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível limpar as notificações." });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading || isLoadingClient) {
    return (
      <div className="container mx-auto max-w-3xl py-8 px-4 sm:px-6 lg:px-8 flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!currentClient) {
     return (
        <div className="container mx-auto max-w-3xl py-8 px-4 sm:px-6 lg:px-8 text-center">
            <p className="font-body text-muted-foreground">Faça login para ver suas notificações.</p>
             <Button asChild className="mt-4"><Link href="/client/login">Ir para Login</Link></Button>
        </div>
     );
  }
  
  const readCount = notifications.filter(n => n.read).length;

  return (
    <div className="container mx-auto max-w-3xl py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      <Card className="shadow-lg rounded-xl">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="font-headline text-2xl text-gradient flex items-center gap-3">
              <BellRing className="h-7 w-7 text-primary" />
              Minhas Notificações
            </CardTitle>
            <CardDescription className="font-body">
              Avisos importantes e promoções exclusivas para você.
            </CardDescription>
          </div>
           <div className="flex flex-col sm:flex-row gap-2 items-center w-full md:w-auto">
             <Button onClick={handleClearRead} variant="destructive" disabled={isUpdating || readCount === 0} className="w-full sm:w-auto font-body">
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Limpar Lidas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="font-body text-muted-foreground text-lg">
                Nenhuma notificação por aqui.
              </p>
              <p className="font-body text-muted-foreground">
                Quando tivermos novidades, você as verá aqui!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map(notification => {
                const Icon = notificationIcons[notification.type] || Bell;
                const date = typeof notification.createdAt === 'string' && isValid(parseISO(notification.createdAt)) ? parseISO(notification.createdAt) : null;

                const notificationContent = (
                   <Card
                      className={cn(
                        "overflow-hidden transition-colors border-l-4",
                        notificationColors[notification.type],
                        notification.read ? "bg-muted/30 opacity-70" : "bg-card shadow-sm",
                        notification.linkTo && "cursor-pointer hover:bg-muted/50"
                      )}
                    >
                      <CardHeader className="flex-row items-start gap-4 p-4 pb-2">
                          <Icon className={cn("h-6 w-6 mt-1 flex-shrink-0", notificationColors[notification.type].replace('border-', 'text-'))} />
                          <div className="flex-grow">
                              <CardTitle className="font-headline text-base font-semibold text-card-foreground">{notification.title}</CardTitle>
                              {date && (
                                  <CardDescription className="font-body text-xs text-muted-foreground/80 mt-1" title={format(date, "PPP p", { locale: ptBR })}>
                                      {formatDistanceToNow(date, { addSuffix: true, locale: ptBR })}
                                  </CardDescription>
                              )}
                          </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 pl-14">
                        <p className="font-body text-sm text-muted-foreground">{notification.description}</p>
                      </CardContent>
                      {!notification.read && (
                          <CardFooter className="p-2 pt-2 border-t flex justify-end">
                              <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMarkAsRead(notification.id); }}
                                  disabled={isUpdating}
                                  className="font-body text-xs text-primary"
                              >
                                  <CheckCheck className="mr-2 h-4 w-4"/> Marcar como lida
                              </Button>
                          </CardFooter>
                      )}
                  </Card>
                );

                return notification.linkTo ? (
                  <Link href={notification.linkTo} key={notification.id} className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-lg">
                     {notificationContent}
                  </Link>
                ) : (
                  <div key={notification.id} onClick={() => !notification.read && handleMarkAsRead(notification.id)} className="cursor-pointer rounded-lg">
                    {notificationContent}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
