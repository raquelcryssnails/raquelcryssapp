
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Search, Send, Loader2, Bot, User, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase/config";
import { collection, query, onSnapshot, orderBy, doc, Timestamp } from "firebase/firestore";
import { getClientsFS, sendMessageFS, markConversationAsReadByAdminFS } from "@/lib/firebase/firestoreService";
import type { Client, Conversation, Message } from "@/types/firestore";
import { formatDistanceToNow, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const cardColorPalettes = [
  { bg: 'bg-violet-50 dark:bg-violet-900/30', border: 'border-violet-400 dark:border-violet-600', text: 'text-violet-700 dark:text-violet-300' },
  { bg: 'bg-sky-50 dark:bg-sky-900/30', border: 'border-sky-400 dark:border-sky-600', text: 'text-sky-700 dark:text-sky-300' },
  { bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-400 dark:border-emerald-600', text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-400 dark:border-amber-600', text: 'text-amber-700 dark:text-amber-300' },
  { bg: 'bg-rose-50 dark:bg-rose-900/30', border: 'border-rose-400 dark:border-rose-600', text: 'text-rose-700 dark:text-rose-300' },
  { bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/30', border: 'border-fuchsia-400 dark:border-fuchsia-600', text: 'text-fuchsia-700 dark:text-fuchsia-300' },
];


export default function MensagensPage() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
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
      setSelectedClient(client);
      setIsModalOpen(true);
      await markConversationAsReadByAdminFS(client.id);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedClient(null);
  }

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

  const fallbackAvatarText = (name: string) => {
    if (!name) return "CL";
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length > 1 && parts[0] && parts[1]) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0] ? parts[0].substring(0, 2).toUpperCase() : "CL";
  };
  
  const formatTimestamp = (timestamp: string | Timestamp) => {
    if (!timestamp) return "";
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : parseISO(timestamp);
    if (!isValid(date)) return "";
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-lg rounded-xl overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="font-headline text-2xl text-gradient flex items-center gap-3">
            <MessageSquare className="h-7 w-7 text-primary" />
            Central de Mensagens
          </CardTitle>
          <CardDescription className="font-body">
            Selecione uma conversa para visualizar ou responder as mensagens.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
            <div className="p-4 border-b border-border">
                <div className="relative max-w-sm">
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
            <div className="flex-grow">
                {isLoadingClients || isLoadingConversations ? (
                    <div className="flex justify-center items-center h-full p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : filteredConversationList.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 [perspective:1000px]">
                        {filteredConversationList.map((convo, index) => {
                            const palette = cardColorPalettes[index % cardColorPalettes.length];
                            return (
                                <Card 
                                    key={convo.id}
                                    className={cn(
                                        "cursor-pointer transition-transform duration-500 ease-in-out [transform-style:preserve-3d] hover:-translate-y-1 hover:shadow-2xl hover:[transform:rotateY(10deg)]",
                                        palette.bg,
                                        palette.border,
                                        "border-l-4",
                                        convo.unreadByAdmin && "ring-2 ring-offset-background ring-offset-2 ring-primary/70"
                                    )}
                                    onClick={() => handleSelectConversation(convo.clientId)}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <CardHeader className="flex flex-row items-center gap-3 p-4">
                                        <Avatar className="h-12 w-12 flex-shrink-0 shadow-lg perspective-container">
                                            <AvatarFallback className={cn("font-bold text-lg", palette.bg.replace('bg-','bg-').replace('-50','-100'), palette.text)}>
                                                <div className="preserve-3d">
                                                  <span className="animate-horizontal-spin block">{fallbackAvatarText(convo.clientName)}</span>
                                                </div>
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-grow overflow-hidden">
                                            <p className="font-semibold font-body text-sm truncate">{convo.clientName}</p>
                                            <p className={cn("text-xs truncate", convo.unreadByAdmin ? "text-primary font-medium" : "text-muted-foreground")}>
                                              {convo.lastMessage}
                                            </p>
                                        </div>
                                        {convo.unreadByAdmin && (
                                          <Circle className="h-2.5 w-2.5 fill-current text-primary flex-shrink-0" />
                                        )}
                                    </CardHeader>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <p className="p-8 text-center text-sm text-muted-foreground font-body">Nenhum cliente encontrado.</p>
                )}
            </div>
        </CardContent>
      </Card>
      
      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
          <DialogContent className="sm:max-w-lg h-[90vh] flex flex-col p-0 bg-violet-50 dark:bg-violet-900/40 border-violet-200 dark:border-violet-700 shadow-2xl transition-all duration-300 data-[state=open]:scale-105">
            {selectedClient && (
              <>
                <DialogHeader className="flex flex-row items-center justify-between gap-3 p-4 border-b border-violet-200 dark:border-violet-600/50 flex-shrink-0 bg-violet-100/50 dark:bg-violet-800/30">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/20 text-primary font-bold">
                                {fallbackAvatarText(selectedClient.name)}
                            </AvatarFallback>
                        </Avatar>
                        <DialogTitle className="font-semibold font-headline text-lg text-violet-800 dark:text-violet-200">{selectedClient.name}</DialogTitle>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleCloseModal} className="text-violet-600 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-700">
                        <X className="h-5 w-5"/>
                        <span className="sr-only">Fechar</span>
                    </Button>
                </DialogHeader>

                <ScrollArea className="flex-grow">
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
                                        <AvatarFallback className="bg-violet-200 dark:bg-violet-700 text-violet-700 dark:text-violet-200">
                                            {msg.senderType === 'admin' ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <div className={cn(
                                            "p-3 rounded-lg font-body text-sm shadow-md transform hover:-translate-y-0.5 transition-transform duration-150 border",
                                            msg.senderType === 'admin' 
                                                ? "bg-violet-200 dark:bg-violet-800/70 border-violet-300 dark:border-violet-600 text-violet-900 dark:text-violet-100 rounded-br-none" 
                                                : "bg-white dark:bg-slate-700/50 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-bl-none"
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

                <div className="p-4 border-t border-violet-200 dark:border-violet-600/50 flex-shrink-0 bg-violet-100/50 dark:bg-violet-800/30">
                  <form onSubmit={handleSendMessage}>
                    <div className="relative">
                        <Input
                            placeholder="Digite sua mensagem..."
                            className="pr-12 focus:ring-accent"
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
            )}
          </DialogContent>
      </Dialog>
    </div>
  );
}
