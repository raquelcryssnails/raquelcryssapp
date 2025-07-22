
"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, PlusCircle, Users, Square, Columns3, View, Clock, CheckCircle2, XCircle, CalendarIcon as CalendarNavIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, format, startOfWeek, endOfWeek, eachDayOfInterval, subDays, isToday, parseISO, startOfDay, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getAppointmentsFS, deleteAppointmentFS, getProfessionalsFS } from "@/lib/firebase/firestoreService";
import type { Appointment, Professional } from "@/types/firestore";
import { useSettings } from "@/contexts/SettingsContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Award } from "lucide-react";


const statusStyles: Record<Appointment["status"], { icon: React.ElementType,bgColor: string, textColor: string, borderColor: string }> = {
  "Agendado": { icon: Clock, bgColor: "bg-blue-100 dark:bg-blue-900/50", textColor: "text-blue-700 dark:text-blue-300", borderColor: "border-blue-300 dark:border-blue-700" },
  "Confirmado": { icon: CheckCircle2, bgColor: "bg-green-100 dark:bg-green-900/50", textColor: "text-green-700 dark:text-green-300", borderColor: "border-green-300 dark:border-green-700" },
  "Concluído": { icon: Award, bgColor: "bg-pink-100 dark:bg-pink-900/50", textColor: "text-pink-700 dark:text-pink-300", borderColor: "border-pink-300 dark:border-pink-700" },
  "Cancelado": { icon: XCircle, bgColor: "bg-yellow-100 dark:bg-yellow-900/50", textColor: "text-yellow-700 dark:text-yellow-300", borderColor: "border-yellow-300 dark:border-yellow-700" },
};


type ViewMode = "daily" | "3days" | "weekly";


