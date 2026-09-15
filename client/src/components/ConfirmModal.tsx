import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  confirmColor?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDangerous = false,
  isLoading = false,
  confirmColor,
}) => {
  const buttonClass = confirmColor 
    ? `${confirmColor} text-white`
    : isDangerous 
      ? 'bg-red-600 hover:bg-red-700 text-white' 
      : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(4px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            className="fixed inset-0 bg-black/60" 
            onClick={onClose}
          />

          {/* Modal Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.25, bounce: 0.2 }}
            className="relative z-10 w-full max-w-md transform overflow-hidden rounded-xl bg-white dark:bg-[#1A1D21] shadow-2xl border border-gray-100 dark:border-white/10"
          >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
             <div className={`rounded-full p-2 ${isDangerous ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                 <AlertTriangle size={20} />
             </div>
             <h3 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-transparent px-4 py-2 font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
          >
             {cancelText}
          </button>
          
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-lg px-4 py-2 font-bold shadow-sm disabled:opacity-50 transition-colors ${buttonClass}`}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;