import React from 'react';
import { motion } from 'framer-motion';

interface PortalTransitionProps {
  onComplete: () => void;
}

const PortalTransition: React.FC<PortalTransitionProps> = ({ onComplete }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0B0D0F] overflow-hidden"
    >
      
      {/* 1. Optimized Speed Lines (Background Atmosphere) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
          {[...Array(6)].map((_, i) => (
              <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.5, x: 0 }}
                  animate={{ 
                      opacity: [0, 0.6, 0], 
                      scale: [1, 2],
                      x: [0, (i % 2 === 0 ? 300 : -300)]
                  }}
                  transition={{
                      duration: 0.8,
                      delay: i * 0.1,
                      repeat: Infinity,
                      ease: "linear"
                  }}
                  className="absolute w-40 h-0.5 bg-blue-500 rounded-full"
                  style={{ 
                      rotate: `${i * 60}deg`,
                      willChange: "transform, opacity"
                  }}
              />
          ))}
      </div>

      {/* 2. The Expanding Portal Ring */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
            scale: [0, 1, 40], // Explode outwards massively
            opacity: [0, 1, 0],
            rotate: 180
        }}
        transition={{ 
            duration: 2.2, 
            times: [0, 0.4, 1], 
            ease: "easeInOut" 
        }}
        className="absolute z-10 w-64 h-64 rounded-full border-2 border-cyan-400/50 shadow-[0_0_80px_rgba(6,214,160,0.4)] will-change-transform"
      />

      {/* 3. "Hello Capybara" Text Animation */}
      <div className="relative z-20 text-center">
         <motion.h1 
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1.5, opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold text-white tracking-tight"
            style={{ textShadow: "0 0 40px rgba(59, 130, 246, 0.6)" }}
         >
            Hello <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Capybara</span>
         </motion.h1>
         
         <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-4 text-blue-200/60 text-lg font-medium tracking-widest uppercase"
         >
            Welcome Back
         </motion.p>
      </div>

      {/* 4. The White Flash Overlay (Trigger Navigation) */}
      <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.4 }} // Flash happens after text is fully visible
          onAnimationComplete={onComplete}
          className="absolute inset-0 bg-white z-50 pointer-events-none"
      />

    </motion.div>
  );
};

export default PortalTransition;