
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Clock, Bell, Users, UserPlus, Save, UserCog, Image as ImageIcon, Tv, Upload, FileUp, Database, Download, AlertTriangle, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea"; 
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSettings, type DayOpeningHours } from "@/contexts/SettingsContext"; 
import type { AppSettings } from "@/types/firestore";
import { backupAllDataFS, restoreAllDataFS } from "@/lib/firebase/firestoreService";


// Initial days data, now using dayOfWeek (0 for Sunday, 1 for Monday, etc.)
const initialDaysData: DayOpeningHours[] = [
  { id: "1", name: "Segunda-feira", dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { id: "2", name: "Terça-feira", dayOfWeek: 2, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { id: "3", name: "Quarta-feira", dayOfWeek: 3, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { id: "4", name: "Quinta-feira", dayOfWeek: 4, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { id: "5", name: "Sexta-feira", dayOfWeek: 5, isOpen: true, openTime: "09:00", closeTime: "20:00" },
  { id: "6", name: "Sábado", dayOfWeek: 6, isOpen: true, openTime: "08:00", closeTime: "17:00" },
  { id: "7", name: "Domingo", dayOfWeek: 0, isOpen: false, openTime: "09:00", closeTime: "18:00" },
];

const timeSlots = Array.from({ length: (22 - 7) * 2 +1 }, (_, i) => { // 7:00 to 22:00
    const hour = 7 + Math.floor(i / 2);
    const minute = (i % 2) * 30;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});


export default function ConfiguracoesPage() {
  const { 
    openingHours: contextOpeningHours, 
    userName: contextUserName, 
    salonTagline: contextSalonTagline, 
    salonLogoUrl: contextSalonLogoUrl,
    whatsappSchedulingMessage: contextWhatsappMessage,
    salonName: contextSalonName,
    salonAddress: contextSalonAddress,
    salonPhone: contextSalonPhone,
    clientLoginTitle: contextClientLoginTitle,
    clientLoginDescription: contextClientLoginDescription,
    stampValidityMessage: contextStampValidityMessage,
    themeColor: contextThemeColor,
    backgroundColor: contextBackgroundColor,
    appleTouchIconUrl: contextAppleTouchIconUrl,
    icon192Url: contextIcon192Url,
    icon512Url: contextIcon512Url,
    setAppSettingsState, 
    isLoadingSettings 
  } = useSettings();
  const { toast } = useToast();
  
  const [editableUserName, setEditableUserName] = React.useState(contextUserName);
  const [editableSalonTagline, setEditableSalonTagline] = React.useState(contextSalonTagline);
  const [editableSalonLogoUrl, setEditableSalonLogoUrl] = React.useState(contextSalonLogoUrl);
  const [editableWhatsappMessage, setEditableWhatsappMessage] = React.useState(contextWhatsappMessage);
  const [editableSalonName, setEditableSalonName] = React.useState(contextSalonName);
  const [editableSalonAddress, setEditableSalonAddress] = React.useState(contextSalonAddress);
  const [editableSalonPhone, setEditableSalonPhone] = React.useState(contextSalonPhone);
  const [editableClientLoginTitle, setEditableClientLoginTitle] = React.useState(contextClientLoginTitle);
  const [editableClientLoginDescription, setEditableClientLoginDescription] = React.useState(contextClientLoginDescription);
  const [editableStampValidityMessage, setEditableStampValidityMessage] = React.useState(contextStampValidityMessage);
  const [editableThemeColor, setEditableThemeColor] = React.useState(contextThemeColor);
  const [editableBackgroundColor, setEditableBackgroundColor] = React.useState(contextBackgroundColor);
  const [editableAppleTouchIconUrl, setEditableAppleTouchIconUrl] = React.useState(contextAppleTouchIconUrl);
  const [editableIcon192Url, setEditableIcon192Url] = React.useState(contextIcon192Url);
  const [editableIcon512Url, setEditableIcon512Url] = React.useState(contextIcon512Url);


  const [localOpeningHours, setLocalOpeningHours] = React.useState<DayOpeningHours[]>(
    contextOpeningHours && contextOpeningHours.length > 0 ? contextOpeningHours : initialDaysData
  );
  const [emailNotifications, setEmailNotifications] = React.useState(false);
  const [smsReminders, setSmsReminders] = React.useState(true);
  const [isInviteUserModalOpen, setIsInviteUserModalOpen] = React.useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [isBackupConfirmOpen, setIsBackupConfirmOpen] = React.useState(false);
  
  const [fileToRestore, setFileToRestore] = React.useState<File | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);


  // Sync local editable states when context changes
  React.useEffect(() => { setEditableUserName(contextUserName); }, [contextUserName]);
  React.useEffect(() => { setEditableSalonTagline(contextSalonTagline); }, [contextSalonTagline]);
  React.useEffect(() => { setEditableSalonLogoUrl(contextSalonLogoUrl); }, [contextSalonLogoUrl]);
  React.useEffect(() => { setEditableWhatsappMessage(contextWhatsappMessage); }, [contextWhatsappMessage]);
  React.useEffect(() => { setEditableSalonName(contextSalonName); }, [contextSalonName]);
  React.useEffect(() => { setEditableSalonAddress(contextSalonAddress); }, [contextSalonAddress]);
  React.useEffect(() => { setEditableSalonPhone(contextSalonPhone); }, [contextSalonPhone]);
  React.useEffect(() => { setEditableClientLoginTitle(contextClientLoginTitle); }, [contextClientLoginTitle]);
  React.useEffect(() => { setEditableClientLoginDescription(contextClientLoginDescription); }, [contextClientLoginDescription]);
  React.useEffect(() => { setEditableStampValidityMessage(contextStampValidityMessage); }, [contextStampValidityMessage]);
  React.useEffect(() => { setEditableThemeColor(contextThemeColor); }, [contextThemeColor]);
  React.useEffect(() => { setEditableBackgroundColor(contextBackgroundColor); }, [contextBackgroundColor]);
  React.useEffect(() => { setEditableAppleTouchIconUrl(contextAppleTouchIconUrl); }, [contextAppleTouchIconUrl]);
  React.useEffect(() => { setEditableIcon192Url(contextIcon192Url); }, [contextIcon192Url]);
  React.useEffect(() => { setEditableIcon512Url(contextIcon512Url); }, [contextIcon512Url]);
  React.useEffect(() => {
    if (contextOpeningHours && contextOpeningHours.length > 0) {
      setLocalOpeningHours(contextOpeningHours);
    }
  }, [contextOpeningHours]);


  const handleOpeningHoursChange = (dayOfWeekToChange: number, field: keyof DayOpeningHours, value: string | boolean) => {
    setLocalOpeningHours(prevHours =>
      prevHours.map(day =>
        day.dayOfWeek === dayOfWeekToChange ? { ...day, [field]: value } : day
      )
    );
  };


  const handleInviteUser = () => {
    if (!inviteEmail.includes('@')) {
        toast({
            variant: "destructive",
            title: "E-mail Inválido",
            description: "Por favor, insira um endereço de e-mail válido.",
        });
        return;
    }
    console.log("Convidar usuário com email:", inviteEmail);
    toast({
      title: "Convite Enviado (Simulação)",
      description: `Convite enviado para ${inviteEmail}.`,
    });
    setInviteEmail("");
    setIsInviteUserModalOpen(false);
  };

  const handleImportClients = () => {
    // In a real implementation, you would parse the selected file here.
    // For this simulation, we'll just show a success message.
    toast({
      title: "Importação Iniciada (Simulação)",
      description: `A importação de clientes foi iniciada. Você será notificado quando for concluída.`,
    });
    setIsImportModalOpen(false);
  };

  const handleBackup = async () => {
    try {
        await backupAllDataFS();
        toast({
            title: "Backup Concluído",
            description: "O arquivo de backup foi baixado com sucesso."
        });
    } catch (error) {
        console.error("Backup failed:", error);
        toast({
            variant: "destructive",
            title: "Falha no Backup",
            description: "Não foi possível gerar o arquivo de backup."
        });
    }
    setIsBackupConfirmOpen(false);
  };

  const handleSaveAllSettings = () => {
    const settingsToSave: Partial<AppSettings> = {
      openingHours: localOpeningHours,
      userName: editableUserName,
      salonTagline: editableSalonTagline,
      salonLogoUrl: editableSalonLogoUrl,
      whatsappSchedulingMessage: editableWhatsappMessage,
      salonName: editableSalonName,
      salonAddress: editableSalonAddress,
      salonPhone: editableSalonPhone,
      clientLoginTitle: editableClientLoginTitle,
      clientLoginDescription: editableClientLoginDescription,
      stampValidityMessage: editableStampValidityMessage,
      themeColor: editableThemeColor,
      backgroundColor: editableBackgroundColor,
      appleTouchIconUrl: editableAppleTouchIconUrl,
      icon192Url: editableIcon192Url,
      icon512Url: editableIcon512Url,
      // Theme is saved separately via its own context/handler
    };

    setAppSettingsState(settingsToSave); 

    console.log("Salvando Configurações Adicionais (localmente/simulado):", {
        notifications: {
            email: emailNotifications,
            sms: smsReminders,
        },
    });

    toast({
      title: "Configurações Salvas!",
      description: "Todas as configurações foram atualizadas.",
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === 'application/json') {
        setFileToRestore(file);
      } else {
        toast({ variant: "destructive", title: "Arquivo Inválido", description: "Por favor, selecione um arquivo .json válido." });
        setFileToRestore(null);
        event.target.value = ''; // Reset file input
      }
    }
  };

  const handleRestore = async () => {
    if (!fileToRestore) return;
    setIsRestoring(true);
    setIsRestoreConfirmOpen(false);
  
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error("Não foi possível ler o arquivo.");
        }
        const backupData = JSON.parse(text);
  
        // Basic validation of the backup file structure
        if (!backupData.clients || !backupData.appointments || !backupData.services) {
           throw new Error("O arquivo de backup parece estar corrompido ou em formato incorreto.");
        }
        
        const result = await restoreAllDataFS(backupData);
  
        if (result.success) {
          toast({ 
            title: "Restauração Concluída com Sucesso!", 
            description: "O sistema foi restaurado. A página será recarregada para aplicar as mudanças.",
            duration: 5000,
          });
          setTimeout(() => window.location.reload(), 3000); // Reload to reflect data everywhere
        } else {
          throw new Error(result.error || "Ocorreu um erro desconhecido durante a restauração.");
        }
  
      } catch (error: any) {
        console.error("Restore failed:", error);
        toast({ variant: "destructive", title: "Falha na Restauração", description: error.message, duration: 8000 });
      } finally {
        setIsRestoring(false);
        setFileToRestore(null);
        // It's tricky to reset a file input programmatically, but this is a common approach
        const fileInput = document.getElementById('json-restore-file') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
      }
    };
    reader.onerror = () => {
       toast({ variant: "destructive", title: "Erro de Leitura", description: "Não foi possível ler o arquivo selecionado." });
       setIsRestoring(false);
    }
    reader.readAsText(fileToRestore);
  };


  if (isLoadingSettings) {
    return <div className="font-body text-muted-foreground p-8 text-center">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-gradient flex items-center gap-3">
            <Settings className="h-7 w-7 text-primary" />
            Configurações do Salão
          </CardTitle>
          <CardDescription className="font-body">
            Personalize as configurações gerais do seu NailStudio AI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
            <AccordionItem value="item-1">
              <AccordionTrigger className="font-headline text-lg text-primary hover:no-underline">
                <UserCog className="mr-2 h-5 w-5 text-accent" /> Informações do Salão e Usuário
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="editableSalonName" className="font-body">Nome Principal do Salão</Label>
                  <Input id="editableSalonName" value={editableSalonName} onChange={(e) => setEditableSalonName(e.target.value)} className="focus:ring-accent font-body" placeholder="Ex: NailStudio AI" />
                </div>
                <div>
                  <Label htmlFor="editableSalonTagline" className="font-body">Tagline/Subtítulo do Salão (para Sidebar)</Label>
                  <Input id="editableSalonTagline" value={editableSalonTagline} onChange={(e) => setEditableSalonTagline(e.target.value)} className="focus:ring-accent font-body" placeholder="Ex: Salão Premium" />
                </div>
                 <div>
                  <Label htmlFor="editableUserName" className="font-body">Nome do Usuário Principal (para Sidebar)</Label>
                  <Input id="editableUserName" value={editableUserName} onChange={(e) => setEditableUserName(e.target.value)} className="focus:ring-accent font-body" placeholder="Ex: Ana Silva" />
                </div>
                <div>
                  <Label htmlFor="editableSalonLogoUrl" className="font-body">URL do Logo do Salão (para Sidebar)</Label>
                  <div className="flex items-center gap-2">
                    {editableSalonLogoUrl ? (
                         // eslint-disable-next-line @next/next/no-img-element
                        <img src={editableSalonLogoUrl} alt="Preview Logo" className="h-10 w-10 rounded-md border object-contain p-0.5" />
                    ) : (
                        <div className="h-10 w-10 rounded-md border bg-muted flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                    )}
                    <Input 
                        id="editableSalonLogoUrl" 
                        value={editableSalonLogoUrl} 
                        onChange={(e) => setEditableSalonLogoUrl(e.target.value)} 
                        className="focus:ring-accent font-body" 
                        placeholder="https://exemplo.com/logo.png" 
                    />
                  </div>
                   <p className="text-xs text-muted-foreground mt-1 font-body">Cole a URL de uma imagem hospedada publicamente.</p>
                </div>
                <div>
                  <Label htmlFor="editableSalonAddress" className="font-body">Endereço</Label>
                  <Input id="editableSalonAddress" value={editableSalonAddress} onChange={(e) => setEditableSalonAddress(e.target.value)} placeholder="Rua das Palmeiras, 123" className="focus:ring-accent font-body" />
                </div>
                <div>
                  <Label htmlFor="editableSalonPhone" className="font-body">Telefone para Contato e WhatsApp</Label>
                  <Input id="editableSalonPhone" value={editableSalonPhone} onChange={(e) => setEditableSalonPhone(e.target.value)} placeholder="(XX) XXXXX-XXXX" className="focus:ring-accent font-body" />
                   <p className="text-xs text-muted-foreground mt-1 font-body">Este número será usado no Portal do Cliente para o botão "Agendar via WhatsApp".</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-client-portal">
              <AccordionTrigger className="font-headline text-lg text-primary hover:no-underline">
                <Tv className="mr-2 h-5 w-5 text-accent" /> Personalização do Portal do Cliente
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                 <div>
                  <Label htmlFor="editableClientLoginTitle" className="font-body">Título da Tela de Login do Cliente</Label>
                  <Input id="editableClientLoginTitle" value={editableClientLoginTitle} onChange={(e) => setEditableClientLoginTitle(e.target.value)} className="focus:ring-accent font-body" placeholder="Ex: Portal do Cliente" />
                </div>
                <div>
                  <Label htmlFor="editableClientLoginDescription" className="font-body">Descrição da Tela de Login do Cliente</Label>
                  <Textarea 
                    id="editableClientLoginDescription" 
                    value={editableClientLoginDescription} 
                    onChange={(e) => setEditableClientLoginDescription(e.target.value)} 
                    className="focus:ring-accent font-body" 
                    placeholder="Ex: Acesse para ver seus agendamentos e promoções." 
                    rows={3}
                  />
                </div>
                 <div>
                  <Label htmlFor="editableWhatsappMessage" className="font-body">Mensagem Padrão para Agendamento via WhatsApp</Label>
                  <Textarea 
                    id="editableWhatsappMessage" 
                    value={editableWhatsappMessage} 
                    onChange={(e) => setEditableWhatsappMessage(e.target.value)} 
                    className="focus:ring-accent font-body" 
                    placeholder="Ex: Olá! Gostaria de verificar horários disponíveis." 
                    rows={3}
                  />
                   <p className="text-xs text-muted-foreground mt-1 font-body">Esta mensagem será usada no botão "Agendar Horário via WhatsApp" no portal do cliente.</p>
                </div>
                <div>
                  <Label htmlFor="editableStampValidityMessage" className="font-body">Mensagem de Validade dos Selos (Programa de Fidelidade)</Label>
                  <Textarea 
                    id="editableStampValidityMessage" 
                    value={editableStampValidityMessage} 
                    onChange={(e) => setEditableStampValidityMessage(e.target.value)} 
                    className="focus:ring-accent font-body" 
                    placeholder="Ex: Seus mimos não são acumulativos. Use antes de completar o próximo cartão!" 
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1 font-body">Esta mensagem aparecerá na seção de fidelidade do portal do cliente.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-pwa">
              <AccordionTrigger className="font-headline text-lg text-primary hover:no-underline">
                <ImageIcon className="mr-2 h-5 w-5 text-accent" /> PWA e Ícones da Tela Inicial
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <p className="font-body text-sm text-muted-foreground">Configure como seu app aparecerá quando instalado em um celular. Os caminhos dos ícones são relativos à pasta 'public', ex: /icons/icon-192.png</p>
                
                <div>
                  <Label htmlFor="editableAppleTouchIconUrl" className="font-body">URL do Ícone para Apple (apple-touch-icon)</Label>
                  <Input id="editableAppleTouchIconUrl" value={editableAppleTouchIconUrl} onChange={(e) => setEditableAppleTouchIconUrl(e.target.value)} className="focus:ring-accent font-body" placeholder="/apple-touch-icon.png" />
                </div>

                <div>
                  <Label htmlFor="editableIcon192Url" className="font-body">URL do Ícone 192x192</Label>
                  <Input id="editableIcon192Url" value={editableIcon192Url} onChange={(e) => setEditableIcon192Url(e.target.value)} className="focus:ring-accent font-body" placeholder="/android-chrome-192x192.png" />
                </div>

                <div>
                  <Label htmlFor="editableIcon512Url" className="font-body">URL do Ícone 512x512</Label>
                  <Input id="editableIcon512Url" value={editableIcon512Url} onChange={(e) => setEditableIcon512Url(e.target.value)} className="focus:ring-accent font-body" placeholder="/android-chrome-512x512.png" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="editableThemeColor" className="font-body">Cor do Tema do Navegador</Label>
                      <Input id="editableThemeColor" value={editableThemeColor} onChange={(e) => setEditableThemeColor(e.target.value)} className="focus:ring-accent font-body" placeholder="#E62E7B" />
                    </div>
                    <div>
                      <Label htmlFor="editableBackgroundColor" className="font-body">Cor de Fundo da Splash Screen</Label>
                      <Input id="editableBackgroundColor" value={editableBackgroundColor} onChange={(e) => setEditableBackgroundColor(e.target.value)} className="focus:ring-accent font-body" placeholder="#FFFFFF" />
                    </div>
                </div>
              </AccordionContent>
            </AccordionItem>


            <AccordionItem value="item-2">
              <AccordionTrigger className="font-headline text-lg text-primary hover:no-underline">
                <Clock className="mr-2 h-5 w-5 text-accent" /> Horário de Funcionamento
              </AccordionTrigger>
              <AccordionContent className="space-y-6 pt-2">
                 <p className="font-body text-sm text-muted-foreground">Defina os horários de atendimento do salão para cada dia da semana.</p>
                 <div className="space-y-4">
                    {localOpeningHours.map(day => (
                        <div key={day.dayOfWeek} className="grid grid-cols-1 md:grid-cols-[120px_1fr_120px_120px] items-center gap-3 p-3 border rounded-md">
                            <Label htmlFor={`open-${day.dayOfWeek}`} className="font-body font-semibold">{day.name}</Label>
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id={`open-${day.dayOfWeek}`}
                                    checked={day.isOpen}
                                    onCheckedChange={(checked) => handleOpeningHoursChange(day.dayOfWeek, 'isOpen', checked)}
                                />
                                <Label htmlFor={`open-${day.dayOfWeek}`} className="font-body text-sm">{day.isOpen ? "Aberto" : "Fechado"}</Label>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor={`openTime-${day.dayOfWeek}`} className="font-body text-xs">Abertura</Label>
                                <Select
                                    value={day.openTime}
                                    onValueChange={(value) => handleOpeningHoursChange(day.dayOfWeek, 'openTime', value)}
                                    disabled={!day.isOpen}
                                >
                                    <SelectTrigger id={`openTime-${day.dayOfWeek}`} className="focus:ring-accent font-body text-sm h-9">
                                        <SelectValue placeholder="HH:MM" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {timeSlots.map(slot => (
                                            <SelectItem key={`open-${day.dayOfWeek}-${slot}`} value={slot} className="font-body text-sm">{slot}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor={`closeTime-${day.dayOfWeek}`} className="font-body text-xs">Fechamento</Label>
                                <Select
                                    value={day.closeTime}
                                    onValueChange={(value) => handleOpeningHoursChange(day.dayOfWeek, 'closeTime', value)}
                                    disabled={!day.isOpen}
                                >
                                    <SelectTrigger id={`closeTime-${day.dayOfWeek}`} className="focus:ring-accent font-body text-sm h-9">
                                        <SelectValue placeholder="HH:MM" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {timeSlots.map(slot => (
                                            <SelectItem key={`close-${day.dayOfWeek}-${slot}`} value={slot} className="font-body text-sm">{slot}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ))}
                 </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="font-headline text-lg text-primary hover:no-underline">
                <Bell className="mr-2 h-5 w-5 text-accent" /> Notificações
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="flex items-center justify-between space-x-2 p-3 rounded-md border border-border">
                  <Label htmlFor="notificationEmail" className="font-body flex-grow cursor-pointer">Receber notificações por e-mail sobre novos agendamentos</Label>
                  <Switch id="notificationEmail" checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                </div>
                <div className="flex items-center justify-between space-x-2 p-3 rounded-md border border-border">
                  <Label htmlFor="notificationSms" className="font-body flex-grow cursor-pointer">Enviar lembretes de agendamento por SMS para clientes</Label>
                  <Switch id="notificationSms" checked={smsReminders} onCheckedChange={setSmsReminders} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="font-headline text-lg text-primary hover:no-underline">
                <Users className="mr-2 h-5 w-5 text-accent" /> Gerenciamento de Usuários
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                 <p className="font-body text-sm text-muted-foreground">Adicione ou gerencie os usuários com acesso ao painel.</p>
                 <Dialog open={isInviteUserModalOpen} onOpenChange={setIsInviteUserModalOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="border-accent text-accent hover:bg-accent/10 font-body">
                            <UserPlus className="mr-2 h-4 w-4" /> Convidar Novo Usuário
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] bg-card">
                        <DialogHeader>
                        <DialogTitle className="font-headline text-gradient">Convidar Novo Usuário</DialogTitle>
                        <DialogDescription className="font-body">
                            Insira o e-mail do usuário que você deseja convidar para o sistema.
                        </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="inviteEmail" className="text-right font-body">
                                E-mail
                                </Label>
                                <Input
                                id="inviteEmail"
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="usuario@example.com"
                                className="col-span-3 focus:ring-accent font-body"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline" className="font-body">Cancelar</Button>
                            </DialogClose>
                            <Button type="button" onClick={handleInviteUser} className="font-body bg-primary text-primary-foreground hover:bg-primary/90">
                                Enviar Convite
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                 </Dialog>
                 <div className="mt-4 border-t pt-4">
                    <h4 className="font-headline text-md text-muted-foreground mb-2">Usuários Existentes:</h4>
                    <p className="font-body text-sm text-muted-foreground">(Lista de usuários será exibida aqui)</p>
                 </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5">
              <AccordionTrigger className="font-headline text-lg text-primary hover:no-underline">
                <Upload className="mr-2 h-5 w-5 text-accent" /> Importação de Dados
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                 <p className="font-body text-sm text-muted-foreground">Importe seus dados de outras fontes para o NailStudio AI.</p>
                 <Card>
                  <CardHeader>
                    <CardTitle className="font-headline text-md">Importar Clientes</CardTitle>
                    <CardDescription className="font-body text-xs">
                      Importe uma lista de clientes de um arquivo CSV. O arquivo deve conter as colunas: 'name', 'email', 'phone'.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="font-body">
                                <FileUp className="mr-2 h-4 w-4" /> Iniciar Importação de Clientes
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[480px] bg-card">
                            <DialogHeader>
                                <DialogTitle className="font-headline text-gradient">Importar Clientes de CSV</DialogTitle>
                                <DialogDescription className="font-body">
                                    Selecione o arquivo CSV para importar. O formato esperado é: uma linha por cliente, com as colunas `name`, `email`, e `phone`.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                               <div className="grid w-full max-w-sm items-center gap-1.5">
                                  <Label htmlFor="csv-file" className="font-body">Arquivo CSV</Label>
                                  <Input id="csv-file" type="file" accept=".csv" className="font-body file:text-primary file:font-semibold"/>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline" className="font-body">Cancelar</Button>
                                </DialogClose>
                                <Button type="button" onClick={handleImportClients} className="font-body bg-primary text-primary-foreground hover:bg-primary/90">
                                    Importar Arquivo
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                  </CardContent>
                 </Card>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger className="font-headline text-lg text-primary hover:no-underline">
                <Database className="mr-2 h-5 w-5 text-accent" /> Backup Geral
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                 <p className="font-body text-sm text-muted-foreground">Crie uma cópia de segurança de todos os dados do seu sistema. O arquivo será salvo no seu computador em formato JSON.</p>
                 <Card>
                  <CardHeader>
                    <CardTitle className="font-headline text-md">Backup Completo do Banco de Dados</CardTitle>
                    <CardDescription className="font-body text-xs">
                      Esta ação irá baixar todos os dados do seu salão, incluindo clientes, agendamentos, finanças e configurações. Guarde este arquivo em um local seguro.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                     <Button variant="outline" className="font-body border-accent text-accent hover:bg-accent/10" onClick={() => setIsBackupConfirmOpen(true)}>
                        <Download className="mr-2 h-4 w-4" /> Iniciar Backup Geral
                    </Button>
                  </CardContent>
                 </Card>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7" className="border-b-0">
              <AccordionTrigger className="font-headline text-lg text-destructive hover:no-underline">
                <Database className="mr-2 h-5 w-5 text-destructive" /> Restaurar a partir de Backup
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive dark:text-red-300">
                    <h4 className="font-bold font-body flex items-center gap-2"><AlertTriangle className="h-5 w-5"/> Ação Perigosa e Irreversível</h4>
                    <p className="font-body text-sm mt-1">
                        Restaurar um backup <strong className="font-bold">SUBSTITUIRÁ TODOS</strong> os dados atuais do sistema pelos dados do arquivo. Faça um backup dos dados atuais antes de continuar.
                    </p>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="font-headline text-md">Restaurar a partir de arquivo</CardTitle>
                    <CardDescription className="font-body text-xs">
                      Selecione o arquivo de backup (.json) que você baixou anteriormente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                     <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="json-restore-file" className="font-body">Arquivo .json</Label>
                        <Input id="json-restore-file" type="file" accept=".json" onChange={handleFileSelect} className="font-body file:text-primary file:font-semibold" disabled={isRestoring} />
                     </div>
                    <Button
                        variant="destructive"
                        className="w-full sm:w-auto mt-4 sm:mt-0"
                        onClick={() => {if (fileToRestore) setIsRestoreConfirmOpen(true)}}
                        disabled={!fileToRestore || isRestoring}
                    >
                        {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                        {isRestoring ? "Restaurando..." : "Iniciar Restauração"}
                    </Button>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

          </Accordion>

          <div className="mt-8 pt-6 border-t">
            <Button size="lg" onClick={handleSaveAllSettings} className="w-full md:w-auto bg-gradient-to-r from-primary to-accent text-accent-foreground hover:opacity-90 font-body">
              <Save className="mr-2 h-5 w-5" /> Salvar Todas as Configurações
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={isBackupConfirmOpen} onOpenChange={setIsBackupConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-gradient">Confirmar Backup Geral</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Tem certeza que deseja criar um backup completo de todos os dados do sistema?
              O processo pode levar alguns instantes dependendo da quantidade de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsBackupConfirmOpen(false)} className="font-body">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBackup} className="bg-primary hover:bg-primary/90 font-body">Confirmar e Baixar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-destructive flex items-center gap-2"><AlertTriangle/>Você tem CERTEZA ABSOLUTA?</AlertDialogTitle>
            <AlertDialogDescription className="font-body space-y-2">
                <p>Esta ação <strong className="text-destructive-foreground bg-destructive px-1 rounded-sm">DELETARÁ PERMANENTEMENTE</strong> todos os dados atuais (clientes, agendamentos, finanças, etc.) e os substituirá pelo conteúdo do arquivo de backup.</p>
                <p><strong>Esta ação não pode ser desfeita.</strong></p>
                <p>Recomendamos fortemente que você faça um backup dos dados atuais antes de prosseguir.</p>
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsRestoreConfirmOpen(false)} className="font-body">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} className="bg-destructive hover:bg-destructive/90 font-body">Sim, entendo o risco. Restaurar.</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
