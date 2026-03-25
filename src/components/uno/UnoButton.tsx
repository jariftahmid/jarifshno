
"use client"

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UnoButtonProps {
  show: boolean;
  onClick: () => void;
}

const UnoButton: React.FC<UnoButtonProps> = ({ show, onClick }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ scale: 0, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0, rotate: 20, opacity: 0 }}
          whileHover={{ scale: 1.1, boxShadow: "0 0 30px rgba(255, 77, 77, 0.6)" }}
          whileTap={{ scale: 0.9 }}
          onClick={onClick}
          className="fixed bottom-48 right-12 w-28 h-28 rounded-full bg-gradient-to-br from-red-600 to-orange-500 text-white font-headline font-black text-2xl flex items-center justify-center border-4 border-white/40 shadow-2xl z-[100] select-none"
        >
          UNO!
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default UnoButton;
