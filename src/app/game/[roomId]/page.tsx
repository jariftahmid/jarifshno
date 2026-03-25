"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowLeft, Info, PlayCircle, MessageCircle, Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UnoCard, CardColor, GameState, canPlayCard, createDeck, shuffle } from '@/lib/uno-engine';
import UnoCardUI from '@/components/uno/UnoCardUI';
import ChatSidebar from '@/components/uno/ChatSidebar';
import WildColorPicker from '@/components/uno/WildColorPicker';
import UnoButton from '@/components/uno/UnoButton';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useFirestore, useDoc, useAuth } from '@/firebase';
import { doc, updateDoc, arrayUnion, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

const TURN_TIME_LIMIT = 30000; // 30 seconds per turn

export default function GameArena() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  
  const roomRef = useMemo(() => (db && roomId ? doc(db, 'rooms', roomId) : null), [db, roomId]);
  const { data: gameState, loading: docLoading } = useDoc<GameState>(roomRef);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingCard, setPendingCard] = useState<UnoCard | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(100);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  // Initialize Player and Join Room
  useEffect(() => {
    const initPlayerAndJoin = async () => {
      let myId = localStorage.getItem('uno_player_id');
      if (!myId) {
        myId = Math.random().toString(36).substring(7);
        localStorage.setItem('uno_player_id', myId);
      }
      setPlayerId(myId);

      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
    };
    initPlayerAndJoin();
  }, [auth]);

  // Join the players list automatically
  useEffect(() => {
    const joinRoom = async () => {
      if (!roomRef || !gameState || !playerId) return;
      
      const isAlreadyIn = gameState.players.some(p => p.id === playerId);
      if (!isAlreadyIn && gameState.status === 'lobby') {
        const myName = localStorage.getItem('uno_username') || `Player-${playerId.substring(0, 4)}`;
        await updateDoc(roomRef, {
          players: arrayUnion({
            id: playerId,
            name: myName,
            hand: [],
            hasShoutedUno: false
          })
        });
      }
    };
    joinRoom();
  }, [gameState?.players, playerId, roomRef, gameState?.status]);

  // Unread Message Notification Listener
  useEffect(() => {
    if (!db || !roomId || isChatOpen) return;

    const messagesRef = collection(db, 'rooms', roomId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty && !isChatOpen) {
        const lastMsg = snapshot.docs[0].data();
        const myName = localStorage.getItem('uno_username');
        if (lastMsg.user !== myName) {
          setHasUnreadMessages(true);
        }
      }
    });

    return () => unsubscribe();
  }, [db, roomId, isChatOpen]);

  // Turn Timer Logic
  useEffect(() => {
    if (gameState?.status !== 'playing' || !gameState.turnStartedAt) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - gameState.turnStartedAt!;
      const remaining = Math.max(0, 100 - (elapsed / TURN_TIME_LIMIT) * 100);
      setTimeLeft(remaining);

      const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
      if (remaining <= 0 && isMyTurn) {
        handleDrawCard();
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameState?.turnStartedAt, gameState?.currentPlayerIndex, playerId, gameState?.status]);

  const handleStartGame = async () => {
    if (!roomRef || !gameState) return;
    let deck = createDeck();
    const updatedPlayers = gameState.players.map(p => ({ ...p, hand: deck.splice(0, 7), hasShoutedUno: false }));
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
      turnStartedAt: Date.now(),
      lastAction: 'Arena battle started!'
    });
  };

  const handlePlayCard = async (card: UnoCard, chosenColor?: CardColor) => {
    if (!gameState || !roomRef || !topCard) return;
    const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
    if (!isMyTurn) return;

    if (!canPlayCard(card, topCard, gameState.currentColor)) {
      toast({ title: "Invalid Move", description: "This card cannot be played." });
      return;
    }

    if (card.color === 'wild' && !chosenColor) {
      setPendingCard(card);
      setShowColorPicker(true);
      return;
    }

    let newPlayers = [...gameState.players];
    let newDrawPile = [...gameState.drawPile];
    let newDiscardPile = [...gameState.discardPile, card];
    let newDirection = gameState.direction;
    let newCurrentColor = (chosenColor || card.color) as CardColor;

    newPlayers = newPlayers.map(p => {
      if (p.id === playerId) {
        const newHand = p.hand.filter(c => c.id !== card.id);
        return { ...p, hand: newHand, hasShoutedUno: newHand.length === 1 ? p.hasShoutedUno : false };
      }
      return p;
    });

    const isWinner = newPlayers.find(p => p.id === playerId)?.hand.length === 0;

    if (card.value === 'reverse') {
      newDirection = (gameState.players.length === 2 ? 1 : (newDirection === 1 ? -1 : 1)) as 1 | -1;
    }

    let nextIdx = (gameState.currentPlayerIndex + newDirection + newPlayers.length) % newPlayers.length;
    let skipNext = card.value === 'skip' || (card.value === 'reverse' && gameState.players.length === 2);
    let penalty = card.value === 'draw_two' ? 2 : (card.value === 'wild_draw_four' ? 4 : 0);

    if (penalty > 0) {
      const pCards: UnoCard[] = [];
      for (let i = 0; i < penalty; i++) {
        if (newDrawPile.length === 0) {
          const t = newDiscardPile.pop()!;
          newDrawPile = shuffle(newDiscardPile);
          newDiscardPile = [t];
        }
        if (newDrawPile.length > 0) pCards.push(newDrawPile.pop()!);
      }
      newPlayers[nextIdx].hand = [...newPlayers[nextIdx].hand, ...pCards];
      skipNext = true;
    }

    if (skipNext) {
      nextIdx = (nextIdx + newDirection + newPlayers.length) % newPlayers.length;
    }

    await updateDoc(roomRef, {
      players: newPlayers,
      drawPile: newDrawPile,
      discardPile: newDiscardPile,
      currentPlayerIndex: nextIdx,
      currentColor: newCurrentColor,
      direction: newDirection,
      status: isWinner ? 'ended' : 'playing',
      winner: isWinner ? playerId : null,
      turnStartedAt: Date.now(),
      lastAction: `${newPlayers.find(p => p.id === playerId)?.name} played ${card.color} ${card.value}`
    });
  };

  const handleDrawCard = async () => {
    if (!gameState || !roomRef) return;
    let { drawPile, discardPile, players, currentPlayerIndex, direction } = gameState;
    
    if (drawPile.length === 0) {
      const top = discardPile.pop()!;
      drawPile = shuffle(discardPile);
      discardPile = [top];
    }

    const newCard = drawPile.pop()!;
    const newPlayers = players.map(p => {
      if (p.id === playerId) return { ...p, hand: [...p.hand, newCard], hasShoutedUno: false };
      return p;
    });

    const nextIdx = (currentPlayerIndex + direction + players.length) % players.length;

    await updateDoc(roomRef, {
      players: newPlayers,
      drawPile,
      discardPile,
      currentPlayerIndex: nextIdx,
      turnStartedAt: Date.now(),
      lastAction: `${players[currentPlayerIndex].name} drew a card`
    });
  };

  const localPlayer = gameState?.players.find(p => p.id === playerId);
  const isMyTurn = gameState?.status === 'playing' && gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  const isHost = gameState?.hostId === playerId;
  const topCard = gameState?.discardPile[gameState?.discardPile.length - 1];

  if (docLoading || !gameState) {
    return <div className="h-screen w-screen flex items-center justify-center mesh-gradient text-white font-headline tracking-widest">LOADING ARENA...</div>;
  }

  if (gameState.status === 'lobby') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center space-y-8 mesh-gradient p-8">
        <h1 className="text-4xl font-headline font-bold text-white tracking-widest uppercase text-center">Room: {roomId}</h1>
        <div className="w-full max-w-md glass p-6 rounded-3xl space-y-4">
          <div className="space-y-2">
            <h2 className="text-xs font-headline text-white/50 uppercase">Combatants ({gameState.players.length})</h2>
            <div className="max-h-48 overflow-y-auto space-y-2 no-scrollbar">
              {gameState.players.map(p => (
                <div key={p.id} className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                  <span className="text-white font-bold flex items-center gap-2">
                    {p.name} 
                    {p.id === playerId && <span className="text-[10px] text-primary">(YOU)</span>}
                    {p.id === gameState.hostId && <span className="text-[10px] text-yellow-400">👑 HOST</span>}
                  </span>
                </div>
              ))}
              {gameState.players.length === 0 && <p className="text-white/30 text-center text-xs">Waiting for players to join...</p>}
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            {isHost ? (
              <Button 
                disabled={gameState.players.length < 2} 
                onClick={handleStartGame}
                className="w-full h-14 bg-primary text-white font-headline font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-50"
              >
                START COMBAT
              </Button>
            ) : (
              <div className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
                <p className="text-white/70 font-headline text-sm animate-pulse">WAITING FOR HOST TO START...</p>
              </div>
            )}
            
            <Button 
              variant="outline"
              onClick={() => router.push('/')}
              className="w-full h-12 border-white/10 text-white font-headline font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> LEAVE ARENA
            </Button>
          </div>
          
          {isHost && <p className="text-[10px] text-center text-white/40">Requires 2+ players</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen mesh-gradient relative overflow-hidden">
      <div className="flex-1 flex flex-col relative arena-3d">
        <div className="p-4 flex justify-between items-center glass border-b border-white/10 z-20">
           <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="text-white"><ArrowLeft className="w-5 h-5"/></Button>
              <div className="flex flex-col">
                <span className="text-[10px] text-white/50 uppercase">Current Arena</span>
                <span className="text-sm font-headline font-bold text-primary">{roomId}</span>
              </div>
           </div>

           <div className="flex flex-col items-center gap-1 w-32">
              <Progress value={timeLeft} className="h-1 bg-white/10" />
              <div className="flex items-center gap-2 text-[10px] font-headline text-white/50">
                <Clock className="w-3 h-3" /> {Math.ceil((timeLeft / 100) * 30)}s
              </div>
           </div>

           <div className="flex items-center gap-2">
              <Button 
                onClick={() => {
                  setIsChatOpen(!isChatOpen);
                  setHasUnreadMessages(false);
                }} 
                variant="ghost" 
                className="text-white relative"
              >
                <MessageCircle className="w-5 h-5" />
                {hasUnreadMessages && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background" />}
              </Button>
           </div>
        </div>

        <div className="flex-1 relative flex flex-col items-center justify-center">
          <div className="absolute top-12 left-0 right-0 flex justify-center gap-8 px-8">
            {gameState.players.filter(p => p.id !== playerId).map((p, i) => (
              <div key={p.id} className="flex flex-col items-center">
                <div className={cn(
                  "w-12 h-12 rounded-full border-2 border-white/20 transition-all",
                  gameState.currentPlayerIndex === gameState.players.indexOf(p) && "golden-glow scale-110"
                )}>
                  <Image src={PlaceHolderImages[i % 3].imageUrl} alt={p.name} width={48} height={48} className="rounded-full" />
                </div>
                <div className="glass px-3 py-1 rounded-full mt-2 text-center min-w-[60px]">
                  <p className="text-[10px] font-bold text-white truncate max-w-[80px]">{p.name}</p>
                  <p className="text-[8px] text-primary">{p.hand.length} Cards</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-12 pile-3d">
            <motion.div whileTap={{ scale: 0.9 }} onClick={handleDrawCard} className={cn(!isMyTurn && "opacity-50 grayscale", "cursor-pointer")}>
              <UnoCardUI card={{ id: 'back', color: 'wild', value: 'wild' }} isOpponent />
            </motion.div>
            <div className="relative w-24 h-36 border-2 border-white/5 rounded-xl">
              {gameState.discardPile.slice(-3).map((c, i) => (
                <motion.div key={c.id} className="absolute inset-0" initial={{ scale: 0 }} animate={{ scale: 1, rotate: (i-1)*5 }}>
                   <UnoCardUI card={c} isPlayable={false} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="h-40 glass border-t border-white/10 flex items-center justify-center p-4 overflow-x-auto no-scrollbar">
           <div className="flex -space-x-8 md:-space-x-12">
             {localPlayer?.hand.map((c, i) => (
               <UnoCardUI 
                key={c.id} 
                card={c} 
                index={i} 
                isPlayable={isMyTurn && canPlayCard(c, topCard!, gameState.currentColor)}
                onClick={() => handlePlayCard(c)}
               />
             ))}
           </div>
        </div>

        <UnoButton 
          show={localPlayer?.hand.length === 1 && !localPlayer.hasShoutedUno} 
          onClick={async () => {
            const updated = gameState.players.map(p => p.id === playerId ? { ...p, hasShoutedUno: true } : p);
            await updateDoc(roomRef, { players: updated, lastAction: `${localPlayer?.name} shouted UNO!` });
          }} 
        />
      </div>

      <AnimatePresence>
        {isChatOpen && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed inset-y-0 right-0 w-80 z-50">
            <ChatSidebar roomId={roomId} userName={localPlayer?.name || 'Player'} onClose={() => setIsChatOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <WildColorPicker 
        isOpen={showColorPicker} 
        onSelect={(c) => { 
          if (pendingCard) handlePlayCard(pendingCard, c);
          setShowColorPicker(false);
          setPendingCard(null);
        }} 
      />

      {gameState.status === 'ended' && (
        <div className="fixed inset-0 z-[100] glass flex flex-col items-center justify-center p-12 text-center">
           <h2 className="text-6xl font-headline font-black text-white mb-4">VICTORY</h2>
           <p className="text-2xl text-primary font-bold">{gameState.players.find(p => p.id === gameState.winner)?.name} WINS THE ARENA</p>
           <Button onClick={() => router.push('/')} className="mt-8 h-14 px-12 rounded-2xl bg-primary text-white font-bold">LOBBY</Button>
        </div>
      )}
    </div>
  );
}
