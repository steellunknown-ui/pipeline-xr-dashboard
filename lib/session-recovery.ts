import { supabase } from "./supabase-browser";

export async function recoverSession() {
  try {
    
    
    // Check for corrupted session data in storage first
    if (typeof localStorage !== 'undefined') {
      const storageKeys = Object.keys(localStorage);
      for (const key of storageKeys) {
        if (key.includes('supabase') || key.includes('sb-')) {
          try {
            const value = localStorage.getItem(key);
            if (value && typeof value === 'string' && value.includes('"user":{') && value.includes('Cannot create property')) {
              console.warn('Corrupted session data detected in localStorage, clearing...');
              await clearCorruptedSession();
              return false;
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    }
    
    // Try to get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('Session error detected, clearing corrupted session:', error.message);
      await clearCorruptedSession();
      return false;
    }
    
    if (session) {
      // Validate session structure
      if (typeof session.user === 'string') {
        console.warn('Corrupted session detected (user is string), clearing...');
        await clearCorruptedSession();
        return false;
      }
      
      // Additional validation for session integrity
      if (session.user && (!session.user.id || !session.user.email)) {
        console.warn('Invalid session structure detected, clearing...');
        await clearCorruptedSession();
        return false;
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Session recovery failed:', error);
    await clearCorruptedSession();
    return false;
  }
}

export async function clearCorruptedSession() {
  try {
    
    
    // Sign out to clear session
    await supabase.auth.signOut();
    
    // Clear all Supabase cookies
    const cookiesToClear = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase-auth-token',
      'supabase.auth.token'
    ];
    
    cookiesToClear.forEach(cookieName => {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
    });
    
    // Clear localStorage
    if (typeof localStorage !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('supabase')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    
    // Clear sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.includes('supabase')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    }
    
    console.log('Corrupted session cleared successfully');
    return true;
  } catch (error) {
    console.error('Failed to clear corrupted session:', error);
    return false;
  }
}

export function initSessionRecovery() {
  if (typeof window === 'undefined') return;
  
  // Check for corrupted session on page load
  window.addEventListener('load', async () => {
    await recoverSession();
  });
  
  // Handle unhandled promise rejections that might be session-related
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || '';
    if ((errorMessage.includes('Cannot create property') && errorMessage.includes('user')) ||
        errorMessage.includes('_recoverAndRefresh') ||
        errorMessage.includes('SupabaseAuthClient')) {
      console.warn('Detected session corruption error, clearing session...');
      clearCorruptedSession().then(() => {
        // Force reload after clearing session
        setTimeout(() => window.location.reload(), 1000);
      });
      event.preventDefault();
    }
  });
  
  // Handle general errors that might be session-related
  window.addEventListener('error', (event) => {
    const errorMessage = event.message || '';
    if ((errorMessage.includes('Cannot create property') && errorMessage.includes('user')) ||
        errorMessage.includes('_recoverAndRefresh') ||
        errorMessage.includes('SupabaseAuthClient')) {
      console.warn('Detected session corruption error, clearing session...');
      clearCorruptedSession().then(() => {
        // Force reload after clearing session
        setTimeout(() => window.location.reload(), 1000);
      });
    }
  });
}
