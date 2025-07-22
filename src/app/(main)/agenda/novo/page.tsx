
"use client";

import * as React from "react";
import { AppointmentForm } from "@/components/agenda/appointment-form";
import { useSearchParams } from 'next/navigation';
import { startOfDay } from "date-fns";

export default function NewAppointmentPage() {
  const searchParams = useSearchParams();
  
  const dateParam = searchParams.get('date');
  const startTimeParam = searchParams.get('startTime');
  const professionalIdParam = searchParams.get('professionalId');

  const initialDate = dateParam ? new Date(dateParam) : startOfDay(new Date());
  // Adjust date to account for timezone issues when creating from string
  const timezoneOffset = initialDate.getTimezoneOffset() * 60000;
  const correctedDate = new Date(initialDate.getTime() + timezoneOffset);


  const defaultValues = {
    date: correctedDate,
    startTime: startTimeParam || "",
    professionalId: professionalIdParam || "",
  };

  return (
    <AppointmentForm
      pageTitle="Novo Agendamento"
      pageDescription="Preencha os dados para criar um novo agendamento."
      actionButtonText="Criar Agendamento"
      defaultValues={defaultValues}
    />
  );
}
