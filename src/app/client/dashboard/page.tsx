
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/contexts/ClientAuthContext";
import { Loader2, Gift, Heart, Circle, Paintbrush2, Star, Eye, EyeOff, UserCircle, Instagram } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { getAppointmentsFS, getServicesFS, type Appointment, type SalonService } from "@/lib/firebase/firestoreService";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSettings } from "@/contexts/SettingsContext";


const stampsNeededForHeart = 3;
const heartsNeededForMimo = 1;
const totalStampsOnCard = 12;

const cardColorPalette = {
    bg: 'bg-pink-50 dark:bg-pink-900/30',
    border: 'border-pink-500',
    accentText: 'text-pink-600 dark:text-pink-400',
    heartFill: 'fill-pink-500',
    heartEmpty: 'text-pink-200',
    mimoFill: 'fill-purple-500',
    mimoEmpty: 'text-purple-200',
    pawFill: 'text-pink-500 fill-pink-500'
};

const appointmentStatusStyles: Record<Appointment["status"], string> = {
  Agendado: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700",
  Confirmado: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700",
  Concluído: "bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-900/50 dark:text-pink-300 dark:border-pink-700",
  Cancelado: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700",
};

// Custom Animated Icons
const AnimatedSparklesIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("animate-slow-pulse", className)}>
    <defs>
      <linearGradient id="sparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
    </defs>
    <path d="M12 2.5l1.09 2.72L16 6.31l-2.18 2.18L14.91 11.5 12 10.09 9.09 11.5l1.09-3.01L8 6.31l2.91-1.09L12 2.5zM6.5 8.5l.73 1.82L9 10.81l-1.46 1.45L8.09 14.5 6.5 13.59 4.91 14.5l.73-2.01L4 10.81l1.82-.73L6.5 8.5zm11 0l.73 1.82L20 10.81l-1.46 1.45L19.09 14.5 17.5 13.59 15.91 14.5l.73-2.01L15 10.81l1.82-.73L17.5 8.5z" fill="url(#sparkleGrad)" stroke="none"/>
  </svg>
);

const AnimatedWhatsAppIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={cn("group-hover:scale-110 transition-transform duration-200", className)}>
     <path fill="#4ADE80" d="M12 2C6.477 2 2 6.477 2 12c0 1.952.571 3.766 1.558 5.334L2.05 22l4.82-1.502A9.944 9.944 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
    <path fill="#FFFFFF" d="M16.488 14.032c-.172-.086-1.02-.504-1.178-.562c-.158-.058-.273-.086-.388.086c-.116.172-.445.562-.547.677c-.102.115-.204.13-.377.043c-.172-.086-1.282-.47-2.44-1.503c-.9-.79-1.508-1.763-1.68-2.058c-.172-.295-.018-.445.07-.59c.077-.13.172-.22.258-.346c.086-.13.13-.215.2-.346c.07-.13.034-.24-.017-.327c-.05-.086-.388-.93-.53-1.277c-.142-.346-.285-.295-.388-.3c-.102-.004-.217-.004-.332-.004c-.116 0-.303.043-.46.216c-.158.172-.604.588-.604 1.424c0 .836.62 1.653.705 1.768c.086.115 1.225 1.87 3.003 2.64c1.778.77 1.778.514 2.1.485c.324-.028 1.02-.416 1.162-.818c.142-.402.142-.743.1-.818c-.042-.075-.158-.122-.33-.208z"/>
  </svg>
);

const AnimatedHistoryIcon = ({ className }: { className?: string }) => (
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={cn("group", className)}>
     <path fill="#818CF8" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8s8 3.58 8 8s-3.58 8-8 8z"/>
     <path className="animate-spin-on-hover" style={{ transformOrigin: '12px 12px' }} fill="#A5B4FC" d="M12.5 7H11v6l5.25 3.15l.75-1.23l-4.5-2.67z"/>
   </svg>
);

