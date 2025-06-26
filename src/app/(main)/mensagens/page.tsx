
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Search, Send, Loader2, Bot, User } from "lucide-react";
import { getClientsFS } from "@/lib/firebase/firestoreService";
import type { Client } from "@/types/firestore";
import { cn } from "@/lib/utils";

// Mock messages for demonstration purposes
const mockMessages = (clientName: string) => [
  {
    id: "1",
    sender: "bot",
    text: `Olá ${clientName}! Este é um canal de comunicação direto com nosso salão. Como podemos ajudar hoje?`,
    timestamp: "10:00",
  },
  {
    id: "2",
    sender: "user",
    text: "Oi! Eu gostaria de saber se vocês têm horário para amanhã.",
    timestamp: "10:01",
  },
  {
    id: "3",
    sender: "bot",
    text: "Claro! Para qual serviço você gostaria de agendar?",
    timestamp: "10:02",
  },
];


export default function MensagensPage() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [currentMessage, setCurrentMessage] = React.useState("");
  const { toast } = useToast();

  const fetchClients = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedClients = await getClientsFS();
      setClients(fetchedClients);
      if (fetchedClients.length > 0) {
          // No auto-selection to let user choose
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar a lista de clientes." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendMessage = () => {
    if (!currentMessage.trim() || !selectedClient) return;
    toast({
        title: "Mensagem Enviada (Simulação)",
        description: `Sua mensagem para ${selectedClient.name} foi enviada.`,
    });
    setCurrentMessage("");
    // In a real app, you would add the message to the state and send it to the backend.
  };

  const fallbackAvatarText = (name: string) => name ? name.substring(0, 2).toUpperCase() : "CL";

  return (
    <div className="space-y-6">
      <Card className="shadow-lg rounded-xl overflow-hidden h-[calc(100vh-12rem)] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="font-headline text-2xl text-gradient flex items-center gap-3">
            <MessageSquare className="h-7 w-7 text-primary" />
            Central de Mensagens
          </CardTitle>
          <CardDescription className="font-body">
            Gerencie suas conversas com clientes. Esta é uma interface de demonstração.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow p-0 grid grid-cols-1 md:grid-cols-[320px_1fr] h-full overflow-hidden">
          {/* Conversations List */}
          <div className="border-r border-border flex flex-col h-full bg-muted/30">
            <div className="p-4 border-b border-border">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Buscar cliente..."
                        className="pl-8 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <ScrollArea className="flex-grow">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : filteredClients.length > 0 ? (
                    <div className="p-2 space-y-1">
                        {filteredClients.map(client => (
                            <Button 
                                key={client.id}
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start h-auto py-2 px-3 flex items-center gap-3",
                                    selectedClient?.id === client.id && "bg-accent text-accent-foreground"
                                )}
                                onClick={() => setSelectedClient(client)}
                            >
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={`https://placehold.co/40x40.png`} alt={client.name} data-ai-hint="person avatar" />
                                    <AvatarFallback>{fallbackAvatarText(client.name)}</AvatarFallback>
                                </Avatar>
                                <div className="text-left">
                                    <p className="font-semibold font-body text-sm">{client.name}</p>
                                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">Clique para ver a conversa...</p>
                                </div>
                            </Button>
                        ))}
                    </div>
                ) : (
                    <p className="p-4 text-center text-sm text-muted-foreground font-body">Nenhum cliente encontrado.</p>
                )}
            </ScrollArea>
          </div>

          {/* Chat Window */}
          <div className="flex flex-col h-full">
            {selectedClient ? (
              <>
                <div className="flex items-center gap-3 p-3 border-b border-border flex-shrink-0 bg-card">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={`https://placehold.co/40x40.png`} alt={selectedClient.name} data-ai-hint="person avatar" />
                        <AvatarFallback>{fallbackAvatarText(selectedClient.name)}</AvatarFallback>
                    </Avatar>
                    <p className="font-semibold font-headline text-lg">{selectedClient.name}</p>
                </div>

                <ScrollArea className="flex-grow bg-background/50">
                    <div className="p-4 space-y-4">
                        {mockMessages(selectedClient.name).map(msg => (
                            <div 
                                key={msg.id} 
                                className={cn(
                                    "flex items-end gap-2 max-w-lg",
                                    msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                                )}
                            >
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback>
                                        {msg.sender === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                                    </AvatarFallback>
                                </Avatar>
                                <div className={cn(
                                    "p-3 rounded-lg shadow-sm font-body text-sm",
                                    msg.sender === 'user' 
                                        ? "bg-primary text-primary-foreground rounded-br-none" 
                                        : "bg-muted text-muted-foreground rounded-bl-none"
                                )}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t border-border flex-shrink-0 bg-card">
                    <div className="relative">
                        <Input
                            placeholder="Digite sua mensagem..."
                            className="pr-12"
                            value={currentMessage}
                            onChange={(e) => setCurrentMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <Button
                            type="submit"
                            size="icon"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={handleSendMessage}
                            disabled={!currentMessage.trim()}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
              </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="font-headline text-lg text-muted-foreground">
                        Selecione uma conversa
                    </p>
                    <p className="font-body text-sm text-muted-foreground max-w-xs">
                        Escolha um cliente na lista à esquerda para visualizar o histórico de mensagens e se comunicar.
                    </p>
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
