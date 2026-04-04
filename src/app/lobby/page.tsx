"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, arrayUnion, query, collection, where, limit, getDocs } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { getInitialGameState, createDeck, shuffle } from '@/lib/uno-engine';

const LOBBY_TIMEOUT_SECONDS = 90;
const MAX_PLAYERS = 10;
const MIN_PLAYERS = 2;

export default function MatchmakingLobby() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  
  const [roomId, setRoomId] = useState<string | null>(null);
  const roomRef = useMemoFirebase(() => roomId ? doc(db, 'gameRooms', roomId) : null, [db, roomId]);
  const { data: room, loading: roomLoading } = useDoc(roomRef);

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!db || !user || roomId) return;

    const findMatch = async () => {
      const q = query(
        collection(db, 'gameRooms'),
        where('roomType', '==', 'random_match'),
        where('status', '==', 'waiting_for_players'),
        limit(1)
      );
      
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const foundId = snap.docs[0].id;
        setRoomId(foundId);
        await updateDoc(doc(db, 'gameRooms', foundId), {
          playerIds: arrayUnion(user.uid),
          players: arrayUnion({
            id: user.uid,
            name: user.displayName || `Player-${user.uid.substring(0, 4)}`,
            hand: [],
            hasShoutedUno: false
          })
        });
      } else {
        const newId = Math.random().toString(36).substring(7).toUpperCase();
        const countdownEndsAt = Date.now() + LOBBY_TIMEOUT_SECONDS * 1000;
        const initialState = getInitialGameState(newId, user.uid, 'random_match');
        
        await setDoc(doc(db, 'gameRooms', newId), {
          ...initialState,
          playerIds: [user.uid],
          players: [{
            id: user.uid,
            name: user.displayName || `Player-${user.uid.substring(0, 4)}`,
            hand: [],
            hasShoutedUno: false
          }],
          status: 'waiting_for_players',
          countdownEndsAt
        });
        setRoomId(newId);
      }
    };

    findMatch();
  }, [db, user, roomId]);

  useEffect(() => {
    if (!room || room.status !== 'waiting_for_players') return;

    const interval = setInterval(async () => {
      const now = Date.now();
      const ends = room.countdownEndsAt || 0;
      const diff = Math.max(0, Math.floor((ends - now) / 1000));
      setTimeLeft(diff);

      const shouldStart = room.playerIds.length >= MAX_PLAYERS || (diff === 0 && room.playerIds.length >= MIN_PLAYERS);
      
      if (shouldStart && roomRef) {
        clearInterval(interval);
        await startGame();
      } else if (diff === 0 && room.playerIds.length < MIN_PLAYERS) {
        toast({ title: "More players needed", description: "Still waiting for combatants..." });
        updateDoc(roomRef, { countdownEndsAt: Date.now() + 60000 });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [room, roomRef]);

  useEffect(() => {
    if (room?.status === 'playing') {
      router.push(`/game?roomId=${room.roomId}`);
    }
  }, [room?.status, room?.roomId, router]);

  const startGame = async () => {
    if (!roomRef || !room) return;
    
    let deck = createDeck();
    const updatedPlayers = room.players.map(p => ({
      ...p,
      hand: deck.splice(0, 7),
      hasShoutedUno: false
    }));

    let firstCard = deck.pop()!;
    while (firstCard.color === 'wild') {
      deck.unshift(firstCard);
      firstCard = deck.pop()!;
    }

    await updateDoc(roomRef, {
      players: updatedPlayers,
      drawPile: deck,
      discardPile: [firstCard],
      status: 'playing',
      currentPlayerIndex: 0,
      currentColor: firstCard.color,
      direction: 1,
      startedAt: Date.now(),
      lastAction: 'Battle Commenced!'
    });
  };

  return (
    <main className="w-full h-screen flex items-center justify-center mesh-gradient p-4">
      <div className="w-full max-w-lg glass p-8 rounded-3xl border border-white/20 shadow-2xl space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="text-white">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-headline font-black text-white uppercase tracking-widest">Matchmaking Lobby</h1>
            <p className="text-[10px] text-white/50 uppercase font-bold">Assembling your opponents</p>
          </div>
        </div>

        <div className="relative h-48 flex items-center justify-center">
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-4 border-dashed border-primary/20 rounded-full"
          />
          <div className="text-center space-y-2">
            <span className="block text-5xl font-headline font-black text-white tabular-nums">
              {timeLeft !== null ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : '--:--'}
            </span>
            <div className="flex items-center justify-center gap-2 text-primary font-black uppercase text-xs">
              <Clock className="w-4 h-4" /> SECONDS LEFT
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-[10px] font-headline font-bold text-white/50 uppercase tracking-widest">Combatants ({room?.playerIds?.length || 0}/{MAX_PLAYERS})</h3>
            {roomLoading && <Loader2 className="w-3 h-3 text-primary animate-spin" />}
          </div>
          
          <div className="grid grid-cols-5 gap-4">
            {room?.players?.map((p) => (
              <motion.div 
                key={p.id} 
                initial={{ scale: 0 }} 
                animate={{ scale: 1 }}
                className="flex flex-col items-center gap-2"
              >
                <Avatar className="h-12 w-12 border-2 border-primary/50">
                  <AvatarImage src={`https://picsum.photos/seed/${p.id}/100/100`} />
                  <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-[8px] font-bold text-white/80 truncate w-full text-center">{p.name}</span>
              </motion.div>
            ))}
            {Array.from({ length: MAX_PLAYERS - (room?.playerIds?.length || 0) }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 opacity-20">
                <div className="h-12 w-12 rounded-full bg-white/10 border-2 border-dashed border-white/20" />
                <div className="h-2 w-8 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4">
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary" 
              initial={{ width: 0 }} 
              animate={{ width: `${((room?.playerIds?.length || 0) / MAX_PLAYERS) * 100}%` }} 
            />
          </div>
          <p className="text-center text-[8px] text-white/30 mt-4 uppercase tracking-[0.2em]">Game starts automatically when criteria are met</p>
        </div>
      </div>
    </main>
  );
}
