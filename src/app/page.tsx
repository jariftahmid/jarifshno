"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateRoomCode, getInitialGameState } from '@/lib/uno-engine';
import { useFirestore, useAuth } from '@/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { toast } from '@/hooks/use-toast';

export default function Lobby() {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [step, setStep] = useState<'name' | 'action'>('name');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();

  useEffect(() => {
    const savedName = typeof window !== 'undefined' ? localStorage.getItem('uno_username') : null;
    if (savedName) setUsername(savedName);
  }, []);

  const handleContinue = async () => {
    if (!username.trim()) return;
    setIsLoading(true);
    try {
      // Ensure user is signed in before proceeding
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      localStorage.setItem('uno_username', username);
      setStep('action');
    } catch (e) {
      console.error(e);
      toast({ title: "Authentication Error", variant: "destructive", description: "Could not connect to the arena." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!db) {
      toast({ title: "Connecting...", description: "Please wait for the server connection." });
      return;
    }
    
    setIsLoading(true);
    const code = generateRoomCode();
    try {
      const roomRef = doc(db, 'rooms', code);
      await setDoc(roomRef, getInitialGameState(code));
      router.push(`/game/${code}`);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", variant: "destructive", description: "Could not create room. Please try again." });
      setIsLoading(false); // Reset loading only on error to keep UI smooth during transition
    }
  };

  const handleJoinRoom = async () => {
    if (!db || roomCode.length !== 4) return;
    setIsLoading(true);
    try {
      const roomRef = doc(db, 'rooms', roomCode.toUpperCase());
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        router.push(`/game/${roomCode.toUpperCase()}`);
      } else {
        toast({ title: "Room Not Found", variant: "destructive", description: "This room code doesn't exist." });
        setIsLoading(false);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", variant: "destructive", description: "Could not join room." });
      setIsLoading(false);
    }
  };

  return (
    <main className="w-full h-screen flex items-center justify-center mesh-gradient relative">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
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
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-headline font-bold text-white/70 uppercase tracking-widest ml-1">Username</label>
                <Input 
                  placeholder="Enter your legend name..." 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                  className="bg-white/5 border-white/10 text-white h-12 rounded-xl"
                  disabled={isLoading}
                />
              </div>
              <Button 
                disabled={!username.trim() || isLoading} 
                onClick={handleContinue}
                className="w-full h-12 bg-primary hover:bg-primary/80 text-white font-headline font-bold rounded-xl"
              >
                {isLoading ? "Connecting..." : <>Continue <Play className="ml-2 w-4 h-4 fill-current" /></>}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  variant="outline"
                  className="flex flex-col gap-3 h-32 border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-2xl"
                >
                  <Plus className="w-8 h-8 text-primary" />
                  <span className="font-headline font-bold">{isLoading ? "Creating..." : "New Room"}</span>
                </Button>
                <div className="flex flex-col gap-4">
                  <Input 
                    placeholder="CODE" 
                    maxLength={4}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="bg-white/5 border-white/10 text-white h-12 rounded-xl text-center font-headline font-bold tracking-[0.5em]"
                    disabled={isLoading}
                  />
                  <Button 
                    onClick={handleJoinRoom}
                    disabled={roomCode.length !== 4 || isLoading}
                    className="flex-1 bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30 rounded-xl"
                  >
                    {isLoading ? "Joining..." : "Join Room"}
                  </Button>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setStep('name')}
                disabled={isLoading}
                className="w-full text-white/40 hover:text-white"
              >
                Change Username
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </main>
  );
}
