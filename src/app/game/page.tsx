
"use client"

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MessageCircle, LogOut, Users, Zap, Loader2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnoCard, CardColor, GameState, canPlayCard, createDeck, shuffle, Player } from '@/lib/uno-engine';
import UnoCardUI from '@/components/uno/UnoCardUI';
import ChatSidebar from '@/components/uno/ChatSidebar';
import WildColorPicker from '@/components/uno/WildColorPicker';
import UnoButton from '@/components/uno/UnoButton';
import VoiceChat from '@/components/uno/VoiceChat';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useFirestore, useDoc, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, arrayUnion, increment, collection, query, orderBy, limit, writeBatch } from 'firebase/firestore';
import { playSound } from '@/lib/sounds';
import { getStrategicHint } from '@/ai/flows/ai-strategic-hint-tool';

function GameArenaContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams?.get('roomId') as string;
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  
  const roomRef = useMemoFirebase(() => (db && roomId && user ? doc(db, 'gameRooms', roomId) : null), [db, roomId, user]);
  const { data: gameState, loading: docLoading } = useDoc<GameState>(roomRef);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingCard, setPendingCard] = useState<UnoCard | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [aiHint, setAiHint] = useState<{ card: UnoCard; reason: string } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const lastMessageCount = useRef(0);
  const messagesRef = useMemoFirebase(() => 
    db && roomId ? collection(db, 'gameRooms', roomId, 'messages') : null, 
    [db, roomId]
  );
  const messagesQuery = useMemoFirebase(() => 
    messagesRef ? query(messagesRef, orderBy('timestamp', 'asc'), limit(50)) : null,
    [messagesRef]
  );
  const { data: messages } = useCollection(messagesQuery);

  useEffect(() => {
    if (!isChatOpen && messages && messages.length > lastMessageCount.current) {
      const latest = messages[messages.length - 1];
      const localPlayer = gameState?.players.find(p => p.id === user?.uid);
      if (latest.user !== (localPlayer?.name || 'Player')) {
        setHasUnreadMessages(true);
      }
    }
    if (messages) {
      lastMessageCount.current = messages.length;
    }
  }, [messages, isChatOpen, gameState?.players, user?.uid]);

  useEffect(() => {
    if (!roomRef || !gameState || !user || !db) return;
    const isAlreadyIn = gameState.players.some(p => p.id === user.uid);
    if (!isAlreadyIn && gameState.status === 'lobby') {
      updateDoc(roomRef, {
        playerIds: arrayUnion(user.uid),
        players: arrayUnion({
          id: user.uid,
          name: user.displayName || `Player-${user.uid.substring(0, 4)}`,
          hand: [],
          hasShoutedUno: false
        })
      });
    }
    updateDoc(doc(db, 'userProfiles', user.uid), { status: 'in-game' });
    
    return () => {
      if (user && db) updateDoc(doc(db, 'userProfiles', user.uid), { status: 'online' });
    };
  }, [gameState?.status, user, roomRef, db]);

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

  const updateEndGameStats = async (finalPlayers: Player[]) => {
    if (!db || !gameState) return;
    
    // Sort players by hand length to determine rank (0 cards = 1st place)
    const rankedPlayers = [...finalPlayers].sort((a, b) => a.hand.length - b.hand.length);
    const totalCount = rankedPlayers.length;
    const batch = writeBatch(db);

    rankedPlayers.forEach((p, idx) => {
      const rank = idx + 1;
      const pointsEarned = totalCount - rank + 1; // 1st gets totalCount, 2nd gets totalCount-1, etc.
      
      const statsRef = doc(db, `userProfiles/${p.id}/playerStats/default`);
      batch.update(statsRef, {
        totalMatchesPlayed: increment(1),
        winPoints: rank === 1 ? increment(pointsEarned) : increment(0),
        totalPoints: increment(pointsEarned),
        randomMatchesPlayed: gameState.roomType === 'random_match' ? increment(1) : increment(0),
        friendMatchesPlayed: gameState.roomType === 'private' ? increment(1) : increment(0),
      });
    });

    await batch.commit();
  };

  const requestAiHint = async () => {
    if (!gameState || !user || isAiLoading) return;
    setIsAiLoading(true);
    try {
      const localPlayer = gameState.players.find(p => p.id === user.uid);
      const topCard = gameState.discardPile[gameState.discardPile.length - 1];
      if (!localPlayer) return;

      const hint = await getStrategicHint({
        playerHand: localPlayer.hand,
        discardPileTopCard: topCard,
        currentColor: gameState.currentColor,
        opponentPlayers: gameState.players.filter(p => p.id !== user.uid).map(p => ({
          name: p.name,
          cardsLeft: p.hand.length
        }))
      });

      setAiHint({ card: hint.suggestedCard, reason: hint.reasoning });
      toast({ title: "AI Hint Ready", description: hint.reasoning });
    } catch (e) {
      toast({ variant: "destructive", title: "AI Error", description: "The strategist is unavailable." });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePlayCard = async (card: UnoCard, chosenColor?: CardColor) => {
    if (!gameState || !roomRef || !topCard || !user) return;
    const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === user.uid;
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

    setAiHint(null);
    playSound('play');
    let newPlayers = [...gameState.players];
    let newDrawPile = [...gameState.drawPile];
    let newDiscardPile = [...gameState.discardPile, card];
    let newDirection = gameState.direction;
    let newCurrentColor = (chosenColor || card.color) as CardColor;

    newPlayers = newPlayers.map(p => {
      if (p.id === user.uid) {
        const newHand = p.hand.filter(c => c.id !== card.id);
        return { ...p, hand: newHand, hasShoutedUno: newHand.length === 1 ? p.hasShoutedUno : false };
      }
      return p;
    });

    const isWinner = newPlayers.find(p => p.id === user.uid)?.hand.length === 0;
    
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

    if (isWinner) {
      playSound('win');
      await updateEndGameStats(newPlayers);
    }

    await updateDoc(roomRef, {
      players: newPlayers,
      drawPile: newDrawPile,
      discardPile: newDiscardPile,
      currentPlayerIndex: nextIdx,
      currentColor: newCurrentColor,
      direction: newDirection,
      status: isWinner ? 'ended' : 'playing',
      winner: isWinner ? user.uid : null,
      turnStartedAt: Date.now(),
      lastAction: `${newPlayers.find(p => p.id === user.uid)?.name} played ${card.color} ${card.value}`
    });
  };

  const handleDrawCard = async () => {
    if (!gameState || !roomRef || !user) return;
    const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === user.uid;
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
      if (p.id === user.uid) return { ...p, hand: [...p.hand, newCard], hasShoutedUno: false };
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

  const localPlayer = gameState?.players.find(p => p.id === user?.uid);
  const isMyTurn = gameState?.status === 'playing' && gameState.players[gameState.currentPlayerIndex]?.id === user?.uid;
  const isHost = gameState?.hostId === user?.uid;
  const topCard = gameState?.discardPile[gameState?.discardPile.length - 1];

  if (docLoading || !gameState) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background text-white font-headline tracking-widest text-xl">SYNCHRONIZING ARENA...</div>;
  }

  if (gameState.status === 'lobby') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center space-y-6 mesh-gradient p-4 overflow-hidden">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl md:text-5xl font-headline font-black text-white tracking-widest uppercase text-center">
          ARENA <span className="text-primary">{roomId}</span>
        </motion.h1>
        <div className="w-full max-w-sm glass p-6 rounded-3xl space-y-4 shadow-2xl border-white/20">
          <div className="space-y-2">
            <h2 className="text-[10px] font-headline font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
              <Users className="w-3 h-3" /> Combatants ({gameState.players.length})
            </h2>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-2 no-scrollbar">
              {gameState.players.map((p, i) => (
                <div key={p.id} className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                  <span className="text-white text-xs font-bold flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full overflow-hidden border border-primary/50">
                      <Image src={PlaceHolderImages[i % 3].imageUrl} alt={p.name} width={32} height={32} />
                    </div>
                    {p.name}
                  </span>
                  {p.id === gameState.hostId && <span className="text-[8px] text-yellow-400 font-bold tracking-widest">HOST</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {isHost ? (
              <Button disabled={gameState.players.length < 2} onClick={handleStartGame} className="w-full h-12 bg-primary text-white font-headline font-black text-sm rounded-xl">
                UNLEASH COMBAT
              </Button>
            ) : (
              <div className="w-full p-4 bg-white/5 rounded-xl border border-white/10 text-center">
                <p className="text-white/70 font-headline text-[10px] animate-pulse uppercase">Waiting for host...</p>
              </div>
            )}
            <Button variant="outline" onClick={() => router.push('/')} className="w-full h-10 border-white/10 text-white font-headline font-bold text-xs rounded-xl">
              LEAVE ARENA
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen mesh-gradient relative overflow-hidden flex-col">
      <div className="p-3 flex justify-between items-center glass border-b border-white/10 z-20">
         <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="text-white h-8 w-8"><ArrowLeft className="w-4 h-4"/></Button>
            <div className="flex flex-col">
              <span className="text-[8px] text-white/50 uppercase font-black">Arena</span>
              <span className="text-sm font-headline font-black text-primary truncate max-w-[80px]">{roomId}</span>
            </div>
            <VoiceChat roomId={roomId} playerId={user?.uid || ''} />
         </div>
         <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={requestAiHint} disabled={!isMyTurn || isAiLoading} className="h-8 border-primary/30 bg-primary/10 text-primary text-[10px] font-black uppercase hover:bg-primary/20">
              {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />} Hint
            </Button>
            <Button onClick={() => { setIsChatOpen(!isChatOpen); setHasUnreadMessages(false); }} variant="ghost" className="text-white relative h-8 w-8">
              <MessageCircle className="w-5 h-5" />
              {hasUnreadMessages && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-white shadow-lg animate-bounce" />}
            </Button>
         </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 left-0 right-0 flex justify-center gap-3 px-4 overflow-x-auto no-scrollbar">
          {gameState.players.filter(p => p.id !== user?.uid).map((p, i) => (
            <div key={p.id} className="flex flex-col items-center min-w-[60px]">
              <div className={cn(
                "w-10 h-10 rounded-full border-2 border-white/10 transition-all shadow-xl",
                gameState.currentPlayerIndex === gameState.players.indexOf(p) && "golden-glow scale-110 border-primary"
              )}>
                <Image src={PlaceHolderImages[i % 3].imageUrl} alt={p.name} width={64} height={64} className="rounded-full" />
              </div>
              <div className="glass px-2 py-0.5 rounded-full mt-1.5 text-center min-w-[50px] border-white/20">
                <p className="text-[7px] font-black text-white truncate max-w-[45px]">{p.name}</p>
                <p className="text-[7px] text-primary font-black">{p.hand.length} C</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 md:gap-8 scale-75 md:scale-100">
          <div onClick={handleDrawCard} className={cn(!isMyTurn && "opacity-40 grayscale cursor-not-allowed", "cursor-pointer group relative")}>
            <UnoCardUI card={{ id: 'back', color: 'wild', value: 'wild' }} isOpponent />
          </div>
          <div className="relative w-20 h-32 md:w-32 md:h-48 border-2 border-dashed border-white/5 rounded-xl">
            <AnimatePresence>
              {gameState.discardPile.slice(-3).map((c, i) => (
                <motion.div key={c.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1, rotate: (i - 1) * 5 }}>
                   <UnoCardUI card={c} isPlayable={false} className="w-full h-full" />
                </motion.div>
              ))}
            </AnimatePresence>
            <div className={cn("absolute -top-10 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 border-white/20", `bg-${gameState.currentColor === 'yellow' ? 'yellow-400' : gameState.currentColor + '-500'}`)} />
          </div>
        </div>

        {gameState.lastAction && (
          <div className="absolute bottom-36 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 max-w-[90%] text-center">
            <span className="text-[7px] font-black text-white/80 uppercase tracking-widest truncate block">{gameState.lastAction}</span>
          </div>
        )}
      </div>

      <div className="h-32 glass border-t border-white/20 flex items-center justify-center p-2 relative z-10">
         <div className="flex -space-x-8 md:-space-x-12 overflow-x-auto no-scrollbar max-w-full px-12 pb-2 h-full items-center">
           {localPlayer?.hand.map((c, i) => (
             <UnoCardUI 
              key={c.id} 
              card={c} 
              index={i} 
              isPlayable={isMyTurn && canPlayCard(c, topCard!, gameState.currentColor)}
              isHighlighted={aiHint?.card?.id === c.id || (aiHint?.card?.value === c.value && aiHint?.card?.color === c.color)}
              onClick={() => handlePlayCard(c)}
             />
           ))}
         </div>
      </div>

      <UnoButton show={localPlayer?.hand.length === 1 && !localPlayer.hasShoutedUno} onClick={async () => {
        playSound('uno');
        const updated = gameState.players.map(p => p.id === user?.uid ? { ...p, hasShoutedUno: true } : p);
        await updateDoc(roomRef, { players: updated, lastAction: `${localPlayer?.name} shouted UNO!` });
      }} />

      <AnimatePresence>
        {isChatOpen && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 20 }} className="fixed inset-y-0 right-0 w-full sm:w-80 z-[60] shadow-2xl">
            <ChatSidebar roomId={roomId} userName={localPlayer?.name || 'Player'} onClose={() => setIsChatOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <WildColorPicker isOpen={showColorPicker} onSelect={(c) => { if (pendingCard) handlePlayCard(pendingCard, c); setShowColorPicker(false); setPendingCard(null); }} />

      {gameState.status === 'ended' && (
        <div className="fixed inset-0 z-[100] glass flex flex-col items-center justify-center p-6 text-center">
             <Trophy className="w-16 h-16 text-yellow-500 mb-4 animate-bounce" />
             <h2 className="text-4xl font-headline font-black text-white mb-2 uppercase">Arena Concluded</h2>
             <p className="text-lg text-primary font-black uppercase tracking-widest">
               {gameState.players.find(p => p.id === gameState.winner)?.name} CLAIMED THE ARENA!
             </p>
             <div className="mt-6 space-y-2">
               <p className="text-[10px] text-white/50 uppercase font-black">Points Distributed Based on Rank</p>
               <Button onClick={() => router.push('/')} className="h-12 px-10 rounded-xl bg-primary text-white font-black text-lg shadow-2xl">RETURN HOME</Button>
             </div>
        </div>
      )}
    </div>
  );
}

export default function GameArena() {
  return (
    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-background text-white font-headline tracking-widest text-xl uppercase">Initiating Arena...</div>}>
      <GameArenaContent />
    </Suspense>
  );
}
