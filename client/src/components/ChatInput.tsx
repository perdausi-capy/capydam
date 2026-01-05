import React, { useState, useRef, useEffect } from 'react';
// import { createPortal } from 'react-dom';
import { 
  Smile, Send, 
  Bold, Italic, Underline, Strikethrough, Code, Link as LinkIcon, List, 
  X, AtSign, Image as ImageIcon, Loader2, Plus, Sparkles, Mic, Video, CheckCircle,
  Heading1, Heading2, Quote, Type, ChevronDown 
} from 'lucide-react';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import { toast } from 'react-toastify';

interface MentionCandidate {
    id: string;
    name: string;
    avatar?: string;
}

interface ChatInputProps {
  onSendMessage: (content: string, file?: File) => void;
  onTyping?: () => void;
  isLoading?: boolean;
  mentionCandidates?: MentionCandidate[];
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, onTyping, isLoading, mentionCandidates = [] }) => {
  const [showEmoji, setShowEmoji] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Menus
  const [showMentions, setShowMentions] = useState(false);
  const [showTurnIntoMenu, setShowTurnIntoMenu] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle Outside Clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setShowEmoji(false);
          setShowMentions(false);
          setShowTurnIntoMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = () => {
    if (!editorRef.current) return;
    const content = editorRef.current.innerHTML;
    const hasText = !!editorRef.current.innerText.trim() || content.includes('<img');

    if (!hasText && !selectedFile) return;

    onSendMessage(content, selectedFile || undefined);
    
    // Reset
    editorRef.current.innerHTML = '';
    setIsEmpty(true);
    setShowEmoji(false);
    setShowMentions(false);
    setShowTurnIntoMenu(false);
    setSelectedFile(null); 
    if (fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (showMentions) { e.preventDefault(); return; }
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleInput = () => {
      if (!editorRef.current) return;
      setIsEmpty(editorRef.current.innerText.trim().length === 0);
      if (onTyping) onTyping();

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const text = range.startContainer.textContent;
          const charBeforeCursor = text?.slice(range.startOffset - 1, range.startOffset);
          if (charBeforeCursor === '@') setShowMentions(true);
          else if (charBeforeCursor === ' ') setShowMentions(false);
      }
  };

  const insertMention = (user: MentionCandidate) => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      const html = `<span class="mention-chip text-blue-400 bg-blue-900/30 font-bold rounded px-1 py-0.5 select-none" contenteditable="false" data-user-id="${user.id}">@${user.name}</span>&nbsp;`;
      document.execCommand('insertHTML', false, html);
      setShowMentions(false);
  };

  // 1. Standard Formatting
  const executeCommand = (e: React.MouseEvent, command: string, value: string | undefined = undefined) => {
    e.preventDefault(); 
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  // ✅ 2. FIXED: Block Formatting (Heading, Quote, Code Block)
  const handleTurnInto = (e: React.MouseEvent, tag: string) => {
      e.preventDefault();
      e.stopPropagation();
      editorRef.current?.focus();
      
      // Note: Some browsers require tags to be wrapped in <> (e.g. '<H1>')
      // We try both for maximum compatibility or let the browser handle standard block tags
      const fullTag = `<${tag}>`;
      document.execCommand('formatBlock', false, fullTag);
      
      setShowTurnIntoMenu(false);
  };

  // 3. Toggle Inline Code
  const toggleCode = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;

      const parent = selection.anchorNode?.parentElement;
      if (parent && (parent.classList.contains('inline-code-snippet') || parent.tagName === 'CODE')) {
          const textNode = document.createTextNode(parent.textContent || '');
          parent.replaceWith(textNode);
          editorRef.current?.normalize();
      } else if (!selection.isCollapsed) {
          const span = document.createElement('span');
          span.style.fontFamily = 'monospace';
          span.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          span.style.color = '#ff5252';
          span.className = "inline-code-snippet px-1.5 py-0.5 rounded border border-white/10 mx-0.5";
          const range = selection.getRangeAt(0);
          span.appendChild(range.extractContents());
          range.insertNode(span);
      }
  };

  const insertLink = (e: React.MouseEvent) => {
      e.preventDefault();
      const url = prompt("Enter the URL:");
      if (url) document.execCommand('createLink', false, url);
  };

  const handlePlaceholderAction = (actionName: string) => {
      toast.info(`${actionName} feature coming soon! 🚀`, { position: "bottom-center", theme: "dark", autoClose: 2000 });
  };

  const handleInsertTask = () => {
      if (editorRef.current) {
          editorRef.current.focus();
          document.execCommand('insertHTML', false, '&#9744;&nbsp;'); 
      }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand('insertText', false, emojiData.emoji);
        setIsEmpty(false);
        if (onTyping) onTyping();
    }
  };

  return (
    <div 
        ref={containerRef}
        className="relative flex flex-col bg-[#1E1F22] dark:bg-black/20 rounded-xl border border-gray-700 dark:border-white/10 shadow-lg overflow-visible transition-all focus-within:ring-1 focus-within:ring-blue-500/50" 
    >
        {/* --- STATIC TOP TOOLBAR --- */}
        <div className="flex items-center gap-1 p-1.5 bg-[#2B2D31] dark:bg-white/5 border-b border-gray-700 dark:border-white/5 rounded-t-xl relative">
            
            {/* Turn Into Dropdown */}
            <div className="relative">
                <button 
                    onMouseDown={(e) => { e.preventDefault(); setShowTurnIntoMenu(!showTurnIntoMenu); }}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                >
                    <span>Text</span>
                    <ChevronDown size={10} />
                </button>

                {/* Dropdown Menu (Opens Up) */}
                {showTurnIntoMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-40 bg-[#1E1F22] border border-gray-700 rounded-lg shadow-xl overflow-hidden flex flex-col py-1 z-50">
                        <span className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase">Turn into</span>
                        <TurnIntoItem onClick={(e) => handleTurnInto(e, 'P')} icon={<Type size={14} />} label="Text" />
                        <TurnIntoItem onClick={(e) => handleTurnInto(e, 'H1')} icon={<Heading1 size={14} />} label="Heading 1" />
                        <TurnIntoItem onClick={(e) => handleTurnInto(e, 'H2')} icon={<Heading2 size={14} />} label="Heading 2" />
                        <TurnIntoItem onClick={(e) => handleTurnInto(e, 'BLOCKQUOTE')} icon={<Quote size={14} />} label="Quote" />
                        <TurnIntoItem onClick={(e) => handleTurnInto(e, 'PRE')} icon={<Code size={14} />} label="Code block" />
                    </div>
                )}
            </div>

            <div className="w-[1px] h-4 bg-gray-600 dark:bg-white/10 mx-1" />

            <FormatButton onClick={(e) => executeCommand(e, 'bold')} icon={<Bold size={14}/>} tooltip="Bold" />
            <FormatButton onClick={(e) => executeCommand(e, 'italic')} icon={<Italic size={14}/>} tooltip="Italic" />
            <FormatButton onClick={(e) => executeCommand(e, 'underline')} icon={<Underline size={14}/>} tooltip="Underline" />
            <FormatButton onClick={(e) => executeCommand(e, 'strikeThrough')} icon={<Strikethrough size={14}/>} tooltip="Strike" />
            
            <div className="w-[1px] h-4 bg-gray-600 dark:bg-white/10 mx-1" />
            
            <FormatButton onClick={toggleCode} icon={<Code size={14}/>} tooltip="Inline Code" />
            <FormatButton onClick={(e) => executeCommand(e, 'insertUnorderedList')} icon={<List size={14}/>} tooltip="List" />
            <FormatButton onClick={insertLink} icon={<LinkIcon size={14}/>} tooltip="Link" />
        </div>

        {/* --- FILE PREVIEW --- */}
        {selectedFile && (
            <div className="flex items-center gap-3 bg-[#2B2D31] dark:bg-[#1E1F22] mx-3 mt-3 p-2 rounded-lg border border-gray-600 dark:border-white/10">
                <div className="p-2 bg-blue-500/20 rounded-lg"><ImageIcon size={20} className="text-blue-400"/></div>
                <span className="text-sm font-medium text-gray-200 truncate">{selectedFile.name}</span>
                <button onClick={() => setSelectedFile(null)} className="ml-auto p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
        )}

        {/* --- EDITOR AREA --- */}
        <div className="relative w-full px-4 py-3 min-h-[60px] max-h-[300px] overflow-y-auto custom-scrollbar">
            {isEmpty && !selectedFile && (
                <div className="absolute top-3 left-4 text-gray-500 pointer-events-none text-sm select-none font-medium">Type @ to mention...</div>
            )}
            {/* ✅ Added 'chat-editor' class for CSS support */}
            <div
                ref={editorRef}
                contentEditable
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                className="chat-editor w-full h-full outline-none text-sm text-gray-100 leading-relaxed break-words whitespace-pre-wrap font-sans placeholder-gray-500"
                style={{ minHeight: '40px' }}
            />
        </div>

        {/* --- MENTIONS DROPDOWN --- */}
        {showMentions && (
            <div className="absolute bottom-full left-12 mb-2 z-50 w-64 bg-[#2B2D31] border border-gray-700 rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in">
                <div className="bg-black/20 px-3 py-2 border-b border-white/5 text-[10px] uppercase font-bold text-gray-400">Mention User</div>
                <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                    {mentionCandidates.length > 0 ? mentionCandidates.map(u => (
                        <div key={u.id} onClick={() => insertMention(u)} className="flex items-center gap-2 px-3 py-2 hover:bg-blue-600 cursor-pointer transition-colors group">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-[10px] text-white font-bold">
                                {u.avatar ? <img src={u.avatar} className="w-full h-full rounded-full object-cover" /> : u.name.charAt(0)}
                            </div>
                            <span className="text-sm text-gray-200 group-hover:text-white">{u.name}</span>
                        </div>
                    )) : (<div className="p-3 text-xs text-gray-400 text-center">No matching users</div>)}
                </div>
            </div>
        )}

        {/* --- BOTTOM ACTION BAR --- */}
        <div className="flex items-center justify-between p-2 px-3 bg-[#2B2D31] dark:bg-white/5 border-t border-gray-700 dark:border-white/5 rounded-b-xl">
            <div className="flex items-center gap-2 relative">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                <button onClick={() => fileInputRef.current?.click()} className="p-1.5 bg-gray-600/50 hover:bg-gray-500 text-white rounded-full transition-colors" title="Upload"><Plus size={16} /></button>
                <div className="flex items-center gap-1">
                    <ActionButton onClick={() => handlePlaceholderAction('AI Assistant')} icon={<Sparkles size={16} />} tooltip="AI" />
                    <ActionButton onClick={(e) => { e.preventDefault(); setShowMentions(!showMentions); }} icon={<AtSign size={16} />} tooltip="Mention" />
                    <ActionButton onClick={() => setShowEmoji(!showEmoji)} icon={<Smile size={16} />} tooltip="Emoji" active={showEmoji} />
                    <ActionButton onClick={() => handlePlaceholderAction('Video')} icon={<Video size={16} />} tooltip="Video" />
                    <ActionButton onClick={() => handlePlaceholderAction('Voice')} icon={<Mic size={16} />} tooltip="Voice" />
                    <ActionButton onClick={handleInsertTask} icon={<CheckCircle size={16} />} tooltip="Task" />
                </div>
                {showEmoji && (<div className="absolute bottom-full left-0 mb-2 z-50 shadow-2xl rounded-xl border border-gray-700"><EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} width={300} height={400} /></div>)}
            </div>
            <button onClick={handleSend} disabled={isLoading || (isEmpty && !selectedFile)} className="flex items-center justify-center w-8 h-8 bg-[#00A38D] hover:bg-[#008F7A] text-white rounded-[4px] shadow-md transition-all disabled:opacity-50">{isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
        </div>
    </div>
  );
};

// --- HELPER COMPONENTS ---
const FormatButton = ({ onClick, icon, tooltip }: { onClick: (e: React.MouseEvent) => void, icon: React.ReactNode, tooltip: string }) => (
    <button onMouseDown={(e) => { e.preventDefault(); onClick(e); }} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-all" title={tooltip}>{icon}</button>
);

const ActionButton = ({ onClick, icon, tooltip, active }: { onClick: (e: React.MouseEvent) => void, icon: React.ReactNode, tooltip: string, active?: boolean }) => (
    <button onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`p-1.5 rounded-md transition-colors ${active ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} title={tooltip}>{icon}</button>
);

const TurnIntoItem = ({ onClick, icon, label }: { onClick: (e: React.MouseEvent) => void, icon: React.ReactNode, label: string }) => (
    <button onMouseDown={(e) => { e.preventDefault(); onClick(e); }} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-blue-600 transition-colors text-left w-full">
        <span className="opacity-70">{icon}</span>
        <span>{label}</span>
    </button>
);

export default ChatInput;