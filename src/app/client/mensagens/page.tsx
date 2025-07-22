
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Loader2, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase/config";
import { collection, query, onSnapshot, orderBy, doc, Timestamp } from "firebase/firestore";
import { sendMessageFS, markConversationAsReadByClientFS, fromFirestore } from "@/lib/firebase/firestoreService";
import type { Message } from "@/types/firestore";
import { formatDistanceToNow, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useClientAuth } from "@/contexts/ClientAuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import Link from "next/link";

export default function ClientMensagensPage() {
  const { currentClient, isLoadingClient } = useClientAuth();
  const { salonName } = useSettings();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(true);
  const [currentMessage, setCurrentMessage] = React.useState("");
  const { toast } = useToast();
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Mark as read when the component mounts
  React.useEffect(() => {
    if (currentClient?.id) {
      markConversationAsReadByClientFS(currentClient.id);
    }
  }, [currentClient?.id]);

  // Effect to listen for messages in the conversation
  React.useEffect(() => {
    if (!currentClient?.id) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    setIsLoadingMessages(true);
    const messagesQuery = query(
      collection(db, "conversations", currentClient.id, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(messagesQuery, (querySnapshot) => {
      // Use fromFirestore for consistent data conversion
      const newMessages = querySnapshot.docs.map(doc => fromFirestore<Message>(doc));
      setMessages(newMessages);
      setIsLoadingMessages(false);
    }, (error) => {
      // Added error handler for debugging
      console.error("Error listening to messages:", error);
      toast({ variant: "destructive", title: "Erro de Conexão", description: "Não foi possível carregar novas mensagens." });
      setIsLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [currentClient?.id, toast]);
  
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentMessage.trim() || !currentClient) return;
      
      const messageToSend = currentMessage;
      setCurrentMessage("");
      try {
          await sendMessageFS(currentClient.id, currentClient.name, messageToSend, 'client');
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      } catch (error) {
          console.error("Error sending message:", error);
          toast({
              variant: "destructive",
              title: "Erro ao Enviar",
              description: "Não foi possível enviar a sua mensagem.",
          });
          setCurrentMessage(messageToSend);
      }
  };

  const formatTimestamp = (timestamp: string | Timestamp) => {
    if (!timestamp) return "";
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : parseISO(timestamp);
    if (!isValid(date)) return "";
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  };

  if (isLoadingClient) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentClient) {
    return (
      <div className="flex flex-col justify-center items-center h-screen text-center p-4">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-headline text-xl mb-2">Acesso Negado</h2>
        <p className="font-body text-muted-foreground">Você precisa fazer login para acessar o chat.</p>
        <Button asChild className="mt-4">
          <Link href="/client/login">Ir para Login</Link>
        </Button>
      </div>
    );
  }


  return (
    <div className="container mx-auto max-w-3xl py-8 px-4 sm:px-6 lg:px-8">
      <Card className="shadow-lg rounded-xl overflow-hidden h-[calc(100vh-12rem)] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="font-headline text-2xl text-gradient flex items-center gap-3">
            <MessageSquare className="h-7 w-7 text-primary" />
            Minhas Mensagens
          </CardTitle>
          <CardDescription className="font-body">
            Converse diretamente com a equipe do {salonName}.
          </CardDescription>
        </CardHeader>
        
        <ScrollArea className="flex-grow bg-muted/20">
            <div className="p-4 space-y-4">
                {isLoadingMessages ? (
                    <div className="flex justify-center items-center h-full p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mb-4" />
                    <p className="font-body">Nenhuma mensagem ainda.</p>
                    <p className="font-body text-sm">Envie a primeira mensagem para iniciar a conversa!</p>
                  </div>
                ) : (
                    messages.map(msg => (
                        <div 
                            key={msg.id} 
                            className={cn(
                                "flex items-end gap-2 max-w-[80%] sm:max-w-[70%]",
                                msg.senderType === 'client' ? "ml-auto flex-row-reverse" : "mr-auto"
                            )}
                        >
                            <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                    {msg.senderType === 'client' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <div className={cn(
                                    "p-3 rounded-lg font-body text-sm shadow-md transform hover:-translate-y-0.5 transition-transform duration-150 border",
                                    msg.senderType === 'client' 
                                        ? "bg-violet-200 dark:bg-violet-800/70 border-violet-300 dark:border-violet-600 text-violet-900 dark:text-violet-100 rounded-br-none" 
                                        : "bg-white dark:bg-slate-700/50 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-bl-none"
                                )}>
                                    {msg.text}
                                </div>
                                <span className={cn(
                                  "text-xs text-muted-foreground/70 mt-1 px-1",
                                  msg.senderType === 'client' ? "text-right" : "text-left"
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
      </Card>
    </div>
  );
}
