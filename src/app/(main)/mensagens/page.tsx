"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Search, Send, Loader2, Bot, User, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase/config";
import { collection, query, onSnapshot, orderBy, doc, Timestamp } from "firebase/firestore";
import { getClientsFS, sendMessageFS, markConversationAsReadByAdminFS, getClientFS } from "@/lib/firebase/firestoreService";
import type { Client, Conversation, Message } from "@/types/firestore";
import { formatDistanceToNow, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MensagensPage() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [isLoadingClients, setIsLoadingClients] = React.useState(true);
  const [isLoadingConversations, setIsLoadingConversations] = React.useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [currentMessage, setCurrentMessage] = React.useState("");
  const { toast } = useToast();
  const messagesEndRef = React.useRef<HTMLDivElement>(null);


  // Effect to fetch the static list of clients once
  React.useEffect(() => {
    const fetchClientsData = async () => {
      setIsLoadingClients(true);
      try {
        const fetchedClients = await getClientsFS();
        setClients(fetchedClients);
      } catch (error) {
        console.error("Error fetching clients:", error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar a lista de clientes." });
      } finally {
        setIsLoadingClients(false);
      }
    };
    fetchClientsData();
  }, [toast]);

  // Effect to listen for real-time updates on conversations
  React.useEffect(() => {
    const q = query(collection(db, "conversations"), orderBy("lastMessageTimestamp", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const convos: Conversation[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const lastMessageTimestamp = data.lastMessageTimestamp instanceof Timestamp
          ? data.lastMessageTimestamp.toDate().toISOString()
          : data.lastMessageTimestamp;
        
        convos.push({
          id: doc.id,
          clientId: data.clientId,
          clientName: data.clientName,
          lastMessage: data.lastMessage,
          lastMessageTimestamp: lastMessageTimestamp,
          unreadByAdmin: data.unreadByAdmin,
          unreadByClient: data.unreadByClient,
        } as Conversation);
      });
      setConversations(convos);
      setIsLoadingConversations(false);
    }, (error) => {
      console.error("Error listening to conversations:", error);
      toast({ variant: "destructive", title: "Erro de Conexão", description: "Não foi possível carregar as conversas." });
      setIsLoadingConversations(false);
    });

    return () => unsubscribe();
  }, [toast]);

  // Effect to listen for messages in the selected conversation
  React.useEffect(() => {
    if (!selectedClient?.id) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    const messagesQuery = query(
      collection(db, "conversations", selectedClient.id, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(messagesQuery, (querySnapshot) => {
      const newMessages: Message[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : data.createdAt;
        
        newMessages.push({
          id: doc.id,
          conversationId: data.conversationId,
          senderId: data.senderId,
          senderType: data.senderType,
          text: data.text,
          createdAt: createdAt,
        });
      });
      setMessages(newMessages);
      setIsLoadingMessages(false);
    }, (error) => {
      console.error(`Error fetching messages for client ${selectedClient.id}:`, error);
      toast({ variant: "destructive", title: "Erro ao Carregar", description: "Não foi possível carregar as mensagens desta conversa." });
      setIsLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [selectedClient?.id, toast]);
  
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  // Create a combined list for the sidebar
  const conversationList = React.useMemo(() => {
    const conversationMap = new Map(conversations.map(c => [c.clientId, c]));
    const combinedList: (Conversation & { client?: Client })[] = [];

    clients.forEach(client => {
      if (conversationMap.has(client.id)) {
        const convo = conversationMap.get(client.id)!;
        combinedList.push({ ...convo, client });
        conversationMap.delete(client.id); // Remove from map to avoid duplicates
      } else {
        // Create a placeholder conversation for clients without one yet
        combinedList.push({
          id: client.id,
          clientId: client.id,
          clientName: client.name,
          lastMessage: "Nenhuma mensagem ainda.",
          lastMessageTimestamp: new Date(0).toISOString(),
          unreadByAdmin: false,
          unreadByClient: false,
          client,
        });
      }
    });

    // Add conversations for clients who might have been deleted but still have a chat history
    conversationMap.forEach(convo => {
      combinedList.push(convo); // client property will be undefined
    });

    // Sort: unread first, then by timestamp
    combinedList.sort((a, b) => {
      if (a.unreadByAdmin && !b.unreadByAdmin) return -1;
      if (!a.unreadByAdmin && b.unreadByAdmin) return 1;
      const timeA = a.lastMessageTimestamp && isValid(parseISO(a.lastMessageTimestamp as string)) ? parseISO(a.lastMessageTimestamp as string).getTime() : 0;
      const timeB = b.lastMessageTimestamp && isValid(parseISO(b.lastMessageTimestamp as string)) ? parseISO(b.lastMessageTimestamp as string).getTime() : 0;
      return timeB - timeA;
    });

    return combinedList;
  }, [clients, conversations]);

  const filteredConversationList = conversationList.filter(convo =>
    convo.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectConversation = async (clientId: string) => {
      const client = clients.find(c => c.id === clientId);
      if (!client) {
          toast({ variant: "destructive", title: "Erro", description: "Cliente não encontrado." });
          return;
      }
      if (selectedClient?.id === client.id) return;
      
      setSelectedClient(client);
      await markConversationAsReadByAdminFS(client.id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentMessage.trim() || !selectedClient) return;
      
      const messageToSend = currentMessage;
      setCurrentMessage("");
      try {
          await sendMessageFS(selectedClient.id, selectedClient.name, messageToSend, 'admin');
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      } catch (error) {
          console.error("Error sending message:", error);
          toast({
              variant: "destructive",
              title: "Erro ao Enviar",
              description: "Não foi possível enviar a mensagem.",
          });
          setCurrentMessage(messageToSend); // Put message back on error
      }
  };

  const fallbackAvatarText = (name: string) => name ? name.substring(0, 2).toUpperCase() : "CL";
  
  const formatTimestamp = (timestamp: string | Timestamp) => {
    if (!timestamp) return "";
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : parseISO(timestamp);
    if (!isValid(date)) return "";
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-lg rounded-xl overflow-hidden h-[calc(100vh-12rem)] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="font-headline text-2xl text-gradient flex items-center gap-3">
            <MessageSquare className="h-7 w-7 text-primary" />
            Central de Mensagens
          </CardTitle>
          <CardDescription className="font-body">
            Converse em tempo real com seus clientes.
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
                {isLoadingClients || isLoadingConversations ? (
                    <div className="flex justify-center items-center h-full p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : filteredConversationList.length > 0 ? (
                    <div className="p-2 space-y-1">
                        {filteredConversationList.map(convo => (
                            <Button 
                                key={convo.id}
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start h-auto py-2 px-3 flex items-center gap-3",
                                    selectedClient?.id === convo.clientId && "bg-accent text-accent-foreground"
                                )}
                                onClick={() => handleSelectConversation(convo.clientId)}
                                disabled={!convo.client}
                            >
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={`https://placehold.co/40x40.png`} alt={convo.clientName} data-ai-hint="person avatar" />
                                    <AvatarFallback>{fallbackAvatarText(convo.clientName)}</AvatarFallback>
                                </Avatar>
                                <div className="text-left flex-grow overflow-hidden">
                                    <p className="font-semibold font-body text-sm truncate">{convo.clientName}</p>
                                    <p className={cn("text-xs truncate", convo.unreadByAdmin ? "text-accent-foreground font-medium" : "text-muted-foreground")}>
                                      {convo.lastMessage}
                                    </p>
                                </div>
                                {convo.unreadByAdmin && (
                                  <Circle className="h-2.5 w-2.5 fill-current text-primary flex-shrink-0" />
                                )}
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
                        {isLoadingMessages ? (
                            <div className="flex justify-center items-center h-full p-4">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : (
                            messages.map(msg => (
                                <div 
                                    key={msg.id} 
                                    className={cn(
                                        "flex items-end gap-2 max-w-[80%] sm:max-w-[70%]",
                                        msg.senderType === 'admin' ? "ml-auto flex-row-reverse" : "mr-auto"
                                    )}
                                >
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback>
                                            {msg.senderType === 'admin' ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <div className={cn(
                                            "p-3 rounded-lg shadow-sm font-body text-sm",
                                            msg.senderType === 'admin' 
                                                ? "bg-primary text-primary-foreground rounded-br-none" 
                                                : "bg-muted text-muted-foreground rounded-bl-none"
                                        )}>
                                            {msg.text}
                                        </div>
                                        <span className={cn(
                                          "text-xs text-muted-foreground/70 mt-1 px-1",
                                          msg.senderType === 'admin' ? "text-right" : "text-left"
                                        )}>
                                          {formatTimestamp(msg.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                         <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                <div className="p-4 border-t border-border flex-shrink-0 bg-card">
                  <form onSubmit={handleSendMessage}>
                    <div className="relative">
                        <Input
                            placeholder="Digite sua mensagem..."
                            className="pr-12"
                            value={currentMessage}
                            onChange={(e) => setCurrentMessage(e.target.value)}
                            disabled={isLoadingMessages}
                        />
                        <Button
                            type="submit"
                            size="icon"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7"
                            disabled={!currentMessage.trim() || isLoadingMessages}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                  </form>
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
