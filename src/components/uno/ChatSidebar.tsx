
"use client"

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';

interface ChatSidebarProps {
  roomId: string;
  userName: string;
  onClose?: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ roomId, userName, onClose }) => {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const db = useFirestore();

  const messagesRef = useMemo(() => 
    db ? collection(db, 'rooms', roomId, 'messages') : null, 
    [db, roomId]
  );
  
  const messagesQuery = useMemo(() => 
    messagesRef ? query(messagesRef, orderBy('timestamp', 'asc'), limit(50)) : null,
    [messagesRef]
  );

  const { data: messages } = useCollection(messagesQuery);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !messagesRef) return;
    
    const text = inputValue;
    setInputValue(''); // Clear quickly for UX
    
    try {
      await addDoc(messagesRef, {
        user: userName,
        text: text,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Chat error:", e);
    }
  };

  return (
    <div className="w-full h-full flex flex-col glass border-l border-white/10 p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="text-primary w-5 h-5" />
          <h2 className="text-xl font-headline font-bold text-white">Arena Chat</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white/50 hover:text-white md:hidden">
          <X className="w-6 h-6" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2 no-scrollbar">
        <AnimatePresence initial={false}>
          {messages?.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex flex-col", msg.user === userName ? "items-end" : "items-start")}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`text-[10px] font-bold ${msg.user === userName ? 'text-primary' : 'text-accent'}`}>
                  {msg.user}
                </span>
                <span className="text-[8px] text-white/20">
                  {msg.timestamp?.toDate()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '...'}
                </span>
              </div>
              <p className={cn(
                "text-sm text-white/90 rounded-2xl px-3 py-2 border",
                msg.user === userName 
                  ? "bg-primary/10 border-primary/20 rounded-tr-none" 
                  : "bg-white/5 border-white/10 rounded-tl-none"
              )}>
                {msg.text}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-primary"
        />
        <Button size="icon" onClick={handleSend} className="bg-primary hover:bg-primary/80 shrink-0 rounded-xl shadow-lg shadow-primary/20">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

import { cn } from '@/lib/utils';
export default ChatSidebar;
