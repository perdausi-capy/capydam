import React, { useState, useRef, useEffect } from 'react';
import { Smile, Send, Paperclip, X, Loader2, Image as ImageIcon } from 'lucide-react';
// ✅ FIX: Use 'import type' for TypeScript types
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';

interface ChatInputProps {
  onSendMessage: (content: string, file?: File) => void;
  isLoading?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if ((!message.trim() && !selectedFile) || isLoading) return;

    onSendMessage(message, selectedFile || undefined);
    
    // Reset state
    setMessage('');
    setSelectedFile(null);
    setShowEmoji(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setMessage(prev => prev + emojiData.emoji);
  };

  return (
    <div className="relative flex flex-col bg-white dark:bg-[#1E1F22] border border-gray-200 dark:border-white/10 rounded-xl shadow-sm">
      
      {/* File Preview */}
      {selectedFile && (
        <div className="flex items-center gap-3 p-3 m-2 bg-gray-50 dark:bg-black/20 rounded-lg border border-gray-200 dark:border-white/5">
            <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg">
                <ImageIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <button 
                onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500 transition-colors"
            >
                <X size={16} />
            </button>
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2 p-3">
        <div className="flex gap-2 pb-1.5 text-gray-400">
            {/* File Button */}
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <button 
                onClick={() => fileInputRef.current?.click()} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors hover:text-blue-500"
                title="Attach file"
            >
                <Paperclip size={20} />
            </button>

            {/* Emoji Button */}
            <div className="relative" ref={emojiRef}>
                <button 
                    onClick={() => setShowEmoji(!showEmoji)} 
                    className={`p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors ${showEmoji ? 'text-yellow-500' : 'hover:text-yellow-500'}`}
                    title="Add emoji"
                >
                    <Smile size={20} />
                </button>
                {showEmoji && (
                    <div className="absolute bottom-12 left-0 z-50 shadow-2xl rounded-xl border border-gray-200 dark:border-white/10">
                        <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.AUTO} width={300} height={400} />
                    </div>
                )}
            </div>
        </div>

        {/* Text Area */}
        <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            className="flex-1 bg-transparent border-0 outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none py-2.5 max-h-[150px] custom-scrollbar"
            style={{ minHeight: '44px' }}
        />

        {/* Send Button */}
        <button 
            onClick={handleSend} 
            disabled={isLoading || (!message.trim() && !selectedFile)} 
            className="mb-1 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center min-w-[40px] min-h-[40px]"
        >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
};

export default ChatInput;