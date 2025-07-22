"use client";

import * as React from "react";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/contexts/ClientAuthContext";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/audioUtils";

export function ClientMessageBell() {
  const { currentClient } = useClientAuth();
  const [hasUnread, setHasUnread] = React.useState(false);
  const prevHasUnreadRef = React.useRef(false);

  React.useEffect(() => {
    if (currentClient?.id && db) {
      const docRef = doc(db, 'conversations', currentClient.id);

      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const newHasUnread = docSnap.data().unreadByClient === true;

          // Play sound only if the state changes from not having unread messages to having them
          if (newHasUnread && !prevHasUnreadRef.current) {
            playSound('message');
          }

          setHasUnread(newHasUnread);
          prevHasUnreadRef.current = newHasUnread; // Update the ref for the next check
        } else {
          setHasUnread(false);
          prevHasUnreadRef.current = false;
        }
      }, (error) => {
        console.error("Error listening to conversation:", error);
      });

      return () => unsubscribe();
    }
  }, [currentClient?.id]);

  return (
    <Button asChild variant="ghost" size="icon" className="relative h-9 w-9">
      <Link href="/client/mensagens">
        <MessageSquare className={cn("h-5 w-5", hasUnread && "animate-bell-pulse text-yellow-400")} />
        {hasUnread && (
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
        )}
        <span className="sr-only">Mensagens</span>
      </Link>
    </Button>
  );
}