export default function ClientDashboardPage() {
  const { currentClient, isLoadingClient } = useClientAuth();
  const { toast } = useToast();
  const [clientAppointments, setClientAppointments] = React.useState<Appointment[]>([]);
  const [servicesList, setServicesList] = React.useState<SalonService[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = React.useState(true);
  const [showAppointments, setShowAppointments] = React.useState(true); 
  const { salonPhone, whatsappSchedulingMessage, salonName, stampValidityMessage } = useSettings();

  React.useEffect(() => {
    let isMounted = true;

    const fetchClientData = async () => {
      if (currentClient && currentClient.name) {
        if (isMounted) setIsLoadingAppointments(true);
        try {
          const [allAppointments, allServices] = await Promise.all([
            getAppointmentsFS(),
            getServicesFS()
          ]);

          if (isMounted) {
            const filteredAppointments = allAppointments.filter(
              (apt) => apt.clientName.toLowerCase() === currentClient.name.toLowerCase()
            );
            
            filteredAppointments.sort((a, b) => {
              const statusOrder = (status: Appointment["status"]) => {
                  if (status === "Concluído" || status === "Cancelado") return 1;
                  return 0;
              };
              const aStatusOrder = statusOrder(a.status);
              const bStatusOrder = statusOrder(b.status);

              if (aStatusOrder !== bStatusOrder) {
                  return aStatusOrder - bStatusOrder;
              }
              
              const dateA = parseISO(a.date + 'T' + a.startTime);
              const dateB = parseISO(b.date + 'T' + b.startTime);
              if (isValid(dateA) && isValid(dateB)) {
                   return dateB.getTime() - dateA.getTime(); 
              }
              return 0;
            });

            setClientAppointments(filteredAppointments);
            setServicesList(allServices);
          }
        } catch (error) {
          if (isMounted) {
            console.error("Error fetching client appointments or services:", error);
            toast({ variant: "destructive", title: "Erro ao Carregar Agendamentos", description: "Não foi possível buscar seus agendamentos." });
          }
        } finally {
          if (isMounted) {
            setIsLoadingAppointments(false);
          }
        }
      } else {
        if (isMounted) {
          setIsLoadingAppointments(false);
          setClientAppointments([]);
          setServicesList([]);
        }
      }
    };

    if (!isLoadingClient) { 
        fetchClientData();
    }

    return () => {
      isMounted = false;
    };
  }, [currentClient, isLoadingClient, toast]);

  const getServiceNames = (serviceIds: string[]): string => {
    if (!servicesList || servicesList.length === 0) return "Serviços...";
    const names = serviceIds.map(id => {
      const service = servicesList.find(s => s.id === id);
      return service ? service.name : "Desconhecido";
    });
    if (names.length > 1) return `${names[0]} (+${names.length - 1})`;
    return names[0] || "Nenhum serviço";
  };


  if (isLoadingClient || (!currentClient && !isLoadingClient)) { 
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="font-body text-muted-foreground">
          {isLoadingClient ? "Carregando seus dados..." : "Por favor, faça login para acessar seu painel."}
        </p>
      </div>
    );
  }
  
  if (!currentClient) { 
     return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-4 text-center">
        <UserCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="font-body text-destructive-foreground">
          Não foi possível carregar seu perfil de cliente. Tente fazer login novamente.
        </p>
         <Button asChild className="mt-4"><Link href="/client/login">Ir para Login</Link></Button>
      </div>
    );
  }


  const { name, stampsEarned = 0, mimosRedeemed = 0 } = currentClient;
  const stampsForDisplay = stampsEarned > 0 ? (stampsEarned - 1) % totalStampsOnCard + 1 : 0;
  const heartsEarned = Math.floor(stampsEarned / stampsNeededForHeart);
  const mimosTotalEarnedByClient = Math.floor(heartsEarned / heartsNeededForMimo);
  const mimosAvailableForClient = mimosTotalEarnedByClient - mimosRedeemed;

  const handleRedeemMimo = () => {
    if (!currentClient || mimosAvailableForClient <= 0) {
      return;
    }
    toast({
      title: "Mimo Disponível para Resgate!",
      description: "Parabéns! Fale com sua Nail Designer para resgatar sua recompensa na sua próxima visita.",
    });
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      <Card className="shadow-xl rounded-xl border border-border overflow-hidden">
        <CardHeader className="bg-card/50 p-6">
          <CardTitle className="font-headline text-3xl flex items-center gap-2">
            <span className="text-gradient">Olá, {name}!</span>
            <AnimatedSparklesIcon className="h-7 w-7" />
          </CardTitle>
          <CardDescription className="font-body text-lg text-muted-foreground">
            Bem-vindo(a) ao seu espaço de beleza e bem-estar no {salonName || "Raquel Cryss Nails Design"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div>
                <h3 className="font-headline text-xl text-primary mb-4">Seu Cartão Fidelidade</h3>
                <Card className={cn("shadow-md rounded-lg", cardColorPalette.bg, cardColorPalette.border, "border-t-4")}>
                    <CardHeader className="pb-3 pt-4">
                        <CardTitle className={cn("font-headline text-lg", cardColorPalette.accentText)}>{name}</CardTitle>
                        <CardDescription className="font-body text-xs">Seu progresso no programa de fidelidade</CardDescription>
                    </CardHeader>
                    <CardContent className="grid lg:grid-cols-5 gap-x-4 gap-y-3 text-sm">
                        <div className="lg:col-span-2 space-y-2">
                            <div>
                                <p className="font-body">Selos: <span className={cn("font-bold", cardColorPalette.accentText)}>{stampsForDisplay} / {totalStampsOnCard}</span></p>
                            </div>
                            <div className="space-y-1.5 pt-2 border-t border-border/50">
                                <p className="font-headline text-xs text-muted-foreground">Suas Recompensas:</p>
                                <div className="flex items-center gap-1.5">
                                <span className="font-body text-xs">Corações (<Heart className={cn("inline h-3 w-3", cardColorPalette.accentText)} />):</span>
                                    {Array.from({ length: heartsNeededForMimo }).map((_, i) => {
                                        let isHeartFilledInReward = false;
                                        if (mimosTotalEarnedByClient > 0 && stampsEarned >= totalStampsOnCard) {
                                            isHeartFilledInReward = true;
                                        } else {
                                            const heartsCountInCurrentMimoCycle = heartsEarned % heartsNeededForMimo;
                                            if (heartsCountInCurrentMimoCycle === 0 && heartsEarned > 0 && stampsEarned < totalStampsOnCard && stampsEarned > 0) {
                                                isHeartFilledInReward = true;
                                            } else {
                                                isHeartFilledInReward = i < heartsCountInCurrentMimoCycle;
                                            }
                                        }
                                        return ( <Heart key={`client-heart-reward-${i}`} className={cn("h-5 w-5", isHeartFilledInReward ? `${cardColorPalette.accentText} ${cardColorPalette.heartFill}` : cardColorPalette.heartEmpty )} /> );
                                    })}
                                </div>
                                <div className="flex items-center gap-1.5">
                                <span className="font-body text-xs">Mimos (<Gift className={cn("inline h-3 w-3", cardColorPalette.accentText)} />):</span>
                                    {Array.from({ length: Math.max(1, mimosTotalEarnedByClient) }).map((_, i) => (
                                        <Gift key={`client-mimo-reward-${i}`} className={cn("h-5 w-5", i < mimosTotalEarnedByClient ? `${cardColorPalette.mimoFill} ${cardColorPalette.accentText}` : cardColorPalette.mimoEmpty )} />
                                    ))}
                                </div>
                                <p className="font-body text-xs">Mimos Resgatados: <span className="font-medium">{mimosRedeemed}</span></p>
                                <p className="font-body text-xs">Mimos Disponíveis: <span className="font-bold text-green-600">{mimosAvailableForClient}</span></p>
                                <p className="font-body text-xs text-muted-foreground italic mt-2">
                                  {stampValidityMessage || "Atenção: Os mimos não são acumulativos! Use seu mimo disponível antes de completar o próximo cartão."}
                                </p>
                                {mimosAvailableForClient > 0 && (
                                    <Button
                                        onClick={handleRedeemMimo}
                                        size="sm"
                                        variant="outline"
                                        className="w-full mt-2 font-body text-xs bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200 hover:text-orange-800 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-800/40"
                                    >
                                        <Gift className="mr-1.5 h-3.5 w-3.5" />
                                        Resgatar Mimo
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="lg:col-span-3">
                        <p className="font-headline text-xs text-muted-foreground mb-1.5">Cartão de Selos:</p>
                            <div className="grid grid-cols-6 gap-1.5 p-2 border border-border/30 rounded-md bg-muted/20">
                            {Array.from({ length: totalStampsOnCard }).map((_, index) => {
                                const stampNumber = index + 1;
                                const isEarned = stampNumber <= stampsForDisplay;
                                const isMilestoneForHeart = stampNumber % stampsNeededForHeart === 0;

                                let slotClasses = "aspect-square rounded-lg flex items-center justify-center transition-all duration-300 transform hover:-translate-y-0.5 hover:scale-110 hover:shadow-xl";
                                let iconComponent;

                                if (isEarned) {
                                    slotClasses = cn(
                                        slotClasses,
                                        'shadow-lg border-2',
                                        cardColorPalette.bg.replace('bg-','bg-').replace('-50', '-200'), 
                                        cardColorPalette.border.replace('border-', 'border-').replace('-500', '-500')
                                    );
                                    if (isMilestoneForHeart) {
                                        slotClasses = cn(
                                            slotClasses, 
                                            'ring-2 ring-offset-2 ring-offset-background',
                                            cardColorPalette.border.replace('border-','ring-'), 
                                            'animate-pulse'
                                        );
                                        iconComponent = <Heart className={cn("h-5 w-5", cardColorPalette.accentText, cardColorPalette.heartFill)} />;
                                    } else {
                                        iconComponent = <Heart className={cn("h-5 w-5 animate-horizontal-spin", cardColorPalette.pawFill)} />;
                                    }
                                } else {
                                    slotClasses = cn(
                                        slotClasses, 
                                        "bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700 border-dashed shadow-inner"
                                    );
                                    if (isMilestoneForHeart) {
                                        slotClasses = cn(
                                            slotClasses, 
                                            "border-yellow-400 dark:border-yellow-600 bg-yellow-100/30 dark:bg-yellow-800/20"
                                        );
                                        iconComponent = <Star className="h-5 w-5 text-yellow-500 opacity-60" />;
                                    } else {
                                        iconComponent = <Circle className="h-5 w-5 text-gray-400 dark:text-gray-600 opacity-60" />;
                                    }
                                }
                                return ( <div key={`client-stamp-${stampNumber}`} className={slotClasses} title={`Selo ${stampNumber}`}> {iconComponent} </div> );
                            })}
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <div className="mt-8 text-center">
                    <a
                        href="https://www.instagram.com/raquel_cryss"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <Instagram className="h-7 w-7 text-pink-500 animate-slow-pulse" />
                        <p className="font-body text-md text-muted-foreground">Siga nossa arte: <span className="font-semibold text-foreground">@raquel_cryss</span></p>
                    </a>
                </div>
            </div>
            <div className="space-y-6">
                <Card className="bg-card/30">
                    <CardHeader>
                        <CardTitle className="font-headline text-md text-accent flex items-center gap-2">
                            <AnimatedSparklesIcon className="h-5 w-5" />
                            Próximos Passos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button asChild className="w-full bg-green-500 hover:bg-green-600 text-white font-body group">
                            <a
                                href={`https://wa.me/${(salonPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(whatsappSchedulingMessage || '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <AnimatedWhatsAppIcon className="mr-2 h-5 w-5" />
                                Agendar Horário via WhatsApp
                            </a>
                        </Button>
                    </CardContent>
                </Card>

                 <Card className="bg-card/30">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="font-headline text-md text-accent flex items-center gap-2">
                            <AnimatedHistoryIcon className="h-5 w-5" />
                            Meus Agendamentos
                        </CardTitle>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setShowAppointments(!showAppointments)}
                            className="font-body text-xs"
                        >
                            {showAppointments ? <EyeOff className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                            {showAppointments ? "Ocultar" : "Mostrar"}
                        </Button>
                    </CardHeader>
                    {showAppointments && (
                        <CardContent>
                            {isLoadingAppointments ? (
                                <div className="flex justify-center items-center py-4">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <p className="ml-2 font-body text-muted-foreground">Buscando seus agendamentos...</p>
                                </div>
                            ) : clientAppointments.length === 0 ? (
                                <p className="font-body text-sm text-muted-foreground text-center py-4">
                                    Você ainda não possui agendamentos.
                                </p>
                            ) : (
                                <div className="max-h-80 overflow-y-auto pr-2">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-card/80 backdrop-blur-sm">
                                            <TableRow>
                                                <TableHead className="font-body text-xs p-2">Data</TableHead>
                                                <TableHead className="font-body text-xs p-2">Serviço(s)</TableHead>
                                                <TableHead className="font-body text-xs p-2 text-right">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {clientAppointments.map(apt => (
                                                <TableRow key={apt.id}>
                                                    <TableCell className="font-body text-xs p-2">
                                                        {isValid(parseISO(apt.date)) ? format(parseISO(apt.date), "dd/MM/yy", { locale: ptBR }) : 'Data inválida'} às {apt.startTime}
                                                    </TableCell>
                                                    <TableCell className="font-body text-xs p-2">{getServiceNames(apt.serviceIds)}</TableCell>
                                                    <TableCell className="text-right p-2">
                                                        <Badge variant="outline" className={cn("text-xs", appointmentStatusStyles[apt.status])}>
                                                            {apt.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    )}
                </Card>
            </div>
          </div>
        </CardContent>
        <CardFooter className="p-6 bg-card/30 border-t border-border">
            <p className="text-sm text-muted-foreground font-body text-center w-full">
                Agradecemos a sua preferência! <Heart className="inline h-4 w-4 text-pink-500 animate-heartbeat" />
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
