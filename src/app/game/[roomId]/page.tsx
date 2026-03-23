
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowLeft, Info, PlayCircle, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnoCard, CardColor, GameState, canPlayCard, createDeck, shuffle } from '@/lib/uno-engine';
import UnoCardUI from '@/components/uno/UnoCardUI';
import ChatSidebar from '@/components/uno/ChatSidebar';
import WildColorPicker from '@/components/uno/WildColorPicker';
import UnoButton from '@/components/uno/UnoButton';
import { getStrategicHint, StrategicHintOutput } from '@/ai/flows/ai-strategic-hint-tool';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useFirestore, useDoc, useAuth } from '@/firebase';
import { doc, updateDoc, arrayUnion, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

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
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiHint, setAiHint] = useState<StrategicHintOutput | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
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

      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Auth error:", e);
        }
      }
      setIsAuthLoading(false);
    };

    initPlayer();
  }, [auth]);

  useEffect(() => {
    if (!db || !roomId) return;
    const q = query(collection(db, 'rooms', roomId, 'messages'), orderBy('timestamp', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isChatOpen && !snapshot.empty) {
        setHasUnreadMessages(true);
      }
    });
    return () => unsubscribe();
  }, [db, roomId, isChatOpen]);

  useEffect(() => {
    if (isChatOpen) setHasUnreadMessages(false);
  }, [isChatOpen]);

  useEffect(() => {
    if (!gameState || !playerId || !roomRef || isAuthLoading) return;

    const myPresence = gameState.players.find(p => p.id === playerId);
    if (!myPresence && gameState.status === 'lobby') {
      const name = localStorage.getItem('uno_username') || 'Player';
      updateDoc(roomRef, {
        players: arrayUnion({ id: playerId, name, hand: [] })
      });
    }
  }, [gameState, playerId, roomRef, isAuthLoading]);

  const localPlayer = gameState?.players.find(p => p.id === playerId);
  const isMyTurn = gameState && gameState.status === 'playing' && gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  const topCard = gameState?.discardPile[gameState?.discardPile.length - 1];

  const handleStartGame = async () => {
    if (!roomRef || !gameState) return;
    
    let deck = createDeck();
    const updatedPlayers = gameState.players.map(p => ({
      ...p,
      hand: deck.splice(0, 7)
    }));

    // Ensure the first card is not a wild card for simplicity
    let firstCard = deck.pop()!;
    while (firstCard.color === 'wild') {
      deck.unshift(firstCard);
      firstCard = deck.pop()!;
    }
    
    updateDoc(roomRef, {
      players: updatedPlayers,
      drawPile: deck,
      discardPile: [firstCard],
      status: 'playing',
      currentPlayerIndex: 0,
      currentColor: firstCard.color,
      direction: 1,
      lastAction: 'Game started!'
    });
  };

  const handlePlayCard = async (card: UnoCard, chosenColor?: CardColor) => {
    if (!gameState || !roomRef || !isMyTurn || !topCard) return;

    if (!canPlayCard(card, topCard, gameState.currentColor)) {
      toast({ title: "Invalid move!", description: "Card must match color or value." });
      return;
    }

    // Handle Wild Card Color Selection
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

    // Remove played card from hand
    newPlayers = newPlayers.map(p => {
      if (p.id === playerId) {
        return { ...p, hand: p.hand.filter(c => c.id !== card.id) };
      }
      return p;
    });

    const isWinner = newPlayers.find(p => p.id === playerId)?.hand.length === 0;

    // Handle Reverse
    if (card.value === 'reverse') {
      if (newPlayers.length === 2) {
        // In 2 player game, reverse acts as a skip
      } else {
        newDirection = (newDirection === 1 ? -1 : 1) as 1 | -1;
      }
    }

    // Determine the next player index
    let nextPlayerIdx = (gameState.currentPlayerIndex + newDirection + newPlayers.length) % newPlayers.length;

    // Handle Skip and Penalties (+2, +4)
    let skipNext = false;
    let penaltyCount = 0;

    if (card.value === 'skip' || (card.value === 'reverse' && newPlayers.length === 2)) {
      skipNext = true;
    } else if (card.value === 'draw_two') {
      skipNext = true;
      penaltyCount = 2;
    } else if (card.value === 'wild_draw_four') {
      skipNext = true;
      penaltyCount = 4;
    }

    // Apply penalty to the NEXT player
    if (penaltyCount > 0) {
      const penaltyCards: UnoCard[] = [];
      for (let i = 0; i < penaltyCount; i++) {
        if (newDrawPile.length === 0) {
          // Reshuffle discard pile into draw pile
          const top = newDiscardPile.pop()!;
          newDrawPile = shuffle(newDiscardPile);
          newDiscardPile = [top];
        }
        if (newDrawPile.length > 0) {
          penaltyCards.push(newDrawPile.pop()!);
        }
      }

      newPlayers = newPlayers.map((p, idx) => {
        if (idx === nextPlayerIdx) {
          return { ...p, hand: [...p.hand, ...penaltyCards] };
        }
        return p;
      });
    }

    // If skip logic is active, increment player index again
    if (skipNext) {
      nextPlayerIdx = (nextPlayerIdx + newDirection + newPlayers.length) % newPlayers.length;
    }

    const updateData: any = {
      players: newPlayers,
      drawPile: newDrawPile,
      discardPile: newDiscardPile,
      currentPlayerIndex: nextPlayerIdx,
      currentColor: newCurrentColor,
      direction: newDirection,
      status: isWinner ? 'ended' : 'playing',
      lastAction: `${localPlayer?.name} played ${card.color} ${card.value}`
    };

    if (isWinner) {
      updateData.winner = playerId;
    }

    updateDoc(roomRef, updateData);
  };

  const handleDrawCard = async () => {
    if (!gameState || !roomRef || !isMyTurn) return;

    let { drawPile, discardPile } = gameState;
    if (drawPile.length === 0) {
      const top = discardPile.pop()!;
      drawPile = shuffle(discardPile);
      discardPile = [top];
    }

    const newCard = drawPile.pop()!;
    const updatedPlayers = gameState.players.map(p => {
      if (p.id === playerId) return { ...p, hand: [...p.hand, newCard] };
      return p;
    });

    const nextIdx = (gameState.currentPlayerIndex + gameState.direction + gameState.players.length) % gameState.players.length;

    updateDoc(roomRef, {
      players: updatedPlayers,
      drawPile,
      discardPile,
      currentPlayerIndex: nextIdx,
      lastAction: `${localPlayer?.name} drew a card`
    });
  };

  const getAiStrategicHint = async () => {
    if (!gameState || !localPlayer || !topCard) return;
    setIsAiLoading(true);
    try {
      const hint = await getStrategicHint({
        playerHand: localPlayer.hand.map(c => ({ color: c.color, value: c.value })),
        discardPileTopCard: { color: topCard.color, value: topCard.value },
        currentColor: gameState.currentColor,
        opponentPlayers: gameState.players
          .filter(p => p.id !== playerId)
          .map(p => ({ name: p.name, cardsLeft: p.hand.length }))
      });
      setAiHint(hint);
    } catch (e) {
      toast({ title: "AI Error", variant: "destructive", description: "Could not fetch hint." });
    } finally {
      setIsAiLoading(false);
    }
  };

  if (docLoading || isAuthLoading || (!gameState && !docLoading)) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center space-y-4 mesh-gradient">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-white/60 font-headline uppercase tracking-widest">Entering Arena...</p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center space-y-8 mesh-gradient p-8">
        <h2 className="text-2xl font-headline text-white">ROOM NOT FOUND</h2>
        <Button onClick={() => router.push('/')}>Back to Lobby</Button>
      </div>
    );
  }

  if (gameState.status === 'lobby') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center space-y-8 mesh-gradient p-8 overflow-y-auto">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-white tracking-tight">WAITING ROOM</h1>
          <p className="text-primary font-bold tracking-[0.5em] text-xl md:text-2xl">{roomId}</p>
        </div>
        
        <div className="w-full max-w-md glass p-6 rounded-3xl space-y-6">
          <div className="space-y-4">
            <h2 className="text-xs font-headline font-bold text-white/50 uppercase tracking-widest">Players ({gameState.players.length}/10)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gameState.players.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                    {p.name[0]}
                  </div>
                  <span className="text-sm font-bold text-white truncate">{p.name} {p.id === playerId && "(You)"}</span>
                </div>
              ))}
            </div>
          </div>
          
          <Button 
            disabled={gameState.players.length < 2}
            onClick={handleStartGame}
            className="w-full h-14 bg-primary hover:bg-primary/80 text-white font-headline font-bold rounded-2xl text-lg shadow-xl shadow-primary/20"
          >
            <PlayCircle className="w-6 h-6 mr-2" /> Start Combat
          </Button>
          {gameState.players.length < 2 && (
            <p className="text-center text-[10px] text-white/30 uppercase tracking-tighter">At least 2 players required to start</p>
          )}
        </div>
        <Button variant="ghost" onClick={() => router.push('/')} className="text-white/50 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-2" /> Leave Room
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen mesh-gradient relative overflow-hidden font-body">
      <div className="flex-1 flex flex-col relative arena-3d">
        {/* Header */}
        <div className="p-3 md:p-4 flex justify-between items-center glass border-b border-white/10 z-20">
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="text-white hover:bg-white/10 md:hidden">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" onClick={() => router.push('/')} className="hidden md:flex text-white hover:bg-white/10 h-8">
              <ArrowLeft className="w-4 h-4 mr-2" /> Lobby
            </Button>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/50 uppercase">ROOM</span>
              <span className="text-xs md:text-sm font-headline font-bold text-primary tracking-widest">{roomId}</span>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
             <div className={cn(
               "w-6 h-6 md:w-10 md:h-10 rounded-full blur-xl md:blur-2xl absolute transition-all duration-500 opacity-60",
               gameState.currentColor === 'red' && "bg-red-500",
               gameState.currentColor === 'blue' && "bg-blue-500",
               gameState.currentColor === 'green' && "bg-green-500",
               gameState.currentColor === 'yellow' && "bg-yellow-500"
             )}></div>
             <span className="text-[8px] md:text-[10px] text-white/50 font-headline uppercase tracking-tighter">Current Color</span>
             <span className={cn(
               "text-sm md:text-lg font-bold font-headline drop-shadow-lg transition-colors capitalize",
               gameState.currentColor === 'red' && "text-red-500",
               gameState.currentColor === 'blue' && "text-blue-500",
               gameState.currentColor === 'green' && "text-green-500",
               gameState.currentColor === 'yellow' && "text-yellow-400"
             )}>
               {gameState.currentColor}
             </span>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              onClick={getAiStrategicHint} 
              disabled={isAiLoading || !isMyTurn}
              className="bg-accent/20 hover:bg-accent/40 text-accent border border-accent/30 rounded-full h-8 px-2 md:px-4 text-[10px] md:text-xs"
            >
              {isAiLoading ? "..." : <><Sparkles className="w-3 h-3 mr-1 md:mr-2" /> AI Hint</>}
            </Button>
            
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsChatOpen(true)}
                className="text-white hover:bg-white/10"
              >
                <MessageCircle className="w-5 h-5" />
              </Button>
              {hasUnreadMessages && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#1a161e] animate-pulse"></div>
              )}
            </div>
          </div>
        </div>

        {/* AI Hint Popup */}
        <AnimatePresence>
          {aiHint && (
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 20, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="absolute top-20 left-4 z-50 glass p-4 rounded-xl border border-accent/40 w-[calc(100vw-32px)] md:w-80 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <Info className="text-accent w-5 h-5 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-accent">AI Strategy</p>
                  <p className="text-xs text-white/70 mt-1 leading-relaxed">
                    Play the <span className="font-bold text-white capitalize">{aiHint.suggestedCard.color} {aiHint.suggestedCard.value}</span>.
                    <br />
                    <span className="italic mt-1 block">"{aiHint.reasoning}"</span>
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setAiHint(null)} className="h-6 text-[10px] p-0 mt-2 text-white/40 hover:text-white">
                    Dismiss
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative">
          {/* Opponents */}
          <div className="absolute top-4 md:top-12 left-0 right-0 flex justify-center gap-4 md:gap-12 px-4 md:px-20 overflow-x-auto no-scrollbar">
            {gameState.players.filter(p => p.id !== playerId).map((p, i) => (
              <div key={p.id} className="flex flex-col items-center gap-1 md:gap-2 shrink-0">
                <div className={cn(
                  "w-10 h-10 md:w-14 md:h-14 rounded-full border-2 border-white/20 p-0.5 md:p-1 transition-all relative overflow-hidden",
                  gameState.currentPlayerIndex === gameState.players.indexOf(p) && "golden-glow"
                )}>
                  <Image 
                    src={PlaceHolderImages[i % PlaceHolderImages.length].imageUrl} 
                    alt={p.name} 
                    width={100} 
                    height={100} 
                    className="w-full h-full rounded-full object-cover"
                    data-ai-hint="avatar person"
                  />
                </div>
                <div className="glass px-2 md:px-3 py-0.5 md:py-1 rounded-full text-center min-w-[60px] md:min-w-[80px]">
                  <p className="text-[8px] md:text-xs font-bold text-white truncate max-w-[60px] md:max-w-[100px]">{p.name}</p>
                  <p className="text-[7px] md:text-[10px] text-primary uppercase">{p.hand.length} Cards</p>
                </div>
              </div>
            ))}
          </div>

          {/* Table / Piles */}
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 pile-3d mt-12 md:mt-0">
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              onClick={handleDrawCard}
              className={cn("relative cursor-pointer", !isMyTurn && "cursor-not-allowed opacity-50")}
            >
              <UnoCardUI card={{ id: 'back', color: 'wild', value: 'wild' }} isOpponent />
              <div className="absolute -bottom-4 md:-bottom-6 left-0 right-0 text-center">
                <span className="text-[8px] md:text-[10px] text-white/40 font-bold uppercase tracking-widest">Draw Pile</span>
              </div>
            </motion.div>

            <div className="relative">
              {gameState.discardPile.slice(-3).map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ rotate: Math.random() * 20 - 10, scale: 0.8, x: -50, opacity: 0 }}
                  animate={{ rotate: (i - 1) * 5, scale: 1, x: 0, opacity: 1 }}
                  className="absolute inset-0"
                >
                  <UnoCardUI card={card} isPlayable={false} />
                </motion.div>
              ))}
              <div className="w-16 h-24 md:w-24 md:h-36 border-2 border-white/5 rounded-xl opacity-0"></div>
              <div className="absolute -bottom-4 md:-bottom-6 left-0 right-0 text-center">
                <span className="text-[8px] md:text-[10px] text-white/40 font-bold uppercase tracking-widest">Discard</span>
              </div>
            </div>
          </div>

          {/* Turn Indicator */}
          <div className="absolute bottom-40 md:bottom-48 left-0 right-0 text-center pointer-events-none">
             <motion.p 
               animate={{ opacity: [0.5, 1, 0.5] }}
               transition={{ duration: 2, repeat: Infinity }}
               className="text-xs md:text-lg font-headline font-bold text-white/30 tracking-[0.3em] uppercase"
             >
               {isMyTurn ? "Your Turn" : `${gameState.players[gameState.currentPlayerIndex]?.name}'s Turn`}
             </motion.p>
          </div>
        </div>

        {/* Player Hand */}
        <div className="h-32 md:h-48 glass border-t border-white/10 flex items-center justify-start md:justify-center relative p-2 md:p-4 group overflow-x-auto no-scrollbar">
          <div className="flex items-center justify-center -space-x-8 md:-space-x-8 min-w-max px-8 md:px-12">
            {localPlayer?.hand.map((card, i) => (
              <UnoCardUI 
                key={card.id} 
                card={card} 
                index={i} 
                isPlayable={isMyTurn && canPlayCard(card, topCard!, gameState.currentColor)}
                onClick={() => handlePlayCard(card)}
              />
            ))}
          </div>
        </div>

        <UnoButton 
          show={localPlayer?.hand.length === 2 && isMyTurn} 
          onClick={async () => {
            await updateDoc(roomRef, { lastAction: `${localPlayer?.name} shouted UNO!` });
            toast({ title: "UNO!", description: "You shouted UNO!" });
          }} 
        />
      </div>

      {/* Responsive Chat Sidebar */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 md:relative md:inset-auto z-[100] md:z-30 w-full md:w-80 h-full"
          >
            <ChatSidebar 
              roomId={roomId} 
              userName={localPlayer?.name || 'Player'} 
              onClose={() => setIsChatOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <WildColorPicker 
        isOpen={showColorPicker} 
        onSelect={(color) => {
          if (pendingCard) {
            handlePlayCard(pendingCard, color);
          }
          setShowColorPicker(false);
          setPendingCard(null);
        }} 
      />

      <AnimatePresence>
        {gameState.status === 'ended' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-[200] glass flex items-center justify-center backdrop-blur-xl p-6"
          >
            <div className="text-center space-y-6">
              <h2 className="text-3xl md:text-6xl font-headline font-bold text-white tracking-widest">GAME OVER</h2>
              <div className="space-y-2">
                <p className="text-primary uppercase tracking-[0.5em] text-lg md:text-xl">Champion</p>
                <p className="text-2xl md:text-4xl font-bold text-white">{gameState.players.find(p => p.id === gameState.winner)?.name}</p>
              </div>
              <Button onClick={() => router.push('/')} className="w-full md:w-auto bg-primary hover:bg-primary/80 h-14 px-12 rounded-2xl font-bold text-lg">
                Return to Lobby
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
