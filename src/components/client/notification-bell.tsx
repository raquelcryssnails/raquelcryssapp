"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/contexts/ClientAuthContext";
import { onSnapshot, query, collection, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/audioUtils";

export function ClientNotificationBell() {
  const { currentClient } = useClientAuth();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const prevUnreadCountRef = React.useRef(0);

  React.useEffect(() => {
    if (currentClient?.id && db) {
      const q = query(
        collection(db, 'clientNotifications'),
        where('clientId', '==', currentClient.id),
        where('read', '==', false)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newCount = snapshot.size;
        
        // Play sound only if the count of unread notifications has increased
        if (newCount > prevUnreadCountRef.current) {
          playSound('notification');
        }
        
        setUnreadCount(newCount);
        prevUnreadCountRef.current = newCount; // Update the ref with the new count for the next check
      }, (error) => {
        console.error("Error listening to client notifications:", error);
      });

      return () => unsubscribe();
    }
  }, [currentClient?.id]);

  return (
    <Button asChild variant="ghost" size="icon" className="relative h-9 w-9">
      <Link href="/client/notificacoes">
        <Bell className={cn("h-5 w-5", unreadCount > 0 && "animate-bell-pulse text-yellow-400")} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span className="sr-only">Notificações</span>
      </Link>
    </Button>
  );
}
