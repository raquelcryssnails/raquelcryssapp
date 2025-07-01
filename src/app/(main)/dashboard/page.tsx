
"use client";

import * as React from "react";
import { Users, CalendarCheck, DollarSign, Award, ScissorsIcon, BarChart, RefreshCw } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AiMarketingCard } from "@/components/dashboard/ai-marketing-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getAppointmentsFS, getClientsFS, getFinancialTransactionsFS } from "@/lib/firebase/firestoreService";
import type { Appointment, Client, FinancialTransaction } from "@/types/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const quickAccessLinks = [
  { href: "/agenda", label: "Agenda Completa", icon: CalendarCheck, color: "text-primary" },
  { href: "/clientes", label: "Novo Cliente", icon: Users, color: "text-accent" },
  { href: "/servicos", label: "Ver Serviços", icon: ScissorsIcon, color: "text-green-500" },
  { href: "/relatorios", label: "Ver Relatórios", icon: BarChart, color: "text-blue-500" },
];

function DynamicDateDisplay() {
  const [currentDate, setCurrentDate] = React.useState('');

  React.useEffect(() => {
    const today = new Date();
    const dayOfWeek = format(today, "EEEE", { locale: ptBR });
    const capitalizedDayOfWeek = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    const day = format(today, "d", { locale: ptBR });
    const month = format(today, "MMMM", { locale: ptBR });
    const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
    const year = format(today, "yyyy", { locale: ptBR });
    setCurrentDate(`${capitalizedDayOfWeek}, ${day} de ${capitalizedMonth} de ${year}`);
  }, []); 

  if (!currentDate) {
    return <p className="text-md text-muted-foreground font-body mb-6 text-center md:text-left -mt-2 h-5"> </p>; 
  }

  return (
    <p className="text-md text-muted-foreground font-body mb-6 text-center md:text-left -mt-2">
      {currentDate}
    </p>
  );
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [appointmentsTodayCount, setAppointmentsTodayCount] = React.useState(0);
  const [totalClientsCount, setTotalClientsCount] = React.useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = React.useState("R$ 0,00");
  const [loyaltyClientsCount, setLoyaltyClientsCount] = React.useState(0);
  const [todaysAppointmentsListForMetric, setTodaysAppointmentsListForMetric] = React.useState<Appointment[]>([]);
  const { toast } = useToast();

  const fetchDashboardData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const [allAppointments, allClients, allFinancialTransactions] = await Promise.all([ 
        getAppointmentsFS(),
        getClientsFS(),
        getFinancialTransactionsFS(),
      ]);

      const todayFilteredAppointments = allAppointments.filter(apt => apt.date === todayStr);
      setAppointmentsTodayCount(todayFilteredAppointments.length);
      setTodaysAppointmentsListForMetric(todayFilteredAppointments);

      setTotalClientsCount(allClients.length);

      const currentMonth = format(new Date(), "yyyy-MM");
      const revenue = allFinancialTransactions
        .filter(ft => ft.type === "income" && ft.date.startsWith(currentMonth))
        .reduce((sum, ft) => {
            const value = parseFloat(ft.amount?.replace(',', '.') || '0');
            return sum + (isNaN(value) ? 0 : value);
        }, 0);
      setMonthlyRevenue(`R$ ${revenue.toFixed(2).replace('.', ',')}`);
      
      const loyalty = allClients.filter(client => (client.stampsEarned || 0) > 0 || (client.purchasedPackages && client.purchasedPackages.length > 0)).length; 
      setLoyaltyClientsCount(loyalty);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({ variant: "destructive", title: "Erro ao buscar dados", description: "Não foi possível carregar os dados do dashboard." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex justify-between items-center">
        <DynamicDateDisplay />
        <Button variant="outline" size="sm" onClick={fetchDashboardData} disabled={isLoading} className="font-body">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar Dados
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Agendamentos Hoje"
          value={isLoading ? "..." : appointmentsTodayCount}
          icon={CalendarCheck}
          description={isLoading ? "" : `${todaysAppointmentsListForMetric.filter(a => a.status === "Confirmado").length} confirmados`}
          iconClassName="text-primary"
          href="/agenda-diaria"
        />
        <MetricCard
          title="Total de Clientes"
          value={isLoading ? "..." : totalClientsCount}
          icon={Users}
          description={isLoading ? "" : "Clientes cadastrados"}
          iconClassName="text-accent"
          href="/clientes"
        />
        <MetricCard
          title="Faturamento do Mês"
          value={isLoading ? "..." : monthlyRevenue}
          icon={DollarSign}
          description={isLoading ? "" : "Receita de serviços e pacotes"}
          iconClassName="text-green-500"
        />
        <MetricCard
          title="Clientes Fidelidade"
          value={isLoading ? "..." : loyaltyClientsCount}
          icon={Award}
          description={isLoading ? "" : "Com selos ou pacotes ativos"}
          iconClassName="text-yellow-500"
        />
      </div>

      <Card className="shadow-xl rounded-xl overflow-hidden">
        <CardHeader>
          <CardTitle className="font-headline text-gradient">Acesso Rápido</CardTitle>
          <CardDescription className="font-body">Atalhos para as funções mais usadas.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 [perspective:1000px]">
          {quickAccessLinks.map((link) => (
            <Link key={link.href} href={link.href} className="block h-full">
              <Card className="group flex h-full flex-col items-center justify-center p-4 text-center transition-transform duration-500 ease-in-out [transform-style:preserve-3d] hover:-translate-y-1 hover:shadow-2xl hover:[transform:rotateY(10deg)] hover:bg-accent/10">
                <link.icon className={`h-8 w-8 mb-2 ${link.color}`} />
                <p className="text-sm font-medium font-body text-foreground">
                  {link.label}
                </p>
              </Card>
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-6 md:space-y-8">
        <AiMarketingCard />
        {/* AppointmentsToday component is removed from here */}
      </div>
    </div>
  );
}
