
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format, isBefore, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Alert, AlertDescription as ShadAlertDescription } from "@/components/ui/alert";

import { useToast } from "@/hooks/use-toast";
import type { Appointment, SalonService, Client, SalonPackage, Professional, PaymentMethod, ClientPackageInstance } from "@/types/firestore";
import {
  getServicesFS, getClientsFS, getPackagesFS, getProfessionalsFS,
  addClientFS, addAppointmentFS, updateAppointmentFS,
  updateClientFS, addFinancialTransactionFS
} from "@/lib/firebase/firestoreService";

import {
  Loader2, PlusCircle, ChevronsUpDown, CreditCard,
  AlertTriangle, PackagePlus, Tag, ArrowLeft,
  CheckCircle2, Award, XCircle, Send
} from "lucide-react";


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

interface AppointmentFormProps {
  pageTitle: string;
  pageDescription: string;
  actionButtonText: string;
  editingAppointment?: Appointment | null;
  defaultValues: Partial<AppointmentFormValues>;
}

const TOTAL_STAMPS_ON_CARD = 12;

interface PackageAlert {
  serviceId: string;
  serviceName: string;
}

export function AppointmentForm({
  pageTitle,
  pageDescription,
  actionButtonText,
  editingAppointment,
  defaultValues
}: AppointmentFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [servicesList, setServicesList] = React.useState<SalonService[]>([]);
  const [clientsList, setClientsList] = React.useState<Client[]>([]);
  const [professionalsList, setProfessionalsList] = React.useState<Professional[]>([]);
  const [availablePackagesList, setAvailablePackagesList] = React.useState<SalonPackage[]>([]);
  
  const [isLoading, setIsLoading] = React.useState(true);
  const [isClientComboboxOpen, setIsClientComboboxOpen] = React.useState(false);
  const [packageAlerts, setPackageAlerts] = React.useState<PackageAlert[]>([]);
  const [packageToSellInModal, setPackageToSellInModal] = React.useState<string>("");
  const [isSellingPackage, setIsSellingPackage] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      clientName: defaultValues.clientName || "",
      serviceIds: defaultValues.serviceIds || [],
      professionalId: defaultValues.professionalId || (professionalsList.length > 0 ? professionalsList[0].id : ""),
      date: defaultValues.date || new Date(),
      startTime: defaultValues.startTime || "",
      endTime: defaultValues.endTime || "",
      status: defaultValues.status || "Agendado",
      discount: defaultValues.discount || "0,00",
      discountJustification: defaultValues.discountJustification || "",
      extraAmount: defaultValues.extraAmount || "0,00",
      extraAmountJustification: defaultValues.extraAmountJustification || "",
      totalAmount: defaultValues.totalAmount || "0,00",
      paymentMethod: defaultValues.paymentMethod || 'Não Pago',
      ...defaultValues,
    },
  });

  const fetchDependencies = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedServices, fetchedClients, fetchedPackages, fetchedProfessionals] = await Promise.all([
        getServicesFS(),
        getClientsFS(),
        getPackagesFS(),
        getProfessionalsFS(),
      ]);
      setServicesList(fetchedServices);
      setClientsList(fetchedClients);
      setProfessionalsList(fetchedProfessionals);
      setAvailablePackagesList(fetchedPackages.filter(p => p.status === 'Ativo'));

      if (!form.getValues('professionalId') && fetchedProfessionals.length > 0) {
        form.setValue('professionalId', fetchedProfessionals[0].id);
      }
    } catch (error) {
      console.error("Error fetching dependencies:", error);
      toast({ variant: "destructive", title: "Erro ao carregar dados", description: "Não foi possível carregar os dados necessários para o formulário." });
    } finally {
      setIsLoading(false);
    }
  }, [toast, form]);

  React.useEffect(() => {
    fetchDependencies();
  }, [fetchDependencies]);

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
    form.setValue('totalAmount', finalTotal.toFixed(2).replace('.', ','), { shouldValidate: true });
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
      const isServiceGenerallyInPackages = availablePackagesList.some(pkgDef => pkgDef.services.some(s => s.serviceId === serviceId));
      if (isServiceGenerallyInPackages) {
        const clientHasCoveringPackage = client.purchasedPackages?.some(purchasedPkg => {
          if (purchasedPkg.status !== 'Ativo') return false;
          if (purchasedPkg.expiryDate && isBefore(parseISO(purchasedPkg.expiryDate), startOfDay(new Date()))) return false;
          return purchasedPkg.services.some(pkgServiceItem => pkgServiceItem.serviceId === serviceId && pkgServiceItem.remainingQuantity > 0);
        });
        if (!clientHasCoveringPackage) {
          newAlerts.push({ serviceId, serviceName: serviceDetails.name });
        }
      }
    });
    setPackageAlerts(newAlerts);
  }, [selectedClientNameFromForm, selectedServiceIdsFromForm, clientsList, availablePackagesList, servicesList]);

  const handleAppointmentCompletion = async (appointment: Appointment) => {
    try {
      let packageServiceConsumedThisAppointment = false;
      const client = clientsList.find(c => c.name.trim().toLowerCase() === appointment.clientName.trim().toLowerCase());
      if (!client || !client.id) {
          toast({ variant: "default", title: "Atenção: Cliente não Encontrado", description: `O cliente "${appointment.clientName}" não foi encontrado. Selos e pacotes não puderam ser processados.` });
          return;
      }
      const clientUpdates: Partial<Client> = {};
      let needsClientUpdate = false;
      if (client.purchasedPackages && client.purchasedPackages.length > 0) {
        const modifiableClientPackages = JSON.parse(JSON.stringify(client.purchasedPackages)) as Client["purchasedPackages"] || [];
        for (const serviceIdInAppointment of appointment.serviceIds) {
          for (const pkgInstance of modifiableClientPackages) {
            const isPkgActive = pkgInstance.status === 'Ativo' && (!pkgInstance.expiryDate || !isBefore(parseISO(pkgInstance.expiryDate), startOfDay(new Date())));
            if (isPkgActive) {
              const serviceInPkgIndex = pkgInstance.services.findIndex(s => s.serviceId === serviceIdInAppointment && s.remainingQuantity > 0);
              if (serviceInPkgIndex !== -1) {
                pkgInstance.services[serviceInPkgIndex].remainingQuantity -= 1;
                packageServiceConsumedThisAppointment = true;
                clientUpdates.purchasedPackages = modifiableClientPackages;
                needsClientUpdate = true;
                if (pkgInstance.services.every(s => s.remainingQuantity === 0)) pkgInstance.status = 'Utilizado';
                break;
              }
            }
          }
        }
      }
      if (!packageServiceConsumedThisAppointment) {
        clientUpdates.stampsEarned = (client.stampsEarned || 0) + 1;
        needsClientUpdate = true;
      }
      if (needsClientUpdate) await updateClientFS(client.id, clientUpdates);
      if (appointment.totalAmount) {
        const appointmentValue = parseFloat(String(appointment.totalAmount).replace(',', '.'));
        if (!isNaN(appointmentValue) && appointmentValue > 0) {
          const serviceNames = appointment.serviceIds.map(id => servicesList.find(s => s.id === id)?.name || "Serviço").join(', ');
          await addFinancialTransactionFS({
            description: `Receita Serviços: ${appointment.clientName} - ${serviceNames}`,
            amount: appointmentValue.toFixed(2),
            date: appointment.date,
            category: "Serviços Prestados",
            type: "income",
            paymentMethod: appointment.paymentMethod || 'Não Pago',
          });
        }
      }
    } catch (error: any) {
      console.error(`Error processing completion for appointment ${appointment.id}:`, error);
      toast({ variant: "destructive", title: "Erro ao Finalizar Tarefas", description: `O status foi salvo, mas ocorreu um erro ao processar selos, pacotes ou finanças. Detalhe: ${error.message}` });
    }
  };

  const onSubmitAppointment = async (data: AppointmentFormValues) => {
    setIsSubmitting(true);
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
      
      let savedAppointment: Appointment;

      if (editingAppointment && editingAppointment.id) {
        await updateAppointmentFS(editingAppointment.id, updateData);
        savedAppointment = { ...editingAppointment, ...updateData };
      } else {
        savedAppointment = await addAppointmentFS(updateData);
      }

      if (justCompleted) {
        await handleAppointmentCompletion(savedAppointment);
      }
      toast({ title: "Sucesso!", description: `Agendamento ${editingAppointment ? 'atualizado' : 'criado'} com sucesso.` });
      router.push('/agenda');
    } catch (error) {
      console.error("Error saving appointment:", error);
      toast({ variant: "destructive", title: "Erro ao Salvar", description: "Não foi possível salvar o agendamento." });
    } finally {
      setIsSubmitting(false);
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
      toast({ variant: "destructive", title: "Pacote não encontrado" });
      return;
    }
    setIsSellingPackage(true);
    const purchaseDate = new Date();
    const newClientPackage: ClientPackageInstance = {
      packageId: pkgDetails.id,
      packageName: pkgDetails.name,
      purchaseDate: format(purchaseDate, "yyyy-MM-dd"),
      expiryDate: format(new Date(purchaseDate.setDate(purchaseDate.getDate() + (pkgDetails.validityDays || 90))), "yyyy-MM-dd"),
      services: pkgDetails.services.map(s => ({ serviceId: s.serviceId, totalQuantity: s.quantity, remainingQuantity: s.quantity })),
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
        date: format(new Date(), "yyyy-MM-dd"),
        category: "Venda de Pacote",
        type: "income"
      });
      await updateClientFS(client.id, { stampsEarned: (client.stampsEarned || 0) + 1 });
      toast({ title: "Pacote Vendido!", description: `Pacote "${pkgDetails.name}" vendido para ${client.name} e selo adicionado.` });
      fetchDependencies();
      setPackageToSellInModal("");
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao Vender Pacote", description: "Não foi possível adicionar o pacote ao cliente." });
    } finally {
      setIsSellingPackage(false);
    }
  };

  const handleModalQuickAction = (newStatus: Appointment["status"]) => {
    if (!editingAppointment?.id) return;
    form.setValue("status", newStatus, { shouldDirty: true });
    form.handleSubmit(onSubmitAppointment)();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 font-body text-muted-foreground">Carregando formulário...</p>
      </div>
    );
  }

  return (
    <Card className="shadow-lg rounded-xl max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle className="font-headline text-2xl text-gradient">{pageTitle}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.push('/agenda')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Agenda
            </Button>
        </div>
        <CardDescription className="font-body">{pageDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitAppointment)} className="space-y-6">
            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-body">Nome do Cliente</FormLabel>
                  <Popover open={isClientComboboxOpen} onOpenChange={setIsClientComboboxOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                          {field.value ? clientsList.find(c => c.name.toLowerCase() === field.value.toLowerCase())?.name || field.value : "Buscar cliente ou digitar novo nome..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar cliente..." onValueChange={field.onChange} value={field.value || ""} />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {clientsList.map((client) => (
                              <CommandItem value={client.name} key={client.id} onSelect={() => { form.setValue("clientName", client.name, { shouldValidate: true }); setIsClientComboboxOpen(false); }}>
                                {client.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
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
              render={() => (
                <FormItem>
                  <FormLabel className="font-body">Serviços</FormLabel>
                  <div className="space-y-2 rounded-md border p-3 max-h-40 overflow-y-auto">
                    {servicesList.map(service => (
                      <FormField key={service.id} control={form.control} name="serviceIds"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value?.includes(service.id)}
                                onCheckedChange={(checked) => {
                                  return checked ? field.onChange([...field.value, service.id]) : field.onChange(field.value?.filter(v => v !== service.id));
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal font-body text-sm cursor-pointer">{service.name}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            {selectedClientNameFromForm && (
              <Card className="border-dashed border-primary bg-muted/30">
                <CardHeader className="p-3"><CardTitle className="font-headline text-md text-primary flex items-center gap-2"><PackagePlus className="h-5 w-5" /> Vender Pacote para {selectedClientNameFromForm}</CardTitle></CardHeader>
                <CardContent className="p-3 pt-0 flex items-end gap-2">
                  <div className="flex-grow">
                    <Label htmlFor="selectPackageToSell" className="font-body text-xs">Selecionar Pacote</Label>
                    <Select value={packageToSellInModal} onValueChange={setPackageToSellInModal} disabled={isSellingPackage}>
                      <SelectTrigger><SelectValue placeholder="Escolha um pacote..." /></SelectTrigger>
                      <SelectContent>
                        {availablePackagesList.filter(p => p.status === "Ativo").map(pkg => (<SelectItem key={pkg.id} value={pkg.id}>{pkg.name} (R$ {pkg.price.replace('.', ',')})</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" onClick={handleSellPackageFromModal} disabled={!packageToSellInModal || isSellingPackage} className="bg-green-600 hover:bg-green-700 text-white font-body h-9">
                    {isSellingPackage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}<span className="ml-2 hidden sm:inline">{isSellingPackage ? "Vendendo..." : "Vender"}</span>
                  </Button>
                </CardContent>
              </Card>
            )}
            {packageAlerts.length > 0 && (
              <div className="space-y-2">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <FormField control={form.control} name="discount" render={({ field }) => (<FormItem><FormLabel>Desconto (R$)</FormLabel><FormControl><Input type="text" placeholder="0,00" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="extraAmount" render={({ field }) => (<FormItem><FormLabel>Acréscimo (R$)</FormLabel><FormControl><Input type="text" placeholder="0,00" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div>
                <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-muted-foreground" /><Label className="font-body text-muted-foreground">Valor Final</Label></div>
                <p className="font-headline text-2xl text-accent mt-1 ml-1">R$ {form.watch('totalAmount') || "0,00"}</p>
              </div>
            </div>
            {discountValue > 0 && <FormField control={form.control} name="discountJustification" render={({ field }) => (<FormItem><FormLabel>Justificativa do Desconto</FormLabel><FormControl><Textarea placeholder="Ex: Presente de aniversário" rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />}
            {extraAmountValue > 0 && <FormField control={form.control} name="extraAmountJustification" render={({ field }) => (<FormItem><FormLabel>Justificativa do Acréscimo</FormLabel><FormControl><Textarea placeholder="Ex: Material extra" rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />}
            <FormField control={form.control} name="paymentMethod" render={({ field }) => (<FormItem><FormLabel>Método de Pagamento</FormLabel><Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione um método" /></SelectTrigger></FormControl><SelectContent>{paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="professionalId" render={({ field }) => (<FormItem><FormLabel>Profissional</FormLabel><Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger></FormControl><SelectContent>{professionalsList.length > 0 ? professionalsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>) : <p>Nenhum profissional</p>}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="date" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Data</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}<PlusCircle className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="startTime" render={({ field }) => (<FormItem><FormLabel>Início</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="endTime" render={({ field }) => (<FormItem><FormLabel>Término</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status do Agendamento</FormLabel><Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione um status" /></SelectTrigger></FormControl><SelectContent>{appointmentStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />

            <div className="flex gap-2 flex-wrap justify-start pt-4 border-t">
              {editingAppointment && (
                <>
                  <Button type="button" onClick={() => handleModalQuickAction("Confirmado")} className="bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900" size="sm" disabled={isSubmitting || editingAppointment.status === 'Concluído' || editingAppointment.status === 'Cancelado'}><CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar</Button>
                  <Button type="button" onClick={() => handleModalQuickAction("Concluído")} className="bg-pink-100 text-pink-700 hover:bg-pink-200 dark:bg-pink-900/50 dark:text-pink-300 dark:hover:bg-pink-900" size="sm" disabled={isSubmitting || editingAppointment.status === 'Concluído' || editingAppointment.status === 'Cancelado'}><Award className="mr-2 h-4 w-4" /> Finalizar</Button>
                  <Button type="button" onClick={() => handleModalQuickAction("Cancelado")} className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:hover:bg-yellow-900" size="sm" disabled={isSubmitting || editingAppointment.status === 'Concluído' || editingAppointment.status === 'Cancelado'}><XCircle className="mr-2 h-4 w-4" /> Cancelar</Button>
                </>
              )}
            </div>
            
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => router.push('/agenda')}>Cancelar</Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {actionButtonText}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
