"use client"

import React from 'react';
import { motion } from 'framer-motion';
import { UnoCard, CardColor } from '@/lib/uno-engine';
import { cn } from '@/lib/utils';

interface UnoCardUIProps {
  card: UnoCard;
  onClick?: () => void;
  isPlayable?: boolean;
  className?: string;
  index?: number;
  isOpponent?: boolean;
}

const colorMap: Record<CardColor, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  wild: 'bg-zinc-800'
};

const UnoCardUI: React.FC<UnoCardUIProps> = ({ card, onClick, isPlayable, className, index = 0, isOpponent }) => {
  const displayValue = (val: string) => {
    if (val === 'draw_two') return '+2';
    if (val === 'wild_draw_four') return '+4';
    if (val === 'skip') return '⊘';
    if (val === 'reverse') return '⇄';
    if (val === 'wild') return 'W';
    return val;
  };

  if (isOpponent) {
    return (
      <div
        className={cn(
          "w-10 h-16 md:w-16 md:h-24 rounded-lg border-2 border-white/20 bg-zinc-900 card-plastic flex items-center justify-center overflow-hidden shrink-0",
          className
        )}
      >
        <div className="w-full h-full bg-gradient-to-br from-purple-900 to-indigo-950 flex items-center justify-center relative shadow-inner">
          <span className="text-white/10 text-xl md:text-3xl font-black font-headline select-none tracking-tighter">UNO</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      layout
      whileHover={isPlayable ? { y: -20, scale: 1.1, zIndex: 100 } : {}}
      whileTap={isPlayable ? { scale: 0.95 } : {}}
      onClick={isPlayable ? onClick : undefined}
      className={cn(
        "relative w-16 h-24 md:w-28 md:h-40 rounded-xl border-2 card-plastic cursor-pointer select-none transition-all shrink-0 shadow-xl",
        colorMap[card.color],
        isPlayable ? "border-primary ring-4 ring-primary/40 shadow-[0_0_20px_rgba(211,76,219,0.5)] z-10" : "border-white/30 grayscale-[0.4] opacity-70 scale-95",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
    >
      <div className="absolute inset-1.5 md:inset-3 border-2 border-white/10 rounded-lg flex flex-col items-center justify-center overflow-hidden bg-white/5 backdrop-blur-[2px]">
        <span className="text-white text-xl md:text-5xl font-black font-headline drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] tracking-tighter">
          {displayValue(card.value)}
        </span>
        
        {card.color === 'wild' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
             <div className="w-full h-full bg-gradient-to-tr from-red-500 via-yellow-400 to-blue-500 blur-xl"></div>
          </div>
        )}
      </div>
      
      <div className="absolute top-1 left-1.5 md:top-2 md:left-3 text-[10px] md:text-lg font-black text-white/80">
        {displayValue(card.value)}
      </div>
      <div className="absolute bottom-1 right-1.5 md:bottom-2 md:right-3 text-[10px] md:text-lg font-black text-white/80 rotate-180">
        {displayValue(card.value)}
      </div>

      {isPlayable && (
        <motion.div 
          className="absolute inset-0 rounded-xl border-2 border-white/50 pointer-events-none"
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
};

export default UnoCardUI;