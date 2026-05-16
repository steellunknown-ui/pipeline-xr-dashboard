"use client";

import { useEffect } from 'react';
import { clearCorruptedSession } from '@/lib/session-recovery';

export function SessionCleaner() {
  useEffect(() => {
    // Check for corrupted session data on app startup
    const checkAndCleanSession = async () => {
      if (typeof window === 'undefined') return;
      
      try {
        // Check localStorage for corrupted session data
        const storageKeys = Object.keys(localStorage);
        let foundCorruption = false;
        
        for (const key of storageKeys) {
          if (key.includes('supabase') || key.includes('sb-')) {
            try {
              const value = localStorage.getItem(key);
              if (value && typeof value === 'string') {
                // Check for the specific corruption pattern
                if (value.includes('Cannot create property') || 
                    (value.includes('"user":') && value.includes('steellunknown@gmail.com') && value.includes('username":"g'))) {
                  console.warn(`Corrupted session data found in ${key}, clearing all session data...`);
                  foundCorruption = true;
                  break;
                }
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
        
        if (foundCorruption) {
          await clearCorruptedSession();
          // Force a page reload to ensure clean state
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      } catch (error) {
        console.error('Session cleanup failed:', error);
      }
    };
    
    checkAndCleanSession();
  }, []);
  
  return null; // This component doesn't render anything
}