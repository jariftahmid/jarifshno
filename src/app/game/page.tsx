"use client"

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MessageCircle, LogOut, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnoCard, CardColor, GameState, canPlayCard, createDeck, shuffle } from '@/lib/uno-engine';
import UnoCardUI from '@/components/uno/UnoCardUI';
import ChatSidebar from '@/components/uno/ChatSidebar';
import WildColorPicker from '@/components/uno/WildColorPicker';
import UnoButton from '@/components/uno/UnoButton';
import VoiceChat from '@/components/uno/VoiceChat';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useFirestore, useDoc, useAuth } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { playSound } from '@/lib/sounds';

function GameArenaContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams?.get('roomId') as string;
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  
  const roomRef = useMemo(() => (db && roomId ? doc(db, 'rooms', roomId) : null), [db, roomId]);
  const { data: gameState, loading: docLoading } = useDoc<GameState>(roomRef);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingCard, setPendingCard] = useState<UnoCard | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  useEffect(() => {
    const initPlayer = async () => {
      let myId = localStorage.getItem('uno_player_id');
      if (!myId) {
        myId = Math.random().toString(36).substring(7);
        localStorage.setItem('uno_player_id', myId);
      }
      setPlayerId(myId);
      if (!auth.currentUser) await signInAnonymously(auth);
    };
    initPlayer();
  }, [auth]);

  useEffect(() => {
    if (!roomRef || !gameState || !playerId) return;
    const isAlreadyIn = gameState.players.some(p => p.id === playerId);
    if (!isAlreadyIn && gameState.status === 'lobby') {
      const myName = localStorage.getItem('uno_username') || `Player-${playerId.substring(0, 4)}`;
      updateDoc(roomRef, {
        players: arrayUnion({
          id: playerId,
          name: myName,
          hand: [],
          hasShoutedUno: false
        })
      });
    }
  }, [gameState, playerId, roomRef]);

  useEffect(() => {
    if (gameState?.status === 'playing') {
      const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
      if (isMyTurn) playSound('turn');
    }
  }, [gameState?.currentPlayerIndex, gameState?.status, playerId]);

  const handleStartGame = async () => {
    if (!roomRef || !gameState) return;
    let deck = createDeck();
    const updatedPlayers = gameState.players.map(p => ({ ...p, hand: deck.splice(0, 7), hasShoutedUno: false }));
    let firstCard = deck.pop()!;
    while (firstCard.color === 'wild') {
      deck.unshift(firstCard);
      firstCard = deck.pop()!;
    }
    playSound('play');
    await updateDoc(roomRef, {
      players: updatedPlayers,
      drawPile: deck,
      discardPile: [firstCard],
      status: 'playing',
      currentPlayerIndex: 0,
      currentColor: firstCard.color,
      direction: 1,
      turnStartedAt: Date.now(),
      lastAction: 'Battle Commenced!'
    });
  };

  const handlePlayCard = async (card: UnoCard, chosenColor?: CardColor) => {
    if (!gameState || !roomRef || !topCard) return;
    const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
    if (!isMyTurn) return;

    if (!canPlayCard(card, topCard, gameState.currentColor)) {
      toast({ title: "Invalid Play", description: "Card doesn't match color or value." });
      return;
    }

    if (card.color === 'wild' && !chosenColor) {
      setPendingCard(card);
      setShowColorPicker(true);
      return;
    }

    playSound('play');
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
    if (isWinner) playSound('win');

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
          const t = newDiscardPile.shift()!;
          newDrawPile = shuffle(newDiscardPile.slice(0, -1));
          newDiscardPile = [newDiscardPile[newDiscardPile.length-1]];
        }
        if (newDrawPile.length > 0) pCards.push(newDrawPile.pop()!);
      }
      newPlayers[nextIdx].hand = [...newPlayers[nextIdx].hand, ...pCards];
      skipNext = true;
    }

    if (skipNext) nextIdx = (nextIdx + newDirection + newPlayers.length) % newPlayers.length;

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
    const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
    if (!isMyTurn) return;

    playSound('draw');
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
    return <div className="h-screen w-screen flex items-center justify-center bg-background text-white font-headline tracking-widest text-xl">SYNCHRONIZING ARENA...</div>;
  }

  if (gameState.status === 'lobby') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center space-y-6 mesh-gradient p-4 overflow-hidden">
        <motion.h1 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="text-3xl md:text-5xl font-headline font-black text-white tracking-widest uppercase text-center drop-shadow-2xl"
        >
          ARENA <span className="text-primary">{roomId}</span>
        </motion.h1>
        <div className="w-full max-w-sm glass p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] space-y-4 md:space-y-6 shadow-2xl border-white/20">
          <div className="space-y-2 md:space-y-4">
            <h2 className="text-[10px] md:text-xs font-headline font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
              <Users className="w-3 h-3 md:w-4 h-4" /> Combatants ({gameState.players.length})
            </h2>
            <div className="max-h-48 md:max-h-56 overflow-y-auto space-y-2 md:space-y-3 pr-2 no-scrollbar">
              {gameState.players.map((p, i) => (
                <div key={p.id} className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                  <span className="text-white text-xs md:text-sm font-bold flex items-center gap-2 md:gap-3">
                    <div className="w-6 h-6 md:w-8 h-8 rounded-full overflow-hidden border border-primary/50">
                      <Image src={PlaceHolderImages[i % 3].imageUrl} alt={p.name} width={32} height={32} />
                    </div>
                    {p.name} 
                    {p.id === playerId && <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full border border-primary/30 ml-1">YOU</span>}
                  </span>
                  {p.id === gameState.hostId && <span className="text-[8px] md:text-[10px] text-yellow-400 font-bold tracking-widest">HOST</span>}
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex flex-col gap-3 md:gap-4">
            {isHost ? (
              <Button 
                disabled={gameState.players.length < 2} 
                onClick={handleStartGame}
                className="w-full h-12 md:h-16 bg-primary text-white font-headline font-black text-sm md:text-lg rounded-xl md:rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                UNLEASH COMBAT
              </Button>
            ) : (
              <div className="w-full p-4 md:p-6 bg-white/5 rounded-xl md:rounded-2xl border border-white/10 text-center">
                <p className="text-white/70 font-headline text-[10px] md:text-sm animate-pulse tracking-widest uppercase">Waiting for host...</p>
              </div>
            )}
            
            <Button 
              variant="outline"
              onClick={() => router.push('/')}
              className="w-full h-10 md:h-12 border-white/10 text-white font-headline font-bold text-xs md:text-sm rounded-xl md:rounded-2xl transition-all hover:bg-white/10 active:scale-95 flex items-center justify-center gap-2"
            >
              <LogOut className="w-3 h-3 md:w-4 h-4" /> LEAVE ARENA
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen mesh-gradient relative overflow-hidden flex-col">
      {/* Header */}
      <div className="p-3 md:p-4 flex justify-between items-center glass border-b border-white/10 z-20">
         <div className="flex items-center gap-3 md:gap-6">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="text-white hover:bg-white/10 h-8 w-8 md:h-10 md:w-10"><ArrowLeft className="w-4 h-4 md:w-6 h-6"/></Button>
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[10px] text-white/50 uppercase font-black">Arena</span>
              <span className="text-sm md:text-lg font-headline font-black text-primary drop-shadow-sm">{roomId}</span>
            </div>
            <VoiceChat roomId={roomId} playerId={playerId} />
         </div>

         <div className="flex items-center gap-2">
            <Button 
              onClick={() => {
                setIsChatOpen(!isChatOpen);
                setHasUnreadMessages(false);
              }} 
              variant="ghost" 
              className="text-white relative hover:bg-white/10 h-8 w-8 md:h-10 md:w-10"
            >
              <MessageCircle className="w-5 h-5 md:w-6 h-6" />
              {hasUnreadMessages && <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background" />}
            </Button>
         </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center">
        {/* Opponents Section */}
        <div className="absolute top-4 left-0 right-0 flex justify-center gap-4 md:gap-12 px-4 overflow-x-auto no-scrollbar">
          {gameState.players.filter(p => p.id !== playerId).map((p, i) => (
            <div key={p.id} className="flex flex-col items-center min-w-[70px] md:min-w-[100px]">
              <div className={cn(
                "w-10 h-10 md:w-16 md:h-16 rounded-full border-2 md:border-4 border-white/10 transition-all duration-300 shadow-xl",
                gameState.currentPlayerIndex === gameState.players.indexOf(p) && "golden-glow scale-110 border-primary"
              )}>
                <Image src={PlaceHolderImages[i % 3].imageUrl} alt={p.name} width={64} height={64} className="rounded-full" />
              </div>
              <div className="glass px-2 py-1 rounded-full mt-2 text-center min-w-[60px] md:min-w-[90px] shadow-lg border-white/20">
                <p className="text-[8px] md:text-xs font-black text-white truncate max-w-[50px] md:max-w-[80px]">{p.name}</p>
                <p className="text-[7px] md:text-[10px] text-primary font-black uppercase">{p.hand.length} Cards</p>
              </div>
            </div>
          ))}
        </div>

        {/* Central Arena */}
        <div className="flex items-center gap-8 md:gap-16 pile-3d scale-75 md:scale-100">
          <div 
            onClick={handleDrawCard} 
            className={cn(!isMyTurn && "opacity-40 grayscale cursor-not-allowed", "cursor-pointer group relative")}
          >
            <UnoCardUI card={{ id: 'back', color: 'wild', value: 'wild' }} isOpponent />
          </div>
          
          <div className="relative w-20 h-32 md:w-32 md:h-48 border-2 md:border-4 border-dashed border-white/5 rounded-xl md:rounded-2xl">
            <AnimatePresence>
              {gameState.discardPile.slice(-3).map((c, i) => (
                <motion.div 
                  key={c.id} 
                  className="absolute inset-0" 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1, rotate: (i - 1) * 5 + (Math.random() * 4 - 2) }}
                >
                   <UnoCardUI card={c} isPlayable={false} className="w-full h-full" />
                </motion.div>
              ))}
            </AnimatePresence>
            {/* Color Indicator */}
            <div className={cn(
              "absolute -top-10 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 border-white/20",
              `bg-${gameState.currentColor === 'yellow' ? 'yellow-400' : gameState.currentColor + '-500'}`
            )} />
          </div>
        </div>

        {/* Activity Feed */}
        {gameState.lastAction && (
          <div className="absolute bottom-40 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 max-w-[80%] text-center">
            <span className="text-[8px] md:text-[10px] font-black text-white/80 uppercase tracking-widest truncate block">{gameState.lastAction}</span>
          </div>
        )}
      </div>

      {/* Player Hand Section */}
      <div className="h-40 md:h-48 glass border-t border-white/20 flex items-center justify-center p-3 md:p-6 overflow-x-auto no-scrollbar relative z-10">
         <div className="flex -space-x-8 md:-space-x-14 max-w-full px-8">
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

      {/* UNO Shout Button */}
      <UnoButton 
        show={localPlayer?.hand.length === 1 && !localPlayer.hasShoutedUno} 
        onClick={async () => {
          playSound('uno');
          const updated = gameState.players.map(p => p.id === playerId ? { ...p, hasShoutedUno: true } : p);
          await updateDoc(roomRef, { players: updated, lastAction: `${localPlayer?.name} shouted UNO!` });
        }} 
      />

      {/* Chat Sidebar */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            initial={{ x: '100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '100%' }} 
            className="fixed inset-y-0 right-0 w-full sm:w-80 z-[60] shadow-2xl"
          >
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

      {/* Win State */}
      {gameState.status === 'ended' && (
        <div className="fixed inset-0 z-[100] glass flex flex-col items-center justify-center p-6 text-center">
             <h2 className="text-5xl md:text-8xl font-headline font-black text-white mb-4">VICTORY</h2>
             <p className="text-xl md:text-3xl text-primary font-black uppercase tracking-widest">{gameState.players.find(p => p.id === gameState.winner)?.name} WON!</p>
             <Button onClick={() => router.push('/')} className="mt-8 h-12 md:h-16 px-8 md:px-16 rounded-xl md:rounded-2xl bg-primary text-white font-black text-lg md:text-xl shadow-2xl transition-all">RETURN HOME</Button>
        </div>
      )}
    </div>
  );
}

export default function GameArena() {
  return (
    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-background text-white font-headline tracking-widest text-xl">INITIATING ARENA...</div>}>
      <GameArenaContent />
    </Suspense>
  );
}
