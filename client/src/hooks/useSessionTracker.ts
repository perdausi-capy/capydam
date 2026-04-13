import { useEffect } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext'; 

export const useSessionTracker = () => {
  const { user } = useAuth(); // Only track if logged in
  
  useEffect(() => {
    if (!user) return;

    let activeSeconds = 0;
    
    // Check every 1 minute
    const interval = setInterval(() => {
      // Only count time if they are actually looking at the CapyDAM tab!
      if (document.hasFocus()) {
        activeSeconds += 60; 
        
        // Every 5 minutes (300 seconds), save the block of time to the database
        if (activeSeconds >= 300) {
          client.post('/analytics/log', {
            action: 'SESSION_TIME',
            details: 'Active browsing session',
            duration: activeSeconds,
            metadata: { userAgent: navigator.userAgent }
          }).catch(() => {});
          
          activeSeconds = 0; // Reset the counter after saving
        }
      }
    }, 60000); 

    return () => clearInterval(interval);
  }, [user]);
};