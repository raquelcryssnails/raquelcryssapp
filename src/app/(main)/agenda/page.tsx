
"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, PlusCircle, Users, Square, Columns3, View, Clock, CheckCircle2, XCircle, CalendarIcon as CalendarNavIcon, Edit3, Trash2, ChevronsUpDown, Award, CreditCard, Loader2, Coffee, AlertTriangle, Contact, Send, Check, PackagePlus, Tag } from "lucide-react"; // Renamed CalendarIcon to CalendarNavIcon, added AlertTriangle and Send
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, format, startOfWeek, endOfWeek, eachDayOfInterval, subDays, isToday, parseISO, startOfDay, parse, isBefore, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar"; // This is the main Calendar component
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { addAppointmentFS, getAppointmentsFS, updateAppointmentFS, deleteAppointmentFS, getServicesFS, getClientsFS, updateClientFS, addClientFS, addFinancialTransactionFS, getPackagesFS, getProfessionalsFS, addNotificationFS, getClientFS } from "@/lib/firebase/firestoreService"; // Added getPackagesFS and getProfessionalsFS
import type { Appointment, SalonService as Service, Client, SalonPackage, Professional, PaymentMethod, ClientPackageInstance } from "@/types/firestore"; // Added SalonPackage, Professional, and PaymentMethod
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription as ShadAlertDescription } from "@/components/ui/alert"; // Renamed to avoid conflict
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useSettings, type DayOpeningHours } from "@/contexts/SettingsContext";


const statusStyles: Record<Appointment["status"], { icon: React.ElementType,bgColor: string, textColor: string, borderColor: string }> = {
  "Agendado": { icon: Clock, bgColor: "bg-blue-100 dark:bg-blue-900/50", textColor: "text-blue-700 dark:text-blue-300", borderColor: "border-blue-300 dark:border-blue-700" },
  "Confirmado": { icon: CheckCircle2, bgColor: "bg-green-100 dark:bg-green-900/50", textColor: "text-green-700 dark:text-green-300", borderColor: "border-green-300 dark:border-green-700" },
  "Concluído": { icon: Award, bgColor: "bg-pink-100 dark:bg-pink-900/50", textColor: "text-pink-700 dark:text-pink-300", borderColor: "border-pink-300 dark:border-pink-700" },
  "Cancelado": { icon: XCircle, bgColor: "bg-yellow-100 dark:bg-yellow-900/50", textColor: "text-yellow-700 dark:text-yellow-300", borderColor: "border-yellow-300 dark:border-yellow-700" },
};

const paymentMethods: PaymentMethod[] = ['Não Pago', 'Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito'];
const appointmentStatuses: Appointment['status'][] = ['Agendado', 'Confirmado', 'Concluído', 'Cancelado'];

const appointmentFormSchema = z.object({
  id: z.string().optional(),
  clientName: z.string().min(2, { message: "Nome do cliente é obrigatório." }),
  serviceIds: z.array(z.string()).nonempty({ message: "Selecione pelo menos um serviço." }),
  professionalId: z.string().min(1, { message: "Selecione um profissional." }),
  date: z.date({ required_error: "Data é obrigatória." }),
  startTime: z.string().min(1, { message: "Horário de início é obrigatório." }),
  endTime: z.string().min(1, { message: "Horário de término é obrigatório." }),
  status: z.enum(appointmentStatuses),
  discount: z.string().optional(),
  discountJustification: z.string().optional(),
  extraAmount: z.string().optional(),
  extraAmountJustification: z.string().optional(),
  totalAmount: z.string().optional(),
  paymentMethod: z.enum(paymentMethods as [PaymentMethod, ...PaymentMethod[]]).optional(),
}).refine(data => {
    if (!data.startTime || !data.endTime) return true;
    const start = parseInt(data.startTime.replace(":", ""), 10);
    const end = parseInt(data.endTime.replace(":", ""), 10);
    return end > start;
}, {
    message: "Horário de término deve ser após o horário de início.",
    path: ["endTime"],
}).refine(data => {
    const discountValue = parseFloat(String(data.discount || "0").replace(',', '.')) || 0;
    if (discountValue > 0) {
        return data.discountJustification && data.discountJustification.trim().length > 2;
    }
    return true;
}, {
    message: "Justificativa é obrigatória para descontos.",
    path: ["discountJustification"],
}).refine(data => {
    const extraAmountValue = parseFloat(String(data.extraAmount || "0").replace(',', '.')) || 0;
    if (extraAmountValue > 0) {
        return data.extraAmountJustification && data.extraAmountJustification.trim().length > 2;
    }
    return true;
}, {
    message: "Justificativa é obrigatória para acréscimos.",
    path: ["extraAmountJustification"],
});

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

const newClientFormSchema = z.object({
  name: z.string().min(2, { message: "Nome do cliente é obrigatório." }),
  email: z.string().email({ message: "E-mail inválido." }).optional().or(z.literal('')),
  phone: z.string().min(10, { message: "Telefone deve ter pelo menos 10 dígitos (com DDD)." }).optional().or(z.literal('')),
});
type NewClientFormValues = z.infer<typeof newClientFormSchema>;


type ViewMode = "daily" | "3days" | "weekly";

const TOTAL_STAMPS_ON_CARD = 12;

interface PackageAlert {
  serviceId: string;
  serviceName: string;
}

