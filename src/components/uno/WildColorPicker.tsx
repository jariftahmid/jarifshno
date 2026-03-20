"use client"

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardColor } from '@/lib/uno-engine';

interface WildColorPickerProps {
  onSelect: (color: CardColor) => void;
  isOpen: boolean;
}

const colors: { name: CardColor; class: string }[] = [
  { name: 'red', class: 'bg-red-500' },
  { name: 'blue', class: 'bg-blue-500' },
  { name: 'green', class: 'bg-green-500' },
  { name: 'yellow', class: 'bg-yellow-400' },
];

const WildColorPicker: React.FC<WildColorPickerProps> = ({ onSelect, isOpen }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md"
        >
          <div className="relative w-64 h-64">
            <h3 className="absolute -top-16 left-0 right-0 text-center text-2xl font-headline font-bold text-white">
              Pick a Color
            </h3>
            <div className="grid grid-cols-2 gap-4 w-full h-full">
              {colors.map((c, i) => (
                <motion.button
                  key={c.name}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onSelect(c.name)}
                  className={`${c.class} rounded-2xl shadow-xl border-4 border-white/20 transition-all hover:border-white/60`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WildColorPicker;
