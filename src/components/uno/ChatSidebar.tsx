
"use client"

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { socket } from '@/lib/socket';

interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: Date;
}

interface ChatSidebarProps {
  roomId: string;
  userName: string;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ roomId, userName }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', user: 'System', text: 'Welcome to Web Uno Arena!', timestamp: new Date() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.on('receive_message', (msg: Message) => {
      setMessages(prev => [...prev, { ...msg, timestamp: new Date(msg.timestamp) }]);
    });

    return () => {
      socket.off('receive_message');
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const newMessage: Message = {
      id: Math.random().toString(),
      user: userName,
      text: inputValue,
      timestamp: new Date()
    };
    
    socket.emit('send_message', { roomId, message: newMessage });
    setInputValue('');
  };

  return (
    <div className="w-80 h-full flex flex-col glass border-l border-white/10 p-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="text-primary w-5 h-5" />
        <h2 className="text-xl font-headline font-bold text-white">Arena Chat</h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col"
            >
              <div className="flex items-baseline gap-2">
                <span className={`text-xs font-bold ${msg.user === userName ? 'text-primary' : msg.user === 'System' ? 'text-white/40' : 'text-accent'}`}>
                  {msg.user}
                </span>
                <span className="text-[10px] text-white/30">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-white/80 bg-white/5 rounded-lg px-3 py-2 mt-1 border border-white/5">
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
          placeholder="Send a message..."
          className="bg-white/5 border-white/10 text-white"
        />
        <Button size="icon" onClick={handleSend} className="bg-primary hover:bg-primary/80">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatSidebar;
