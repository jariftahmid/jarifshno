"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Play, Plus, Users, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateRoomCode } from '@/lib/uno-engine';

export default function Lobby() {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [step, setStep] = useState<'name' | 'action'>('name');
  const router = useRouter();

  const handleCreateRoom = () => {
    const code = generateRoomCode();
    router.push(`/game/${code}`);
  };

  const handleJoinRoom = () => {
    if (roomCode.length === 4) {
      router.push(`/game/${roomCode.toUpperCase()}`);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  return (
    <main className="w-full h-screen flex items-center justify-center mesh-gradient relative">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-md p-8 glass rounded-3xl border border-white/20 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-[0_0_30px_rgba(211,76,219,0.5)]">
            <span className="text-3xl font-black font-headline text-white">U</span>
          </div>
          <h1 className="text-4xl font-headline font-bold text-white tracking-tight">
            Web Uno <span className="text-primary">Arena</span>
          </h1>
          <p className="text-white/50 mt-2 font-body text-sm">Elite Multiplayer Card Combat</p>
        </div>

        <div className="space-y-6">
          {step === 'name' ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-xs font-headline font-bold text-white/70 uppercase tracking-widest ml-1">Username</label>
                <Input 
                  placeholder="Enter your legend name..." 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:ring-primary focus:border-primary"
                />
              </div>
              <Button 
                disabled={!username.trim()} 
                onClick={() => setStep('action')}
                className="w-full h-12 bg-primary hover:bg-primary/80 text-white font-headline font-bold rounded-xl transition-all shadow-lg hover:shadow-primary/20"
              >
                Continue <Play className="ml-2 w-4 h-4 fill-current" />
              </Button>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  onClick={handleCreateRoom}
                  variant="outline"
                  className="flex flex-col gap-3 h-32 border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-2xl"
                >
                  <Plus className="w-8 h-8 text-primary" />
                  <span className="font-headline font-bold">New Room</span>
                </Button>
                <div className="flex flex-col gap-4">
                  <Input 
                    placeholder="CODE" 
                    maxLength={4}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="bg-white/5 border-white/10 text-white h-12 rounded-xl text-center font-headline font-bold tracking-[0.5em]"
                  />
                  <Button 
                    onClick={handleJoinRoom}
                    disabled={roomCode.length !== 4}
                    className="flex-1 bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30 rounded-xl"
                  >
                    Join Room
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[10px] text-white/30 font-headline uppercase tracking-widest">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>2-4 Players</span>
                </div>
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Ranked Arena</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Floating decorative cards */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * 100 - 50 + (i % 2 ? 100 : 0) + '%', 
              y: '110%',
              rotate: Math.random() * 360 
            }}
            animate={{ 
              y: '-20%',
              rotate: Math.random() * 360 + 360
            }}
            transition={{ 
              duration: 20 + Math.random() * 10, 
              repeat: Infinity, 
              delay: Math.random() * 20,
              ease: "linear"
            }}
            className="absolute w-24 h-36 glass rounded-xl border border-white/10 opacity-20"
          ></motion.div>
        ))}
      </div>
    </main>
  );
}
