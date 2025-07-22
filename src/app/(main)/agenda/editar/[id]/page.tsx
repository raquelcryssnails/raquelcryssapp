
"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { AppointmentForm } from "@/components/agenda/appointment-form";
import { getAppointmentFS } from "@/lib/firebase/firestoreService";
import type { Appointment } from "@/types/firestore";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parse } from "date-fns";

export default function EditAppointmentPage() {
  const params = useParams();
  const appointmentId = params.id as string;
  const { toast } = useToast();
  const [appointmentData, setAppointmentData] = React.useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  
  React.useEffect(() => {
    if (appointmentId) {
      const fetchAppointment = async () => {
        try {
          const data = await getAppointmentFS(appointmentId);
          if (data) {
            setAppointmentData(data);
          } else {
            toast({ variant: "destructive", title: "Erro", description: "Agendamento não encontrado." });
          }
        } catch (error) {
          toast({ variant: "destructive", title: "Erro ao Carregar", description: "Não foi possível buscar os dados do agendamento." });
        } finally {
          setIsLoading(false);
        }
      };
      fetchAppointment();
    }
  }, [appointmentId, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 font-body text-muted-foreground">Carregando agendamento...</p>
      </div>
    );
  }

  if (!appointmentData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="font-body text-muted-foreground">Agendamento não pôde ser carregado.</p>
      </div>
    );
  }

  const defaultValues = {
    ...appointmentData,
    date: parse(appointmentData.date, "yyyy-MM-dd", new Date()),
    discount: appointmentData.discount?.replace('.', ',') || "0,00",
    extraAmount: appointmentData.extraAmount?.replace('.', ',') || "0,00",
    totalAmount: appointmentData.totalAmount?.replace('.', ',') || "0,00",
  };

  return (
    <AppointmentForm
      pageTitle="Editar Agendamento"
      pageDescription="Altere os dados do agendamento abaixo."
      actionButtonText="Salvar Alterações"
      editingAppointment={appointmentData}
      defaultValues={defaultValues}
    />
  );
}
