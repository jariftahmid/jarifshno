
"use client"

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnoCard, CardColor, GameState, createDeck, canPlayCard, Player } from '@/lib/uno-engine';
import UnoCardUI from '@/components/uno/UnoCardUI';
import ChatSidebar from '@/components/uno/ChatSidebar';
import WildColorPicker from '@/components/uno/WildColorPicker';
import UnoButton from '@/components/uno/UnoButton';
import { getStrategicHint, StrategicHintOutput } from '@/ai/flows/ai-strategic-hint-tool';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function GameArena() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const router = useRouter();
  
  // Game State
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingCard, setPendingCard] = useState<UnoCard | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiHint, setAiHint] = useState<StrategicHintOutput | null>(null);

  // Initialize Game
  useEffect(() => {
    if (!roomId) return;
    const deck = createDeck();
    const players: Player[] = [
      { id: '1', name: 'You', hand: deck.splice(0, 7), isLocal: true },
      { id: '2', name: 'Satoshi', hand: deck.splice(0, 7), isLocal: false },
      { id: '3', name: 'Luna', hand: deck.splice(0, 7), isLocal: false },
    ];
    
    const initialTop = deck.pop()!;
    
    setGameState({
      roomId: roomId,
      players,
      discardPile: [initialTop],
      drawPile: deck,
      currentPlayerIndex: 0,
      currentColor: initialTop.color === 'wild' ? 'red' : initialTop.color,
      direction: 1,
      status: 'playing',
    });
  }, [roomId]);

  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const topCard = gameState?.discardPile[gameState.discardPile.length - 1];

  const handlePlayCard = (card: UnoCard) => {
    if (!gameState || !topCard || gameState.currentPlayerIndex !== 0) return;

    if (!canPlayCard(card, topCard, gameState.currentColor)) {
      toast({ title: "Invalid move!", description: "Card must match color or value." });
      return;
    }

    if (card.color === 'wild') {
      setPendingCard(card);
      setShowColorPicker(true);
      return;
    }

    executePlay(card, card.color);
  };

  const executePlay = (card: UnoCard, chosenColor: CardColor) => {
    if (!gameState) return;

    const newPlayers = [...gameState.players];
    const playerHand = newPlayers[gameState.currentPlayerIndex].hand;
    const cardIndex = playerHand.findIndex(c => c.id === card.id);
    playerHand.splice(cardIndex, 1);

    // Handle Action Cards
    let nextIndex = (gameState.currentPlayerIndex + gameState.direction + gameState.players.length) % gameState.players.length;
    let newDirection = gameState.direction;

    if (card.value === 'reverse') {
      newDirection = (gameState.direction * -1) as 1 | -1;
      nextIndex = (gameState.currentPlayerIndex + newDirection + gameState.players.length) % gameState.players.length;
    } else if (card.value === 'skip') {
      nextIndex = (nextIndex + newDirection + gameState.players.length) % gameState.players.length;
    }

    setGameState({
      ...gameState,
      players: newPlayers,
      discardPile: [...gameState.discardPile, card],
      currentPlayerIndex: nextIndex,
      currentColor: chosenColor,
      direction: newDirection,
    });

    setAiHint(null);
  };

  const handleDrawCard = () => {
    if (!gameState || gameState.currentPlayerIndex !== 0) return;
    
    const newDrawPile = [...gameState.drawPile];
    const newCard = newDrawPile.pop();
    if (!newCard) return;

    const newPlayers = [...gameState.players];
    newPlayers[0].hand.push(newCard);

    setGameState({
      ...gameState,
      drawPile: newDrawPile,
      players: newPlayers,
      currentPlayerIndex: (gameState.currentPlayerIndex + 1) % gameState.players.length,
    });
    
    setAiHint(null);
  };

  const getAiStrategicHint = async () => {
    if (!gameState || !currentPlayer || !topCard) return;
    
    setIsAiLoading(true);
    try {
      const hint = await getStrategicHint({
        playerHand: currentPlayer.hand.map(c => ({ color: c.color, value: c.value })),
        discardPileTopCard: { color: topCard.color, value: topCard.value },
        currentColor: gameState.currentColor,
        opponentPlayers: gameState.players
          .filter(p => !p.isLocal)
          .map(p => ({ name: p.name, cardsLeft: p.hand.length }))
      });
      setAiHint(hint);
    } catch (e) {
      toast({ title: "AI Error", variant: "destructive", description: "Could not fetch hint." });
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!gameState) return null;

  return (
    <div className="flex h-screen w-screen mesh-gradient relative overflow-hidden font-body">
      <div className="flex-1 flex flex-col relative arena-3d">
        <div className="p-4 flex justify-between items-center glass border-b border-white/10 z-10">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/')} className="text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5 mr-2" /> Lobby
            </Button>
            <div className="flex flex-col">
              <span className="text-xs text-white/50">ROOM</span>
              <span className="text-lg font-headline font-bold text-primary tracking-widest">{roomId}</span>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
             <div className={cn(
               "w-12 h-12 rounded-full blur-2xl absolute",
               gameState.currentColor === 'red' && "bg-red-500",
               gameState.currentColor === 'blue' && "bg-blue-500",
               gameState.currentColor === 'green' && "bg-green-500",
               gameState.currentColor === 'yellow' && "bg-yellow-500"
             )}></div>
             <span className="text-xs text-white/50 font-headline uppercase tracking-tighter">Current Color</span>
             <span className={cn(
               "text-xl font-bold font-headline drop-shadow-lg transition-colors capitalize",
               gameState.currentColor === 'red' && "text-red-500",
               gameState.currentColor === 'blue' && "text-blue-500",
               gameState.currentColor === 'green' && "text-green-500",
               gameState.currentColor === 'yellow' && "text-yellow-400"
             )}>
               {gameState.currentColor}
             </span>
          </div>

          <Button 
            onClick={getAiStrategicHint} 
            disabled={isAiLoading || gameState.currentPlayerIndex !== 0}
            className="bg-accent/20 hover:bg-accent/40 text-accent border border-accent/30 rounded-full"
          >
            {isAiLoading ? "Thinking..." : <><Sparkles className="w-4 h-4 mr-2" /> Get AI Hint</>}
          </Button>
        </div>

        <AnimatePresence>
          {aiHint && (
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 20, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="absolute top-24 left-4 z-50 glass p-4 rounded-xl border border-accent/40 w-80 shadow-2xl"
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
                  {aiHint.wildCardColorSuggestion && (
                    <p className="text-[10px] text-primary mt-2 font-bold uppercase tracking-wider">
                      Suggestion: Pick {aiHint.wildCardColorSuggestion}
                    </p>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setAiHint(null)} className="h-6 text-[10px] p-0 mt-2 text-white/40 hover:text-white hover:bg-transparent">
                    Dismiss
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
          <div className="absolute top-12 left-0 right-0 flex justify-around px-20">
            {gameState.players.filter(p => !p.isLocal).map((p, i) => (
              <div key={p.id} className="flex flex-col items-center gap-2">
                <div className={cn(
                  "w-16 h-16 rounded-full border-2 border-white/20 p-1 transition-all relative overflow-hidden",
                  gameState.currentPlayerIndex === gameState.players.indexOf(p) && "golden-glow"
                )}>
                  <Image 
                    src={PlaceHolderImages.find(img => img.id === `player-${p.id}`)?.imageUrl || PlaceHolderImages[0].imageUrl} 
                    alt={p.name} 
                    width={100} 
                    height={100} 
                    className="w-full h-full rounded-full object-cover"
                    data-ai-hint="avatar person"
                  />
                </div>
                <div className="glass px-3 py-1 rounded-full text-center">
                  <p className="text-xs font-bold text-white">{p.name}</p>
                  <p className="text-[10px] text-primary uppercase">{p.hand.length} Cards</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-12 pile-3d">
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              onClick={handleDrawCard}
              className="relative cursor-pointer"
            >
              <UnoCardUI card={{ id: 'back', color: 'wild', value: 'wild' }} isOpponent />
              <div className="absolute -bottom-6 left-0 right-0 text-center">
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Draw Deck</span>
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
              <div className="w-24 h-36 border-2 border-white/5 rounded-xl opacity-0"></div>
              <div className="absolute -bottom-6 left-0 right-0 text-center">
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Discard</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-48 left-0 right-0 text-center pointer-events-none">
             <motion.p 
               animate={{ opacity: [0.5, 1, 0.5] }}
               transition={{ duration: 2, repeat: Infinity }}
               className="text-lg font-headline font-bold text-white/30 tracking-[0.3em] uppercase"
             >
               {gameState.currentPlayerIndex === 0 ? "Your Turn" : `${gameState.players[gameState.currentPlayerIndex].name}'s Turn`}
             </motion.p>
          </div>
        </div>

        <div className="h-56 glass border-t border-white/10 flex items-center justify-center relative p-4 group">
          <div className="flex items-center justify-center -space-x-8 max-w-full">
            {gameState.players[0].hand.map((card, i) => (
              <UnoCardUI 
                key={card.id} 
                card={card} 
                index={i} 
                isPlayable={gameState.currentPlayerIndex === 0 && canPlayCard(card, topCard!, gameState.currentColor)}
                onClick={() => handlePlayCard(card)}
              />
            ))}
          </div>
        </div>

        <UnoButton 
          show={gameState.players[0].hand.length === 2 && gameState.currentPlayerIndex === 0} 
          onClick={() => toast({ title: "UNO!", description: "You safely shouted UNO." })} 
        />
      </div>

      <ChatSidebar />

      <WildColorPicker 
        isOpen={showColorPicker} 
        onSelect={(color) => {
          if (pendingCard) executePlay(pendingCard, color);
          setShowColorPicker(false);
          setPendingCard(null);
        }} 
      />
    </div>
  );
}
