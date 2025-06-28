
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, ArchiveX, CalendarCheck, UserPlus, PackageCheck, CheckCircle2, XCircle, Trash2, Loader2, BellRing, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { format, formatDistanceToNow, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Notification, ClientNotification } from "@/types/firestore";
import { getNotificationsFS, markNotificationAsReadFS, markAllNotificationsAsReadFS, clearReadNotificationsFS, addNotificationToAllClientsFS } from "@/lib/firebase/firestoreService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";


const notificationIcons: Record<Notification["type"], React.ElementType> = {
  info: CalendarCheck,
  success: CheckCircle2,
  warning: XCircle,
  alert: ArchiveX,
};

const notificationColors: Record<Notification["type"], string> = {
  info: "border-blue-500",
  success: "border-green-500",
  warning: "border-yellow-500",
  alert: "border-red-500",
};

const generalNotificationSchema = z.object({
  title: z.string().min(3, "Título deve ter pelo menos 3 caracteres.").max(50, "Título muito longo."),
  description: z.string().min(10, "Mensagem deve ter pelo menos 10 caracteres.").max(200, "Mensagem muito longa."),
  type: z.enum(['info', 'success', 'promo', 'warning']),
});
type GeneralNotificationFormValues = z.infer<typeof generalNotificationSchema>;


