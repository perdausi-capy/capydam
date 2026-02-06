import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export const CountdownTimer = ({ expiresAt }: { expiresAt: string }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(expiresAt).getTime();
      const distance = end - now;

      if (distance < 0) {
        setTimeLeft("EXPIRED");
        clearInterval(timer);
        return;
      }
      const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((distance % (1000 * 60)) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return (
    <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-black/40 px-3 py-1.5 rounded border-2 border-gray-300 dark:border-slate-600">
        <Clock size={14} className="text-orange-600 dark:text-yellow-400" />
        <span className="font-mono font-bold text-sm text-orange-700 dark:text-yellow-400">{timeLeft}</span>
    </div>
  );
};