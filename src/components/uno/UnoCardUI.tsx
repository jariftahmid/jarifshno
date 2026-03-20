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
          "w-12 h-18 sm:w-16 sm:h-24 rounded-lg border-2 border-white/20 glass card-plastic flex items-center justify-center overflow-hidden",
          className
        )}
        initial={{ y: 0 }}
      >
        <div className="w-full h-full bg-gradient-to-br from-purple-900 to-indigo-950 flex items-center justify-center">
          <span className="text-white/20 text-xl font-bold font-headline select-none">U</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layoutId={card.id}
      whileHover={isPlayable ? { y: -30, scale: 1.1, zIndex: 50 } : {}}
      onClick={isPlayable ? onClick : undefined}
      className={cn(
        "relative w-20 h-32 sm:w-24 sm:h-36 rounded-xl border-2 border-white/30 card-plastic cursor-pointer select-none transition-shadow",
        colorMap[card.color],
        !isPlayable && "grayscale-[0.5] opacity-80 cursor-not-allowed",
        isPlayable && "hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]",
        className
      )}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1, rotate: (index - 2) * 2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="absolute inset-2 border-2 border-white/20 rounded-lg flex flex-col items-center justify-center overflow-hidden bg-white/5 backdrop-blur-sm">
        <span className="text-white text-3xl font-bold font-headline drop-shadow-md">
          {displayValue(card.value)}
        </span>
        
        {card.color === 'wild' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
             <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-red-500 via-yellow-400 to-blue-500 blur-xl"></div>
          </div>
        )}
      </div>
      
      {/* Corner indicators */}
      <div className="absolute top-1 left-1.5 text-xs font-bold text-white/80">
        {displayValue(card.value)}
      </div>
      <div className="absolute bottom-1 right-1.5 text-xs font-bold text-white/80 rotate-180">
        {displayValue(card.value)}
      </div>
    </motion.div>
  );
};

export default UnoCardUI;
