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
      <motion.div
        className={cn(
          "w-10 h-16 md:w-16 md:h-24 rounded-lg border-2 border-white/20 glass card-plastic flex items-center justify-center overflow-hidden",
          className
        )}
        initial={{ y: 20, rotateY: 180, opacity: 0 }}
        animate={{ y: 0, rotateY: 180, opacity: 1 }}
        transition={{ delay: index * 0.05 }}
      >
        <div className="w-full h-full bg-gradient-to-br from-purple-900 to-indigo-950 flex items-center justify-center relative shadow-inner">
          <span className="text-white/10 text-xl md:text-3xl font-black font-headline select-none tracking-tighter">UNO</span>
          <div className="absolute inset-0 bg-white/5 pointer-events-none"></div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layoutId={card.id}
      whileHover={isPlayable ? { y: -30, scale: 1.15, zIndex: 100, rotate: 0 } : {}}
      whileTap={isPlayable ? { scale: 0.95 } : {}}
      onClick={isPlayable ? onClick : undefined}
      className={cn(
        "relative w-16 h-24 md:w-28 md:h-40 rounded-xl border-2 border-white/30 card-plastic cursor-pointer select-none transition-all shrink-0",
        colorMap[card.color],
        !isPlayable && "grayscale-[0.6] opacity-70 cursor-not-allowed scale-95",
        isPlayable && "hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] z-10",
        className
      )}
      initial={{ y: 150, opacity: 0, scale: 0.5, rotate: (index - 2) * 10 }}
      animate={{ y: 0, opacity: 1, scale: 1, rotate: (index - 2) * 5 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
    >
      <div className="absolute inset-2 md:inset-3 border-2 border-white/20 rounded-lg flex flex-col items-center justify-center overflow-hidden bg-white/5 backdrop-blur-[4px] shadow-inner">
        <span className="text-white text-2xl md:text-5xl font-black font-headline drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] tracking-tighter">
          {displayValue(card.value)}
        </span>
        
        {card.color === 'wild' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
             <div className="w-20 h-20 md:w-32 md:h-32 rounded-full bg-gradient-to-tr from-red-500 via-yellow-400 to-blue-500 blur-2xl animate-spin-slow"></div>
          </div>
        )}
      </div>
      
      <div className="absolute top-1.5 left-2 md:top-2 md:left-3 text-[10px] md:text-lg font-black text-white/90">
        {displayValue(card.value)}
      </div>
      <div className="absolute bottom-1.5 right-2 md:bottom-2 md:right-3 text-[10px] md:text-lg font-black text-white/90 rotate-180">
        {displayValue(card.value)}
      </div>
    </motion.div>
  );
};

export default UnoCardUI;
