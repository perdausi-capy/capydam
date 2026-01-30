import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Send } from 'lucide-react';
import client from '../api/client';
import { toast } from 'react-hot-toast';

const DailyQuestionModal = ({ isOpen, onClose, question, onVoteSuccess }: any) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleVote = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await client.post('/daily/vote', { 
        questionId: question.id, 
        optionId: selected 
      });
      toast.success("Your spell has been cast!");
      onVoteSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to vote");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white dark:bg-[#1A1D21] w-full max-w-md rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-2xl text-purple-600">
              <Sparkles size={24} />
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <h3 className="text-2xl font-black mb-6 dark:text-white leading-tight">
            {question.question}
          </h3>

          <div className="space-y-3">
            {question.options.map((opt: any) => (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`w-full p-4 rounded-2xl border-2 text-left font-bold transition-all
                  ${selected === opt.id 
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600' 
                    : 'border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:border-purple-300'}
                `}
              >
                {opt.text}
              </button>
            ))}
          </div>

          <button
            disabled={!selected || loading}
            onClick={handleVote}
            className="w-full mt-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20"
          >
            {loading ? "Casting..." : "Submit Answer"}
            <Send size={18} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DailyQuestionModal;