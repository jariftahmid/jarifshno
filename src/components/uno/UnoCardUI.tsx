
"use client"

import React from 'react';
import { motion } from 'framer-motion';
import { UnoCard, CardColor } from '@/lib/uno-engine';
import { cn } from '@/lib/utils';

interface UnoCardUIProps {
  card: UnoCard;
  onClick?: () => void;
  isPlayable?: boolean;
  isHighlighted?: boolean;
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

const UnoCardUI: React.FC<UnoCardUIProps> = ({ card, onClick, isPlayable, isHighlighted, className, isOpponent }) => {
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
      <div className={cn(
        "w-12 h-20 md:w-16 md:h-24 rounded-lg border-2 border-white/10 bg-zinc-900 card-plastic flex items-center justify-center overflow-hidden shrink-0",
        className
      )}>
        <div className="w-full h-full bg-gradient-to-br from-purple-900 to-indigo-950 flex items-center justify-center shadow-inner">
          <span className="text-white/10 text-xl font-black font-headline select-none tracking-tighter">UNO</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      layout
      whileHover={isPlayable ? { y: -15, scale: 1.05, zIndex: 100 } : {}}
      whileTap={isPlayable ? { scale: 0.95 } : {}}
      onClick={isPlayable ? onClick : undefined}
      className={cn(
        "relative w-16 h-24 md:w-24 md:h-36 rounded-xl border-2 card-plastic cursor-pointer select-none transition-all shrink-0 shadow-lg",
        colorMap[card.color],
        isPlayable ? "border-primary/60 ring-2 ring-primary/20 z-10 shadow-[0_0_15px_rgba(211,76,219,0.2)]" : "border-white/10 grayscale-[0.2] opacity-80",
        isHighlighted && "ring-4 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)] border-yellow-400",
        className
      )}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
    >
      <div className="absolute inset-1.5 md:inset-2.5 border-2 border-white/5 rounded-lg flex flex-col items-center justify-center overflow-hidden bg-white/5 backdrop-blur-[1px]">
        <span className="text-white text-xl md:text-4xl font-black font-headline drop-shadow-md tracking-tighter">
          {displayValue(card.value)}
        </span>
        {card.color === 'wild' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
             <div className="w-full h-full bg-gradient-to-tr from-red-500 via-yellow-400 to-blue-500 blur-lg" />
          </div>
        )}
      </div>
      <div className="absolute top-1 left-1.5 text-[8px] md:text-xs font-black text-white/80">
        {displayValue(card.value)}
      </div>
      <div className="absolute bottom-1 right-1.5 text-[8px] md:text-xs font-black text-white/80 rotate-180">
        {displayValue(card.value)}
      </div>
      {isPlayable && (
        <motion.div className="absolute inset-0 rounded-xl border-2 border-primary/30 pointer-events-none" animate={{ opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 2, repeat: Infinity }} />
      )}
    </motion.div>
  );
};

export default UnoCardUI;