export default function AgendaPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [professionalsList, setProfessionalsList] = React.useState<Professional[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentDisplayDate, setCurrentDisplayDate] = React.useState(startOfDay(new Date()));
  const [selectedProfessional, setSelectedProfessional] = React.useState<string | "all">("all");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [appointmentToDeleteId, setAppointmentToDeleteId] = React.useState<string | null>(null);
  const [isCalendarPopoverOpen, setIsCalendarPopoverOpen] = React.useState(false); 
  
  const [viewMode, setViewMode] = React.useState<ViewMode>("weekly");
  const { toast } = useToast();
  const { openingHours } = useSettings();
  const router = useRouter();

  const timeSlots = React.useMemo(() => {
    if (!openingHours || openingHours.length === 0) {
      return Array.from({ length: (22 - 7) * 2 + 1 }, (_, i) => {
        const hour = 7 + Math.floor(i / 2);
        const minute = (i % 2) * 30;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      });
    }

    const timeToMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return 0;
      return h * 60 + m;
    };

    let minStartMinutes = 7 * 60; 
    let maxEndMinutes = 22 * 60;

    const openDays = openingHours.filter(d => d.isOpen && d.openTime && d.closeTime);
    if (openDays.length > 0) {
      minStartMinutes = Math.min(...openDays.map(d => timeToMinutes(d.openTime)));
      maxEndMinutes = Math.max(...openDays.map(d => timeToMinutes(d.closeTime)));
    }

    const slots = [];
    let currentTime = minStartMinutes;
    while (currentTime <= maxEndMinutes) {
      const hour = Math.floor(currentTime / 60);
      const minute = currentTime % 60;
      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      currentTime += 30;
    }

    return slots.length > 0 ? slots : Array.from({ length: (22 - 7) * 2 + 1 }, (_, i) => {
      const hour = 7 + Math.floor(i / 2);
      const minute = (i % 2) * 30;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    });
  }, [openingHours]);

  const fetchPageData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedAppointments, fetchedProfessionals] = await Promise.all([
        getAppointmentsFS(),
        getProfessionalsFS(),
      ]);
      setAppointments(fetchedAppointments);
      setProfessionalsList(fetchedProfessionals);

      if (selectedProfessional !== "all" && !fetchedProfessionals.find(p => p.id === selectedProfessional) && fetchedProfessionals.length > 0) {
        setSelectedProfessional(fetchedProfessionals[0].id);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: "destructive", title: "Erro ao buscar dados", description: "Não foi possível carregar os dados da agenda." });
    } finally {
      setIsLoading(false);
    }
  }, [toast, selectedProfessional]);

  React.useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);


  const weekStartsOn = 1;

  const daysInView = React.useMemo(() => {
    const start = viewMode === "weekly" ? startOfWeek(currentDisplayDate, { weekStartsOn }) : currentDisplayDate;
    const end = viewMode === "weekly" ? endOfWeek(currentDisplayDate, { weekStartsOn }) :
                viewMode === "3days" ? addDays(currentDisplayDate, 2) : currentDisplayDate;
    return eachDayOfInterval({ start, end });
  }, [currentDisplayDate, viewMode, weekStartsOn]);

  const handlePreviousPeriod = () => {
    const daysToSubtract = viewMode === "weekly" ? 7 : viewMode === "3days" ? 3 : 1;
    setCurrentDisplayDate(subDays(currentDisplayDate, daysToSubtract));
  };

  const handleNextPeriod = () => {
    const daysToAdd = viewMode === "weekly" ? 7 : viewMode === "3days" ? 3 : 1;
    setCurrentDisplayDate(addDays(currentDisplayDate, daysToAdd));
  };

  const handleToday = () => {
    setCurrentDisplayDate(startOfDay(new Date()));
  };

  const getAppointmentsForDay = React.useCallback((day: Date) => {
    return appointments.filter(
      (apt) => apt.date === format(day, "yyyy-MM-dd") && (selectedProfessional === "all" || apt.professionalId === selectedProfessional)
    );
  }, [appointments, selectedProfessional]);

  const handleSlotClick = (date: Date, startTime: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const professionalFilter = selectedProfessional !== 'all' ? `&professionalId=${selectedProfessional}` : '';
    router.push(`/agenda/novo?date=${dateStr}&startTime=${startTime}${professionalFilter}`);
  };

  const handleGridClick = (event: React.MouseEvent<HTMLDivElement>, day: Date, appointmentsOnDay: Appointment[]) => {
    if ((event.target as HTMLElement).closest('[data-appointment-card="true"]')) {
        return;
    }
    const gridElement = event.currentTarget;
    const rect = gridElement.getBoundingClientRect();
    const clickY = event.clientY - rect.top;
    const totalHeight = gridElement.offsetHeight;

    if (totalHeight === 0) return;

    const totalMinutesInGrid = timeSlots.length * 30;
    const minutesFromGridTop = (clickY / totalHeight) * totalMinutesInGrid;

    const [startHour, startMinute] = timeSlots[0].split(":").map(Number);
    const gridStartTotalMinutes = startHour * 60 + startMinute;

    const clickedTimeInMinutes = gridStartTotalMinutes + minutesFromGridTop;

    const roundedMinutes = Math.round(clickedTimeInMinutes);
    const finalHour = Math.floor(roundedMinutes / 60);
    const finalMinute = roundedMinutes % 60;
    
    const newStartTime = `${String(finalHour).padStart(2, '0')}:${String(finalMinute).padStart(2, '0')}`;

    const isOverlapping = appointmentsOnDay.some(apt => {
        if (!apt.startTime || !apt.endTime) return false;
        
        const timeToMinutes = (timeStr: string) => {
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        }

        const start = timeToMinutes(apt.startTime);
        const end = timeToMinutes(apt.endTime);
        const clicked = timeToMinutes(newStartTime);

        return clicked >= start && clicked < end;
    });

    if (isOverlapping) {
        toast({
            variant: "default",
            title: "Horário Ocupado",
            description: "Você clicou sobre um agendamento existente. Clique em um espaço vazio.",
        });
        return;
    }

    handleSlotClick(day, newStartTime);
  };


  const handleEditAppointment = (aptId: string) => {
    router.push(`/agenda/editar/${aptId}`);
  };

  const handleDeleteAppointment = (aptId: string) => {
    setAppointmentToDeleteId(aptId);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteAppointment = async () => {
    if (appointmentToDeleteId) {
        try {
            await deleteAppointmentFS(appointmentToDeleteId);
            toast({ title: "Agendamento Removido", description: "O agendamento foi removido." });
            fetchPageData();
        } catch (error) {
            console.error("Error deleting appointment:", error);
            toast({ variant: "destructive", title: "Erro ao remover", description: "Não foi possível remover o agendamento." });
        }
    }
    setAppointmentToDeleteId(null);
    setIsDeleteConfirmOpen(false);
  };
  
  const formatDateRange = () => {
    if (!daysInView.length) return "";
    const firstDay = daysInView[0];
    const lastDay = daysInView[daysInView.length - 1];

    if (viewMode === "daily") {
      return format(firstDay, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
    if (format(firstDay, "MMMM", { locale: ptBR }) === format(lastDay, "MMMM", { locale: ptBR })) {
      return `${format(firstDay, "d", { locale: ptBR })} - ${format(lastDay, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    }
    return `${format(firstDay, "d MMM", { locale: ptBR })} - ${format(lastDay, "d MMM, yyyy", { locale: ptBR })}`;
  };

  const todayButtonText = format(new Date(), "EEEE", { locale: ptBR });


  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-headline text-gradient">Agenda</h1>
            <p className="text-sm text-muted-foreground font-body">Visualize e gerencie seus compromissos e horários.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={viewMode === 'daily' ? 'default' : 'outline'} onClick={() => setViewMode('daily')} className={cn("font-body", viewMode === 'daily' && "bg-primary text-primary-foreground hover:bg-primary/90")}><Square className="mr-2 h-4 w-4" />Diário</Button>
          <Button variant={viewMode === '3days' ? 'default' : 'outline'} onClick={() => setViewMode('3days')} className={cn("font-body", viewMode === '3days' && "bg-primary text-primary-foreground hover:bg-primary/90")}><Columns3 className="mr-2 h-4 w-4" />3 Dias</Button>
          <Button variant={viewMode === 'weekly' ? 'default' : 'outline'} onClick={() => setViewMode('weekly')} className={cn("font-body", viewMode === 'weekly' && "bg-primary text-primary-foreground hover:bg-primary/90")}><View className="mr-2 h-4 w-4" />Semanal</Button>
          <Button asChild className="font-body bg-gradient-to-r from-primary to-accent text-accent-foreground hover:opacity-90">
            <Link href="/agenda/novo">
                <PlusCircle className="mr-2 h-4 w-4" /> Novo Agendamento
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-card rounded-lg shadow">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <Select value={selectedProfessional} onValueChange={(value) => setSelectedProfessional(value as string | "all")}>
            <SelectTrigger className="w-full md:w-[200px] font-body">
              <SelectValue placeholder="Todos Profissionais" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-body">Todos Profissionais</SelectItem>
              {professionalsList.length > 0 ? (
                professionalsList.map(prof => (
                  <SelectItem key={prof.id} value={prof.id} className="font-body">{prof.name}</SelectItem>
                ))
              ) : (
                <p className="p-2 text-sm text-center text-muted-foreground font-body">Nenhum profissional cadastrado</p>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 justify-center">
          <Button variant="outline" onClick={handlePreviousPeriod} size="icon"><ChevronLeft className="h-5 w-5" /></Button>
          <Button variant="outline" onClick={handleToday} className="font-body px-4 capitalize">{todayButtonText}</Button>

          <Popover open={isCalendarPopoverOpen} onOpenChange={setIsCalendarPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="font-body px-3">
                <CalendarNavIcon className="mr-2 h-4 w-4" /> Calendário
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={currentDisplayDate}
                onSelect={(date) => {
                  if (date) {
                    setCurrentDisplayDate(startOfDay(date));
                  }
                  setIsCalendarPopoverOpen(false);
                }}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" onClick={handleNextPeriod} size="icon"><ChevronRight className="h-5 w-5" /></Button>
        </div>
        <div className="text-center md:text-right">
          <p className="font-headline text-lg text-primary capitalize">
            {formatDateRange()}
          </p>
        </div>
      </div>

      <Card className="flex-grow shadow-lg rounded-xl overflow-hidden">
        {isLoading ? (
            <div className="flex justify-center items-center h-full"><p className="font-body text-muted-foreground p-8">Carregando agenda...</p></div>
        ) : (
        <div className={cn(
            "grid h-full",
            viewMode === "weekly" ? "grid-cols-[auto_repeat(7,1fr)]" :
            viewMode === "3days" ? "grid-cols-[auto_repeat(3,1fr)]" :
            "grid-cols-[auto_repeat(1,1fr)]"
          )}>
          <div className="col-start-1 border-r border-border bg-muted/30 dark:bg-muted/10">
            <div className="h-16 border-b border-border"></div>
            {timeSlots.map(slot => (
              <div key={slot} className="h-16 flex items-center justify-center text-xs font-body text-muted-foreground border-b border-border pr-2 text-right">
                {slot}
              </div>
            ))}
          </div>

          {daysInView.map((day, dayIndex) => {
            const appointmentsOnThisDay = getAppointmentsForDay(day);
            const dayOfWeekNumber = getDay(day);
            const daySettings = openingHours.find(oh => oh.dayOfWeek === dayOfWeekNumber);
            const isDayEffectivelyOpen = daySettings ? daySettings.isOpen : false;

            return (
            <div key={day.toString()} className={cn("border-r border-border", dayIndex === daysInView.length -1 && "border-r-0")}>
              <div className={cn(
                  "h-16 flex flex-col items-center justify-center border-b border-border sticky top-0 z-10",
                  isToday(day) ? "bg-primary/10 dark:bg-primary/20" : "bg-muted/30 dark:bg-muted/10"
                )}>
                <p className={cn("text-xs font-body uppercase", isToday(day) ? "text-primary font-bold" : "text-muted-foreground")}>
                  {format(day, "E", { locale: ptBR })}
                </p>
                <p className={cn("text-2xl font-headline", isToday(day) ? "text-primary" : "text-foreground")}>
                  {format(day, "d")}
                </p>
              </div>
              <div
                className="relative grid h-[calc(4rem_*_var(--time-slots-count))] cursor-pointer group"
                style={{ '--time-slots-count': timeSlots.length, gridTemplateRows: `repeat(${timeSlots.length}, 4rem)` } as React.CSSProperties}
                onClick={(e) => handleGridClick(e, day, appointmentsOnThisDay)}
              >
                 {timeSlots.map((slot, slotIdx) => {
                    let slotStyling = "relative border-b border-border/50 h-16 transition-colors duration-150 group-hover:bg-primary/5";
                    
                    const timeToSlotMinutes = (time: string) => {
                        const [h, m] = time.split(':').map(Number);
                        return h * 60 + m;
                    };
                    
                    if (isDayEffectivelyOpen && daySettings?.openTime && daySettings?.closeTime) {
                        const slotMinutes = timeToSlotMinutes(slot);
                        const openMinutes = timeToSlotMinutes(daySettings.openTime);
                        const closeMinutes = timeToSlotMinutes(daySettings.closeTime);
                        const isWithinOperatingHours = slotMinutes >= openMinutes && slotMinutes < closeMinutes;

                        if (!isWithinOperatingHours) {
                            slotStyling = cn(slotStyling, "bg-muted/20 dark:bg-white/5 opacity-50");
                        }
                    } else if (!isDayEffectivelyOpen) {
                        slotStyling = cn(slotStyling, "bg-red-50 dark:bg-red-900/20 opacity-60");
                    }

                    return (
                        <div key={`slot-${dayIndex}-${slotIdx}`} className={slotStyling}>
                        </div>
                    );
                 })}
                {appointmentsOnThisDay.map(apt => {
                  if (!apt.startTime || !apt.endTime || !timeSlots.length) return null;

                  const firstSlotTime = timeSlots[0];
                  const [startHour, startMinute] = firstSlotTime.split(":").map(Number);
                  if (isNaN(startHour) || isNaN(startMinute)) return null;
                  const gridStartMinutes = startHour * 60 + startMinute;
              
                  const [aptStartHour, aptStartMinute] = apt.startTime.split(":").map(Number);
                  const aptStartTotalMinutes = aptStartHour * 60 + aptStartMinute;
              
                  const [aptEndHour, aptEndMinute] = apt.endTime.split(":").map(Number);
                  const aptEndTotalMinutes = aptEndHour * 60 + aptEndMinute;
              
                  if (isNaN(aptStartTotalMinutes) || isNaN(aptEndTotalMinutes) || aptEndTotalMinutes <= aptStartTotalMinutes) {
                      return null;
                  }
              
                  const minutesFromGridStart = aptStartTotalMinutes - gridStartMinutes;
                  const durationInMinutes = aptEndTotalMinutes - aptStartTotalMinutes;
                  
                  const slotHeightRem = 4;
                  const remPerMinute = slotHeightRem / 30;
                  
                  const topRem = minutesFromGridStart * remPerMinute;
                  const heightRem = Math.max(remPerMinute * 15, durationInMinutes * remPerMinute);

                  const aptStyle = statusStyles[apt.status];
                  const AptIcon = aptStyle.icon;
                  const professional = professionalsList.find(p => p.id === apt.professionalId);
                  const serviceCount = apt.serviceIds.length;

                  return (
                    <div
                      key={apt.id}
                      data-appointment-card="true"
                      className={cn(
                        "absolute w-[calc(100%-4px)] ml-[2px] p-2 rounded-md shadow text-xs font-body overflow-hidden border-l-4 cursor-pointer",
                        aptStyle.bgColor,
                        aptStyle.textColor,
                        aptStyle.borderColor
                      )}
                      style={{
                        top: `${topRem}rem`,
                        height: `${heightRem}rem`,
                      }}
                      title={`${apt.clientName} - ${apt.startTime} - ${apt.endTime}`}
                      onClick={() => handleEditAppointment(apt.id)}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <AptIcon className="h-3 w-3 shrink-0" />
                        <span className="font-bold truncate">{apt.clientName}</span>
                      </div>
                      {selectedProfessional === "all" && professional?.name && (
                        <p className="text-[0.65rem] truncate text-muted-foreground dark:text-gray-400">Prof: {professional.name}</p>
                      )}
                      <p className="truncate">{serviceCount} serviço(s)</p>
                      <p className="text-[0.65rem]">{apt.startTime} - {apt.endTime}</p>
                      {apt.totalAmount && <p className="text-[0.65rem] font-semibold">R$ {apt.totalAmount.replace('.',',')}</p>}
                       <div className="absolute bottom-1 right-1 flex space-x-0.5">
                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-card/30" title="Remover" onClick={(e) => { e.stopPropagation(); handleDeleteAppointment(apt.id); }}>
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                        </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )})}
        </div>
        )}
      </Card>

       <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-gradient">Confirmar Remoção</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Tem certeza que deseja remover este agendamento?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAppointmentToDeleteId(null)} className="font-body">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAppointment} className="bg-destructive hover:bg-destructive/90 font-body">Confirmar Remoção</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