export default function NotificacoesPage() {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isGeneralModalOpen, setIsGeneralModalOpen] = React.useState(false);
  const [isSendingGeneral, setIsSendingGeneral] = React.useState(false);

  const { toast } = useToast();

  const generalNotificationForm = useForm<GeneralNotificationFormValues>({
    resolver: zodResolver(generalNotificationSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "promo",
    },
  });


  const fetchNotifications = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedNotifications = await getNotificationsFS();
      setNotifications(fetchedNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar as notificações." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    setIsUpdating(true);
    try {
      await markNotificationAsReadFS(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível marcar a notificação como lida." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsUpdating(true);
    try {
      await markAllNotificationsAsReadFS();
      await fetchNotifications(); // Refetch to get the updated list
      toast({ title: "Sucesso", description: "Todas as notificações foram marcadas como lidas." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível marcar todas como lidas." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearRead = async () => {
    setIsUpdating(true);
    try {
      await clearReadNotificationsFS();
      await fetchNotifications(); // Refetch to get the updated list
      toast({ title: "Limpeza Concluída", description: "Notificações lidas foram removidas." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível limpar as notificações." });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const onSubmitGeneralNotification = async (data: GeneralNotificationFormValues) => {
    setIsSendingGeneral(true);
    try {
        const result = await addNotificationToAllClientsFS({
            title: data.title,
            description: data.description,
            type: data.type,
        });

        if (result.success) {
             toast({ title: "Notificação Geral Enviada!", description: `${result.count} clientes foram notificados.` });
             generalNotificationForm.reset();
             setIsGeneralModalOpen(false);
        } else {
            throw new Error(result.error || "Erro desconhecido ao enviar notificação geral.");
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "Erro ao Enviar", description: error.message || "Não foi possível enviar a notificação para todos os clientes." });
    } finally {
        setIsSendingGeneral(false);
    }
  };


  const unreadCount = notifications.filter(n => !n.read).length;
  const readCount = notifications.filter(n => n.read).length;

  return (
    <div className="space-y-6">
      <Card className="shadow-lg rounded-xl">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="font-headline text-2xl text-gradient flex items-center gap-3">
              <BellRing className="h-7 w-7 text-primary" />
              Central de Notificações do Painel
            </CardTitle>
            <CardDescription className="font-body">
              Acompanhe as atualizações e alertas importantes do sistema.
            </CardDescription>
          </div>
           <div className="flex flex-col sm:flex-row gap-2 items-center w-full md:w-auto">
             <Dialog open={isGeneralModalOpen} onOpenChange={(isOpen) => {
                if (!isSendingGeneral) {
                    setIsGeneralModalOpen(isOpen);
                    if (!isOpen) generalNotificationForm.reset();
                }
             }}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto font-body border-primary text-primary hover:bg-primary/10">
                        <Send className="mr-2 h-4 w-4" /> Enviar Notificação Geral
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px] bg-card">
                    <DialogHeader>
                        <DialogTitle className="font-headline text-gradient">Enviar Notificação para Todos os Clientes</DialogTitle>
                        <DialogDescription className="font-body">
                            Esta mensagem será enviada para todos os clientes cadastrados. Use com moderação.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...generalNotificationForm}>
                        <form onSubmit={generalNotificationForm.handleSubmit(onSubmitGeneralNotification)} className="space-y-4 py-2">
                             <FormField
                                control={generalNotificationForm.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel className="font-body">Título</FormLabel>
                                    <FormControl><Input placeholder="Ex: Promoção de Inverno!" {...field} className="focus:ring-accent font-body"/></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={generalNotificationForm.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel className="font-body">Mensagem</FormLabel>
                                    <FormControl><Textarea placeholder="Descreva sua promoção ou aviso aqui..." {...field} className="focus:ring-accent font-body" rows={4}/></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={generalNotificationForm.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel className="font-body">Tipo de Notificação</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="focus:ring-accent font-body">
                                                <SelectValue placeholder="Selecione o tipo"/>
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="info" className="font-body">Informativo</SelectItem>
                                            <SelectItem value="success" className="font-body">Sucesso</SelectItem>
                                            <SelectItem value="promo" className="font-body">Promoção</SelectItem>
                                            <SelectItem value="warning" className="font-body">Aviso</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter className="pt-4">
                                <DialogClose asChild>
                                    <Button type="button" variant="outline" className="font-body">Cancelar</Button>
                                </DialogClose>
                                <Button type="submit" className="font-body bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSendingGeneral}>
                                    {isSendingGeneral ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                    {isSendingGeneral ? "Enviando..." : "Enviar para Todos"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
             </Dialog>
            <Button onClick={handleMarkAllAsRead} variant="outline" disabled={isUpdating || unreadCount === 0} className="w-full sm:w-auto font-body">
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />} Marcar como lidas
            </Button>
             <Button onClick={handleClearRead} variant="destructive" disabled={isUpdating || readCount === 0} className="w-full sm:w-auto font-body">
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Limpar Lidas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="font-body text-muted-foreground text-lg">
                Nenhuma notificação nova.
              </p>
              <p className="font-body text-muted-foreground">
                Quando algo importante acontecer, você verá aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map(notification => {
                const Icon = notificationIcons[notification.type] || Bell;
                const date = typeof notification.createdAt === 'string' && isValid(parseISO(notification.createdAt)) ? parseISO(notification.createdAt) : null;

                const notificationContent = (
                   <div
                      className={cn(
                        "flex items-start gap-4 p-4 rounded-lg border-l-4 transition-colors",
                        notificationColors[notification.type],
                        notification.read ? "bg-muted/30 opacity-70" : "bg-card",
                        notification.linkTo && "cursor-pointer hover:bg-muted/50"
                      )}
                    >
                      <Icon className={cn("h-6 w-6 mt-1 flex-shrink-0", notificationColors[notification.type].replace('border-', 'text-'))} />
                      <div className="flex-grow">
                        <p className="font-headline font-semibold text-card-foreground">{notification.title}</p>
                        <p className="font-body text-sm text-muted-foreground">{notification.description}</p>
                        {date && (
                          <p className="font-body text-xs text-muted-foreground/80 mt-1" title={format(date, "PPP p", { locale: ptBR })}>
                            {formatDistanceToNow(date, { addSuffix: true, locale: ptBR })}
                          </p>
                        )}
                      </div>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMarkAsRead(notification.id); }}
                          disabled={isUpdating}
                          className="self-center font-body text-xs text-primary"
                        >
                          Marcar como lida
                        </Button>
                      )}
                  </div>
                );

                return notification.linkTo ? (
                  <Link href={notification.linkTo} key={notification.id} className="focus:outline-none focus:ring-2 focus:ring-ring rounded-lg">
                     {notificationContent}
                  </Link>
                ) : (
                  <div key={notification.id}>{notificationContent}</div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