export default function AgendaPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [servicesList, setServicesList] = React.useState<Service[]>([]);
  const [clientsList, setClientsList] = React.useState<Client[]>([]);
  const [professionalsList, setProfessionalsList] = React.useState<Professional[]>([]);
  const [availablePackagesList, setAvailablePackagesList] = React.useState<SalonPackage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentDisplayDate, setCurrentDisplayDate] = React.useState(startOfDay(new Date()));
  const [selectedProfessional, setSelectedProfessional] = React.useState<string | "all">("all");
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = React.useState(false);
  const [editingAppointment, setEditingAppointment] = React.useState<Appointment | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [appointmentToDeleteId, setAppointmentToDeleteId] = React.useState<string | null>(null);
  const [isClientComboboxOpen, setIsClientComboboxOpen] = React.useState(false);
  const [updatingAppointmentId, setUpdatingAppointmentId] = React.useState<string | null>(null);
  const [packageAlerts, setPackageAlerts] = React.useState<PackageAlert[]>([]);
  const [packageToSellInModal, setPackageToSellInModal] = React.useState<string>("");
  const [isSellingPackage, setIsSellingPackage] = React.useState(false);


  const [isNewClientModalOpen, setIsNewClientModalOpen] = React.useState(false);
  const [isCalendarPopoverOpen, setIsCalendarPopoverOpen] = React.useState(false); 
  const [isContactsApiSupported, setIsContactsApiSupported] = React.useState(false);


  const [viewMode, setViewMode] = React.useState<ViewMode>("weekly");
  const { toast } = useToast();
  const { openingHours } = useSettings();

  const timeSlots = React.useMemo(() => {
    if (!openingHours || openingHours.length === 0) {
      // Default hardcoded range if settings are not available
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

    let minStartMinutes = 7 * 60; // 07:00
    let maxEndMinutes = 22 * 60; // 22:00

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

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      clientName: "",
      serviceIds: [],
      professionalId: professionalsList.length > 0 ? professionalsList[0].id : "",
      date: currentDisplayDate,
      startTime: "",
      endTime: "",
      status: "Agendado",
      discount: "0,00",
      discountJustification: "",
      extraAmount: "0,00",
      extraAmountJustification: "",
      totalAmount: "0,00",
      paymentMethod: 'Não Pago',
    },
  });

  const newClientForm = useForm<NewClientFormValues>({
    resolver: zodResolver(newClientFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
    },
  });

  const selectedServiceIdsFromForm = form.watch('serviceIds');
  const discountFromForm = form.watch('discount');
  const extraAmountFromForm = form.watch('extraAmount');
  const discountValue = parseFloat(String(discountFromForm || '0').replace(',', '.')) || 0;
  const extraAmountValue = parseFloat(String(extraAmountFromForm || '0').replace(',', '.')) || 0;
  const selectedClientNameFromForm = form.watch('clientName');

  React.useEffect(() => {
    let subtotal = 0;
    if (selectedServiceIdsFromForm && selectedServiceIdsFromForm.length > 0 && servicesList.length > 0) {
      selectedServiceIdsFromForm.forEach(serviceId => {
        const service = servicesList.find(s => s.id === serviceId);
        if (service && service.price) {
          const priceString = String(service.price).replace(',', '.');
          const priceValue = parseFloat(priceString);
          if (!isNaN(priceValue)) {
            subtotal += priceValue;
          }
        }
      });
    }
  
    const finalTotal = Math.max(0, subtotal - discountValue + extraAmountValue);
  
    form.setValue('totalAmount', finalTotal.toFixed(2).replace('.', ','), { shouldValidate: true, shouldDirty: true });
  }, [selectedServiceIdsFromForm, discountValue, extraAmountValue, servicesList, form]);

  React.useEffect(() => {
    if (!selectedClientNameFromForm || !selectedServiceIdsFromForm || selectedServiceIdsFromForm.length === 0 || clientsList.length === 0 || availablePackagesList.length === 0 || servicesList.length === 0) {
      setPackageAlerts([]);
      return;
    }

    const client = clientsList.find(c => c.name.toLowerCase() === selectedClientNameFromForm.toLowerCase());
    if (!client) {
      setPackageAlerts([]);
      return;
    }

    const newAlerts: PackageAlert[] = [];

    selectedServiceIdsFromForm.forEach(serviceId => {
      const serviceDetails = servicesList.find(s => s.id === serviceId);
      if (!serviceDetails) return;

      const isServiceGenerallyInPackages = availablePackagesList.some(pkgDef =>
        pkgDef.services.some(s => s.serviceId === serviceId)
      );

      if (isServiceGenerallyInPackages) {
        const clientHasCoveringPackage = client.purchasedPackages?.some(purchasedPkg => {
          if (purchasedPkg.status !== 'Ativo') return false;
          if (purchasedPkg.expiryDate && isBefore(parseISO(purchasedPkg.expiryDate), startOfDay(new Date()))) return false;
          return purchasedPkg.services.some(pkgServiceItem =>
            pkgServiceItem.serviceId === serviceId && pkgServiceItem.remainingQuantity > 0
          );
        });

        if (!clientHasCoveringPackage) {
          newAlerts.push({ serviceId, serviceName: serviceDetails.name });
        }
      }
    });
    setPackageAlerts(newAlerts);

  }, [selectedClientNameFromForm, selectedServiceIdsFromForm, clientsList, availablePackagesList, servicesList]);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'contacts' in navigator && 'select' in (navigator as any).contacts) {
        setIsContactsApiSupported(true);
    }
  }, []);

  const fetchPageData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedAppointments, fetchedServices, fetchedClients, fetchedPackages, fetchedProfessionals] = await Promise.all([
        getAppointmentsFS(),
        getServicesFS(),
        getClientsFS(),
        getPackagesFS(),
        getProfessionalsFS(),
      ]);
      setAppointments(fetchedAppointments);
      setServicesList(fetchedServices);
      setClientsList(fetchedClients);
      setProfessionalsList(fetchedProfessionals);
      setAvailablePackagesList(fetchedPackages.filter(p => p.status === 'Ativo'));

      // Set default professional if none is selected or if the list was previously empty
      if (selectedProfessional === "all" && fetchedProfessionals.length > 0) {
        // No change needed for filter if "all" is selected
      } else if (selectedProfessional !== "all" && !fetchedProfessionals.find(p => p.id === selectedProfessional) && fetchedProfessionals.length > 0) {
        setSelectedProfessional(fetchedProfessionals[0].id); // Default to first if current selection invalid
      } else if (selectedProfessional === "all" && fetchedProfessionals.length === 0){
        // Handled by UI
      }

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: "destructive", title: "Erro ao buscar dados", description: "Não foi possível carregar todos os dados da agenda." });
    } finally {
      setIsLoading(false);
    }
  }, [toast, selectedProfessional]);

  React.useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  React.useEffect(() => {
    if (!isAppointmentModalOpen) {
        form.reset({
            clientName: "",
            serviceIds: [],
            professionalId: selectedProfessional === "all" 
                ? (professionalsList.length > 0 ? professionalsList[0].id : "") 
                : (professionalsList.find(p=>p.id === selectedProfessional) ? selectedProfessional : (professionalsList.length > 0 ? professionalsList[0].id : "")),
            date: currentDisplayDate,
            startTime: "",
            endTime: "",
            status: "Agendado",
            discount: "0,00",
            discountJustification: "",
            extraAmount: "0,00",
            extraAmountJustification: "",
            totalAmount: "0,00",
            paymentMethod: 'Não Pago',
        });
        setEditingAppointment(null);
        setPackageAlerts([]); 
        setPackageToSellInModal("");
    } else {
      // When modal opens, ensure professionalId in form is valid
      const currentProfId = form.getValues("professionalId");
      if (!professionalsList.find(p => p.id === currentProfId) && professionalsList.length > 0) {
        form.setValue("professionalId", 
          selectedProfessional === "all" 
            ? professionalsList[0].id 
            : (professionalsList.find(p=>p.id === selectedProfessional) ? selectedProfessional : professionalsList[0].id)
        );
      } else if (professionalsList.length === 0) {
        form.setValue("professionalId", "");
      }
    }
  }, [currentDisplayDate, selectedProfessional, form, isAppointmentModalOpen, professionalsList]);


  const weekStartsOn = 1; // Monday

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
    setEditingAppointment(null);
    form.reset({
      clientName: "",
      serviceIds: [],
      professionalId: selectedProfessional === "all" 
          ? (professionalsList.length > 0 ? professionalsList[0].id : "") 
          : (professionalsList.find(p=>p.id === selectedProfessional) ? selectedProfessional : (professionalsList.length > 0 ? professionalsList[0].id : "")),
      date: date,
      startTime: startTime,
      endTime: "",
      status: "Agendado",
      discount: "0,00",
      discountJustification: "",
      extraAmount: "0,00",
      extraAmountJustification: "",
      totalAmount: "0,00",
      paymentMethod: 'Não Pago',
    });
    setIsAppointmentModalOpen(true);
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


  const handleEditAppointment = (apt: Appointment) => {
    setEditingAppointment(apt);
    form.reset({
        id: apt.id,
        clientName: apt.clientName,
        serviceIds: apt.serviceIds,
        professionalId: apt.professionalId,
        date: parse(apt.date, "yyyy-MM-dd", new Date()),
        startTime: apt.startTime,
        endTime: apt.endTime,
        status: apt.status,
        discount: apt.discount?.replace('.', ',') || "0,00",
        discountJustification: apt.discountJustification || "",
        extraAmount: apt.extraAmount?.replace('.', ',') || "0,00",
        extraAmountJustification: apt.extraAmountJustification || "",
        totalAmount: apt.totalAmount?.replace('.', ',') || "0,00",
        paymentMethod: apt.paymentMethod || 'Não Pago',
    });
    setIsAppointmentModalOpen(true);
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

  const handleAppointmentCompletion = async (appointment: Appointment) => {
    try {
      let packageServiceConsumedThisAppointment = false;
      
      const [freshClients, freshServices] = await Promise.all([
        getClientsFS(),
        getServicesFS()
      ]);
      
      const client = freshClients.find(c => c.name.trim().toLowerCase() === appointment.clientName.trim().toLowerCase());
  
      if (!client || !client.id) {
          toast({
              variant: "default",
              title: "Atenção: Cliente não Encontrado",
              description: `O cliente "${appointment.clientName}" não foi encontrado. Selos e pacotes não puderam ser processados.`
          });
      }
  
      const clientUpdates: Partial<Client> = {};
      let needsClientUpdate = false;
  
      if (client && client.id && client.purchasedPackages && client.purchasedPackages.length > 0) {
        const modifiableClientPackages = JSON.parse(JSON.stringify(client.purchasedPackages)) as Client["purchasedPackages"] || [];
        let clientUpdatedDueToPackage = false;
        
        for (const serviceIdInAppointment of appointment.serviceIds) {
          for (const pkgInstance of modifiableClientPackages) {
            const isPkgActive = pkgInstance.status === 'Ativo' && (!pkgInstance.expiryDate || !isBefore(parseISO(pkgInstance.expiryDate), startOfDay(parse(appointment.date, "yyyy-MM-dd", new Date()))));
            if (isPkgActive) {
              const serviceInPkgIndex = pkgInstance.services.findIndex(s => s.serviceId === serviceIdInAppointment && s.remainingQuantity > 0);
              if (serviceInPkgIndex !== -1) {
                pkgInstance.services[serviceInPkgIndex].remainingQuantity -= 1;
                packageServiceConsumedThisAppointment = true;
                clientUpdatedDueToPackage = true;
                const serviceDetails = freshServices.find(s => s.id === serviceIdInAppointment);
                const serviceName = serviceDetails ? serviceDetails.name : "Serviço";
                toast({ title: "Serviço de Pacote Utilizado", description: `1x ${serviceName} debitado do pacote "${pkgInstance.packageName}".` });
                if (pkgInstance.services.every(s => s.remainingQuantity === 0)) {
                  pkgInstance.status = 'Utilizado';
                  toast({ title: "Pacote Concluído!", description: `O pacote "${pkgInstance.packageName}" foi totalmente utilizado.` });
                }
                break;
              }
            }
          }
        }
        if (clientUpdatedDueToPackage) {
          clientUpdates.purchasedPackages = modifiableClientPackages;
          needsClientUpdate = true;
        }
      }
  
      if (!packageServiceConsumedThisAppointment && client && client.id) {
        const currentStamps = client.stampsEarned || 0;
        const newStampsValue = currentStamps + 1;
        clientUpdates.stampsEarned = newStampsValue;
        needsClientUpdate = true;
        
        const isCompletingCard = newStampsValue > 0 && newStampsValue % TOTAL_STAMPS_ON_CARD === 0;
        let toastDescription = `+1 selo de fidelidade para ${client.name}.`;
        if (isCompletingCard) {
            toastDescription = `Parabéns ${client.name}! Você completou um cartão e ganhou novas recompensas!`;
        }
        
        toast({ title: "Selo Adicionado!", description: toastDescription });
      } else if (packageServiceConsumedThisAppointment && client) {
        toast({ title: "Serviço de Pacote", description: `Serviço consumido do pacote de ${client.name}. Selo não adicionado.` });
      }
  
      if (needsClientUpdate && client && client.id) {
          await updateClientFS(client.id, clientUpdates);
      }
  
      if (appointment.totalAmount) {
        const appointmentValue = parseFloat(String(appointment.totalAmount).replace(',', '.'));
        if (!isNaN(appointmentValue) && appointmentValue > 0) {
          const serviceNames = appointment.serviceIds.map(id => freshServices.find(s => s.id === id)?.name || "Serviço").join(', ');
          await addFinancialTransactionFS({
            description: `Receita Serviços: ${appointment.clientName} - ${serviceNames}`,
            amount: appointmentValue.toFixed(2),
            date: appointment.date,
            category: "Serviços Prestados",
            type: "income",
            paymentMethod: appointment.paymentMethod || 'Não Pago',
          });
          toast({ title: "Receita Registrada", description: `R$ ${appointmentValue.toFixed(2).replace('.', ',')} de ${appointment.clientName} registrado no caixa.` });
        }
      }
    } catch (error: any) {
      console.error(`[handleAppointmentCompletion] Error processing completion for appointment ${appointment.id}:`, error);
      toast({
          variant: "destructive",
          title: "Erro ao Finalizar Tarefas",
          description: `O status do agendamento foi salvo, mas ocorreu um erro ao processar selos, pacotes ou finanças. Detalhe: ${error.message}`
      });
    }
  };


  const onSubmitAppointment = async (data: AppointmentFormValues) => {
    try {
      const wasCompleted = editingAppointment?.status === 'Concluído';
      const isNowCompleted = data.status === 'Concluído';
      const justCompleted = !wasCompleted && isNowCompleted;

      const updateData = {
        clientName: data.clientName,
        serviceIds: data.serviceIds,
        date: format(data.date, "yyyy-MM-dd"),
        startTime: data.startTime,
        endTime: data.endTime,
        professionalId: data.professionalId,
        status: data.status,
        discount: data.discount?.replace(',', '.') || "0.00",
        discountJustification: data.discountJustification || "",
        extraAmount: data.extraAmount?.replace(',', '.') || "0.00",
        extraAmountJustification: data.extraAmountJustification || "",
        totalAmount: data.totalAmount?.replace(',', '.') || "0.00",
        paymentMethod: data.paymentMethod || 'Não Pago',
      };
      
      if (editingAppointment && editingAppointment.id) {
        await updateAppointmentFS(editingAppointment.id, updateData);
        if (justCompleted) {
          await handleAppointmentCompletion({ ...editingAppointment, ...updateData });
        }
      } else {
        const newAppointment = await addAppointmentFS(updateData);
        if (isNowCompleted) {
            await handleAppointmentCompletion({ ...newAppointment, ...updateData });
        }
      }
      fetchPageData();
      setIsAppointmentModalOpen(false);
      form.reset();
      setEditingAppointment(null);
    } catch (error) {
      console.error("Error saving appointment:", error);
      toast({ variant: "destructive", title: "Erro ao Salvar", description: "Não foi possível salvar o agendamento." });
    }
  };

  const handleSellPackageFromModal = async () => {
    const clientName = form.getValues('clientName');
    const client = clientsList.find(c => c.name === clientName);

    if (!client || !client.id || !packageToSellInModal) {
      toast({ variant: "destructive", title: "Seleção Inválida", description: "Selecione um cliente e um pacote para vender." });
      return;
    }

    const pkgDetails = availablePackagesList.find(p => p.id === packageToSellInModal);
    if (!pkgDetails) {
      toast({ variant: "destructive", title: "Pacote não encontrado", description: "O pacote selecionado não foi encontrado." });
      return;
    }

    setIsSellingPackage(true);

    const purchaseDate = new Date();
    const expiryDate = addDays(purchaseDate, pkgDetails.validityDays || 90);
    const purchaseDateFormatted = format(purchaseDate, "yyyy-MM-dd");

    const newClientPackage: ClientPackageInstance = {
      packageId: pkgDetails.id,
      packageName: pkgDetails.name,
      purchaseDate: purchaseDateFormatted,
      expiryDate: format(expiryDate, "yyyy-MM-dd"),
      services: pkgDetails.services.map(s => ({
        serviceId: s.serviceId,
        totalQuantity: s.quantity,
        remainingQuantity: s.quantity,
      })),
      status: 'Ativo',
      originalPrice: pkgDetails.originalPrice,
      paidPrice: pkgDetails.price,
    };

    const updatedPurchasedPackages = [...(client.purchasedPackages || []), newClientPackage];

    try {
      await updateClientFS(client.id, { purchasedPackages: updatedPurchasedPackages });
      
      await addFinancialTransactionFS({
        description: `Venda Pacote: ${pkgDetails.name} - Cliente: ${client.name}`,
        amount: pkgDetails.price.replace(',', '.'),
        date: purchaseDateFormatted,
        category: "Venda de Pacote",
        type: "income"
      });
      toast({ title: "Pacote Vendido!", description: `Pacote "${pkgDetails.name}" vendido para ${client.name}.` });

      // Award stamp for package purchase
      const currentStamps = client.stampsEarned || 0;
      const newStampCount = currentStamps + 1;
      await updateClientFS(client.id, { stampsEarned: newStampCount });
      
      const isCompletingCard = newStampCount > 0 && newStampCount % TOTAL_STAMPS_ON_CARD === 0;
      let toastDescription = `+1 selo pela compra do pacote para ${client.name}.`;
      if (isCompletingCard) {
          toastDescription = `Parabéns ${client.name}! Você completou um cartão com a compra deste pacote!`;
      }
      toast({ title: "Selo Adicionado!", description: toastDescription });
      
      await fetchPageData(); // Refresh all data to reflect the new package
      setPackageToSellInModal("");

    } catch (error) {
      console.error("Error selling package from modal:", error);
      toast({ variant: "destructive", title: "Erro ao Vender Pacote", description: "Não foi possível adicionar o pacote ao cliente." });
    } finally {
      setIsSellingPackage(false);
    }
  };


  const onSubmitNewClient = async (data: NewClientFormValues) => {
    try {
      const newClientData = {
        name: data.name,
        email: data.email || "",
        phone: data.phone || "",
        stampsEarned: 0,
        mimosRedeemed: 0,
        purchasedPackages: []
      };
      const addedClient = await addClientFS(newClientData);
      toast({ title: "Cliente Adicionado", description: `${addedClient.name} foi cadastrado com sucesso.` });

      await fetchPageData();
      form.setValue("clientName", addedClient.name, { shouldValidate: true });

      setIsNewClientModalOpen(false);
      newClientForm.reset();
    } catch (error) {
      console.error("Error adding new client:", error);
      toast({ variant: "destructive", title: "Erro ao Adicionar Cliente", description: "Não foi possível cadastrar o novo cliente." });
    }
  };

  const handleImportNewClientContact = async () => {
    if (window.self !== window.top) {
        toast({
            variant: "destructive",
            title: "Função Indisponível na Pré-visualização",
            description: "A importação de contatos não pode ser usada no editor. Por favor, acesse o app em seu próprio navegador ou dispositivo para usar esta funcionalidade.",
        });
        return;
    }

    if (!isContactsApiSupported) {
        toast({
            variant: "destructive",
            title: "Navegador não suportado",
            description: "Seu navegador não suporta a importação de contatos.",
        });
        return;
    }

    try {
        const contacts = await (navigator as any).contacts.select(['name', 'email', 'tel'], { multiple: false });
        if (contacts.length === 0) {
            return; // User cancelled
        }
        const contact = contacts[0];
        
        if (contact.name && contact.name.length > 0) {
            newClientForm.setValue('name', contact.name[0], { shouldValidate: true });
        }
        if (contact.email && contact.email.length > 0) {
            newClientForm.setValue('email', contact.email[0], { shouldValidate: true });
        }
        if (contact.tel && contact.tel.length > 0) {
            newClientForm.setValue('phone', contact.tel[0], { shouldValidate: true });
        }

        toast({
            title: "Contato Importado!",
            description: `Dados de ${contact.name?.[0] || 'contato'} preenchidos.`,
        });
    } catch (ex) {
        console.error("Erro ao importar contato:", ex);
        toast({
            variant: "destructive",
            title: "Erro ao Importar",
            description: "Não foi possível importar o contato. Verifique as permissões do navegador.",
        });
    }
  };


 const handleUpdateAppointmentStatus = async (appointmentId: string, newStatus: Appointment["status"]) => {
    setUpdatingAppointmentId(appointmentId);
    let finalAppointmentDataForLogic: Appointment | undefined;

    try {
      const appointmentFromState = appointments.find((apt) => apt.id === appointmentId);
      if (!appointmentFromState) {
        toast({ variant: "destructive", title: "Erro", description: "Agendamento não encontrado." });
        setUpdatingAppointmentId(null);
        return;
      }
      
      let dataToUpdate: Partial<Appointment> = { status: newStatus };
      finalAppointmentDataForLogic = { ...appointmentFromState, ...dataToUpdate } as Appointment;

      await updateAppointmentFS(appointmentId, dataToUpdate);

      const isCompletingNow = appointmentFromState.status !== "Concluído" && newStatus === "Concluído";
      if (isCompletingNow) {
        await handleAppointmentCompletion(finalAppointmentDataForLogic);
      }

      let overallToastTitle = "Status Atualizado";
      let overallToastMessage = "Status do agendamento atualizado com sucesso.";
      
      if (newStatus === "Confirmado") {
        overallToastMessage = "Agendamento confirmado com sucesso!";
      } else if (newStatus === "Concluído") {
        overallToastMessage = "Agendamento concluído com sucesso!";
      } else if (newStatus === "Cancelado") {
        overallToastTitle = "Agendamento Cancelado";
        overallToastMessage = "Agendamento cancelado.";
      }
      toast({ title: overallToastTitle, description: overallToastMessage });
      
      setIsAppointmentModalOpen(false);
      fetchPageData();

    } catch (error: any) {
      console.error(`Error updating appointment status to ${newStatus} for apt ${appointmentId}:`, error.message, error.stack);
      toast({ variant: "destructive", title: "Erro Crítico ao Atualizar", description: `Não foi possível salvar a atualização do status. Detalhe: ${error.message}` });
      fetchPageData();
    } finally {
      setUpdatingAppointmentId(null);
    }
  };

  const handleModalQuickAction = (newStatus: Appointment["status"]) => {
    if (!editingAppointment?.id) return;
    form.setValue("status", newStatus, { shouldDirty: true });
    form.handleSubmit(onSubmitAppointment)();
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

          <Dialog open={isAppointmentModalOpen} onOpenChange={(isOpen) => {
            setIsAppointmentModalOpen(isOpen);
            if (!isOpen) {
              setEditingAppointment(null);
              form.reset();
              setPackageAlerts([]);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="font-body bg-gradient-to-r from-primary to-accent text-accent-foreground hover:opacity-90">
                <PlusCircle className="mr-2 h-4 w-4" /> {editingAppointment ? "Editar Agendamento" : "Novo Agendamento"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card p-0 flex flex-col max-h-[90dvh]">
              <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
                <DialogTitle className="font-headline text-gradient">{editingAppointment ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
                <DialogDescription className="font-body">
                  {editingAppointment ? "Altere os dados do agendamento." : "Preencha os dados para criar um novo novo agendamento."}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitAppointment)} className="flex flex-col flex-grow overflow-hidden">
                  <div className="flex-grow overflow-y-auto p-6 space-y-4">
                    
                      <FormField
                        control={form.control}
                        name="clientName"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="font-body">Nome do Cliente</FormLabel>
                            <Popover open={isClientComboboxOpen} onOpenChange={setIsClientComboboxOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={isClientComboboxOpen}
                                    className={cn(
                                      "w-full justify-between font-body focus:ring-accent",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value
                                      ? clientsList.find(
                                          (client) => client.name.toLowerCase() === field.value.toLowerCase()
                                        )?.name || field.value
                                      : "Buscar cliente ou digitar novo nome..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                  <CommandInput
                                    placeholder="Buscar cliente ou digitar novo nome..."
                                    onValueChange={field.onChange}
                                    value={field.value || ""}
                                  />
                                  <CommandList>
                                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                    <CommandGroup heading="Clientes Existentes">
                                      {clientsList.map((client) => (
                                        <CommandItem
                                          value={client.name}
                                          key={client.id}
                                          onSelect={(currentValue) => {
                                            form.setValue("clientName", currentValue, { shouldValidate: true });
                                            setIsClientComboboxOpen(false);
                                          }}
                                        >
                                          {client.name}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                    {field.value && !clientsList.some(c => c.name.toLowerCase() === field.value.toLowerCase()) && (
                                        <CommandGroup heading="Novo Cliente">
                                            <CommandItem
                                              onSelect={() => {
                                                  newClientForm.reset({ name: field.value, email: "", phone: "" });
                                                  setIsNewClientModalOpen(true);
                                                  setIsClientComboboxOpen(false);
                                              }}
                                              value={`__CREATE__${field.value}`}
                                              className="cursor-pointer text-green-600 hover:!text-green-700 dark:text-green-400 dark:hover:!text-green-500"
                                              >
                                              <PlusCircle className="mr-2 h-4 w-4" />
                                              <span>Cadastrar: "{field.value}"</span>
                                            </CommandItem>
                                        </CommandGroup>
                                    )}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="serviceIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-body">Serviços</FormLabel>
                            <FormControl>
                              <div className="space-y-2 rounded-md border p-3 max-h-40 overflow-y-auto">
                                {servicesList.map(service => (
                                  <FormField
                                    key={service.id}
                                    control={form.control}
                                    name="serviceIds"
                                    render={({ field: checkboxField }) => {
                                      return (
                                        <FormItem
                                          key={service.id}
                                          className="flex flex-row items-center space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={checkboxField.value?.includes(service.id)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? checkboxField.onChange([...checkboxField.value, service.id])
                                                  : checkboxField.onChange(
                                                      checkboxField.value?.filter(
                                                        (value) => value !== service.id
                                                      )
                                                    )
                                              }}
                                              className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal font-body text-sm cursor-pointer">
                                            {service.name}
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                ))}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    
                     {selectedClientNameFromForm && (
                        <Card className="mt-4 border-dashed border-primary bg-muted/30">
                          <CardHeader className="p-3">
                            <CardTitle className="font-headline text-md text-primary flex items-center gap-2">
                              <PackagePlus className="h-5 w-5" /> Vender Pacote para {selectedClientNameFromForm}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-3 pt-0 flex items-end gap-2">
                            <div className="flex-grow">
                              <Label htmlFor="selectPackageToSell" className="font-body text-xs">Selecionar Pacote</Label>
                              <Select value={packageToSellInModal} onValueChange={setPackageToSellInModal} disabled={isSellingPackage}>
                                <SelectTrigger id="selectPackageToSell" className="focus:ring-accent font-body h-9">
                                  <SelectValue placeholder="Escolha um pacote..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {availablePackagesList.filter(p => p.status === "Ativo").map(pkg => (
                                    <SelectItem key={pkg.id} value={pkg.id} className="font-body">
                                      {pkg.name} (R$ {pkg.price.replace('.', ',')})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              onClick={handleSellPackageFromModal}
                              disabled={!packageToSellInModal || isSellingPackage}
                              className="bg-green-600 hover:bg-green-700 text-white font-body h-9"
                            >
                              {isSellingPackage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                              <span className="ml-2 hidden sm:inline">{isSellingPackage ? "Vendendo..." : "Vender"}</span>
                            </Button>
                          </CardContent>
                        </Card>
                      )}


                    {packageAlerts.length > 0 && (
                        <div className="space-y-2 mt-2">
                            {packageAlerts.map(alert => (
                                <Alert key={alert.serviceId} variant="default" className="border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 dark:border-yellow-600">
                                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                    <ShadAlertDescription className="font-body text-yellow-700 dark:text-yellow-300 text-xs">
                                        O cliente selecionado não possui um pacote ativo que inclua o serviço "{alert.serviceName}". O valor integral será aplicado.
                                    </ShadAlertDescription>
                                </Alert>
                            ))}
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end mt-3">
                      <FormField
                          control={form.control}
                          name="discount"
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel className="font-body">Desconto (R$)</FormLabel>
                              <FormControl>
                                  <Input
                                  type="text"
                                  placeholder="0,00"
                                  {...field}
                                  className="focus:ring-accent font-body"
                                  />
                              </FormControl>
                              <FormMessage />
                              </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name="extraAmount"
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel className="font-body">Acréscimo (R$)</FormLabel>
                              <FormControl>
                                  <Input
                                  type="text"
                                  placeholder="0,00"
                                  {...field}
                                  className="focus:ring-accent font-body"
                                  />
                              </FormControl>
                              <FormMessage />
                              </FormItem>
                          )}
                      />
                      <div>
                          <div className="flex items-center gap-2">
                              <CreditCard className="h-5 w-5 text-muted-foreground" />
                              <Label className="font-body text-muted-foreground">Valor Final</Label>
                          </div>
                          <p className="font-headline text-2xl text-accent mt-1 ml-1">
                              R$ {form.watch('totalAmount') || "0,00"}
                          </p>
                      </div>
                    </div>

                    {discountValue > 0 && (
                      <FormField
                        control={form.control}
                        name="discountJustification"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-body">Justificativa do Desconto</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Ex: Presente de aniversário, pacote de fidelidade, etc."
                                        className="focus:ring-accent font-body"
                                        rows={2}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                      />
                    )}

                    {extraAmountValue > 0 && (
                      <FormField
                        control={form.control}
                        name="extraAmountJustification"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-body">Justificativa do Acréscimo</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Ex: Material extra, serviço complexo, etc."
                                        className="focus:ring-accent font-body"
                                        rows={2}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                      />
                    )}

                    
                      <FormField
                        control={form.control}
                        name="paymentMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-body">Método de Pagamento</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="focus:ring-accent font-body">
                                  <SelectValue placeholder="Selecione um método" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {paymentMethods.map((method) => (
                                  <SelectItem key={method} value={method} className="font-body">
                                    {method}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="professionalId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-body">Profissional</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="focus:ring-accent font-body">
                                  <SelectValue placeholder="Selecione o profissional" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {professionalsList.length > 0 ? (
                                  professionalsList.map(prof => (
                                    <SelectItem key={prof.id} value={prof.id} className="font-body">{prof.name}</SelectItem>
                                  ))
                                ) : (
                                  <p className="p-2 text-sm text-center text-muted-foreground font-body">Nenhum profissional cadastrado</p>
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="font-body">Data</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal focus:ring-accent font-body",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP", { locale: ptBR })
                                    ) : (
                                      <span>Escolha uma data</span>
                                    )}
                                    <CalendarNavIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={false}
                                  initialFocus
                                  locale={ptBR}
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="startTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-body">Início</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  className="focus:ring-accent font-body"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="endTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-body">Término</FormLabel>
                               <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  className="focus:ring-accent font-body"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-body">Status do Agendamento</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="focus:ring-accent font-body">
                                <SelectValue placeholder="Selecione um status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {appointmentStatuses.map(status => (
                                <SelectItem key={status} value={status} className="font-body">{status}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>
                   <DialogFooter className="p-6 border-t flex-shrink-0 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      {/* Left group: Quick status actions */}
                      <div className="flex gap-2 flex-wrap justify-center sm:justify-start">
                          {editingAppointment && (
                              <>
                                  <Button type="button" onClick={() => handleModalQuickAction("Confirmado")} className="bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900" size="sm" disabled={updatingAppointmentId === editingAppointment.id || editingAppointment.status === 'Concluído' || editingAppointment.status === 'Cancelado'}><CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar</Button>
                                  <Button type="button" onClick={() => handleModalQuickAction("Concluído")} className="bg-pink-100 text-pink-700 hover:bg-pink-200 dark:bg-pink-900/50 dark:text-pink-300 dark:hover:bg-pink-900" size="sm" disabled={updatingAppointmentId === editingAppointment.id || editingAppointment.status === 'Concluído' || editingAppointment.status === 'Cancelado'}><Award className="mr-2 h-4 w-4" /> Finalizar</Button>
                                  <Button type="button" onClick={() => handleModalQuickAction("Cancelado")} className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:hover:bg-yellow-900" size="sm" disabled={updatingAppointmentId === editingAppointment.id || editingAppointment.status === 'Concluído' || editingAppointment.status === 'Cancelado'}><XCircle className="mr-2 h-4 w-4" /> Cancelar</Button>
                                  {(() => {
                                      const client = clientsList.find(c => c.name.toLowerCase() === editingAppointment.clientName.toLowerCase());
                                      const phoneNumber = client?.phone?.replace(/\D/g, '');
                                      const whatsappNumber = phoneNumber && phoneNumber.length >= 10 ? `55${phoneNumber}` : null;
                                      
                                      const serviceNames = editingAppointment.serviceIds.map(id => servicesList.find(s => s.id === id)?.name).filter(Boolean).join(', ');
                                      const message = encodeURIComponent(
                                          `Olá ${editingAppointment.clientName}! Tudo bem? Confirmando seu agendamento para ${
                                            serviceNames || 'seu horário'
                                          } no dia ${format(parse(editingAppointment.date, "yyyy-MM-dd", new Date()), 'dd/MM/yyyy')} às ${editingAppointment.startTime}. Podemos confirmar? 😊`
                                      );

                                      if (!whatsappNumber) {
                                          return (
                                              <Button 
                                                  type="button" 
                                                  size="sm"
                                                  className="bg-gray-400 text-white cursor-not-allowed"
                                                  disabled
                                                  title="Cliente não possui um número de telefone válido cadastrado."
                                              >
                                                  <Send className="mr-2 h-4 w-4" /> Enviar WhatsApp
                                              </Button>
                                          );
                                      }

                                      return (
                                          <Button 
                                              type="button" 
                                              asChild
                                              className="bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700" 
                                              size="sm"
                                          >
                                              <a 
                                                  href={`https://wa.me/${whatsappNumber}?text=${message}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  onClick={(e) => e.stopPropagation()}
                                              >
                                                  <Send className="mr-2 h-4 w-4" /> Enviar WhatsApp
                                              </a>
                                          </Button>
                                      );
                                  })()}
                              </>
                          )}
                      </div>

                      {/* Right group: Main actions */}
                      <div className="flex gap-2 w-full sm:w-auto">
                          <DialogClose asChild>
                              <Button type="button" variant="outline" className="font-body flex-1 sm:flex-grow-0">
                                  {editingAppointment && (editingAppointment.status === 'Concluído' || editingAppointment.status === 'Cancelado') ? "Fechar" : "Cancelar"}
                              </Button>
                          </DialogClose>
                          
                          <Button type="submit" className="font-body bg-primary text-primary-foreground hover:bg-primary/90 flex-1 sm:flex-grow-0" disabled={form.formState.isSubmitting}>
                              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {editingAppointment ? "Salvar Alterações" : "Salvar Agendamento"}
                          </Button>
                          
                      </div>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
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
                      return null; // Don't render invalid appointments
                  }
              
                  const minutesFromGridStart = aptStartTotalMinutes - gridStartMinutes;
                  const durationInMinutes = aptEndTotalMinutes - aptStartTotalMinutes;
                  
                  const slotHeightRem = 4; // Each 30-minute slot is 4rem high
                  const remPerMinute = slotHeightRem / 30;
                  
                  const topRem = minutesFromGridStart * remPerMinute;
                  // Ensure a minimum visible height for very short appointments
                  const heightRem = Math.max(remPerMinute * 15, durationInMinutes * remPerMinute);

                  const aptStyle = statusStyles[apt.status];
                  const AptIcon = aptStyle.icon;
                  const professional = professionalsList.find(p => p.id === apt.professionalId);

                  const displayServiceName = apt.serviceIds.length > 0 && servicesList.find(s => s.id === apt.serviceIds[0])
                    ? servicesList.find(s => s.id === apt.serviceIds[0])!.name
                    : apt.serviceIds.length > 1 ? 'Serviços Múltiplos' : 'Serviço';

                  return (
                    <div
                      key={apt.id}
                      data-appointment-card="true"
                      className={cn(
                        "absolute w-[calc(100%-4px)] ml-[2px] p-2 rounded-md shadow text-xs font-body overflow-hidden border-l-4",
                        (apt.status === "Concluído" || apt.status === "Cancelado") ? "cursor-default" : "cursor-pointer",
                        aptStyle.bgColor,
                        aptStyle.textColor,
                        aptStyle.borderColor
                      )}
                      style={{
                        top: `${topRem}rem`,
                        height: `${heightRem}rem`,
                      }}
                      title={`${apt.clientName} - ${displayServiceName}\n${apt.startTime} - ${apt.endTime}${apt.totalAmount ? `\nValor: R$ ${apt.totalAmount.replace('.',',')}` : ''}\nStatus: ${apt.status}`}
                      onClick={() => handleEditAppointment(apt)}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <AptIcon className="h-3 w-3 shrink-0" />
                        <span className="font-bold truncate">{apt.clientName}</span>
                      </div>
                      {selectedProfessional === "all" && professional?.name && (
                        <p className="text-[0.65rem] truncate text-muted-foreground dark:text-gray-400">Prof: {professional.name}</p>
                      )}
                      <p className="truncate">{displayServiceName} {apt.serviceIds.length > 1 ? ` (+${apt.serviceIds.length -1})` : ''}</p>
                      <p className="text-[0.65rem]">{apt.startTime} - {apt.endTime}</p>
                      {apt.totalAmount && <p className="text-[0.65rem] font-semibold">R$ {apt.totalAmount.replace('.',',')}</p>}
                       <div className="absolute bottom-1 right-1 flex space-x-0.5">
                            {updatingAppointmentId === apt.id ? (
                               <Loader2 className="h-3.5 w-3.5 animate-spin self-center mx-auto text-primary" />
                            ) : (
                                <>
                                    {apt.status !== 'Concluído' && apt.status !== 'Cancelado' && (
                                        <>
                                            {apt.status === "Agendado" && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-card/30" title="Confirmar" onClick={(e) => { e.stopPropagation(); handleUpdateAppointmentStatus(apt.id, "Confirmado"); }}>
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-card/30" title="Finalizar" onClick={(e) => { e.stopPropagation(); handleUpdateAppointmentStatus(apt.id, "Concluído"); }}>
                                                <Award className="h-3.5 w-3.5 text-pink-600 dark:text-pink-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-card/30" title="Cancelar" onClick={(e) => { e.stopPropagation(); handleUpdateAppointmentStatus(apt.id, "Cancelado"); }}>
                                                <XCircle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-card/30" title="Editar" onClick={(e) => { e.stopPropagation(); handleEditAppointment(apt); }}>
                                                <Edit3 className="h-3.5 w-3.5" />
                                            </Button>
                                        </>
                                    )}
                                    { (apt.status === 'Concluído' || apt.status === 'Cancelado') && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-card/30" title="Remover" onClick={(e) => { e.stopPropagation(); handleDeleteAppointment(apt.id); }}>
                                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        </Button>
                                    )}
                                </>
                            )}
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

      {/* New Client Registration Dialog */}
      <Dialog open={isNewClientModalOpen} onOpenChange={(isOpen) => {
        setIsNewClientModalOpen(isOpen);
        if (!isOpen) newClientForm.reset();
      }}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <div className="flex justify-between items-center">
                <DialogTitle className="font-headline text-gradient">Cadastrar Novo Cliente</DialogTitle>
                 {isContactsApiSupported && (
                    <Button type="button" variant="outline" size="sm" onClick={handleImportNewClientContact} className="font-body">
                        <Contact className="mr-2 h-4 w-4" /> Importar
                    </Button>
                )}
            </div>
            <DialogDescription className="font-body">
              Preencha os dados abaixo para cadastrar o novo cliente.
            </DialogDescription>
          </DialogHeader>
          <Form {...newClientForm}>
            <form onSubmit={newClientForm.handleSubmit(onSubmitNewClient)} className="space-y-4 py-2">
              <FormField
                control={newClientForm.control}
                name="name"
                render={({ field: newClientField }) => (
                  <FormItem>
                    <FormLabel className="font-body">Nome do Cliente</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo do cliente" {...newClientField} className="focus:ring-accent font-body" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                <FormField
                  control={newClientForm.control}
                  name="email"
                  render={({ field: newClientField }) => (
                    <FormItem>
                      <FormLabel className="font-body">E-mail (opcional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...newClientField} className="focus:ring-accent font-body" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={newClientForm.control}
                  name="phone"
                  render={({ field: newClientField }) => (
                    <FormItem>
                      <FormLabel className="font-body">Telefone (opcional, com DDD)</FormLabel>
                      <FormControl>
                        <Input placeholder="(XX) XXXXX-XXXX" {...newClientField} className="focus:ring-accent font-body" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="pt-4 flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" onClick={() => newClientForm.reset()} className="font-body w-full sm:w-auto">Cancelar</Button>
                </DialogClose>
                <Button type="submit" className="font-body bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto" disabled={newClientForm.formState.isSubmitting}>
                    {newClientForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cadastrar Cliente
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

