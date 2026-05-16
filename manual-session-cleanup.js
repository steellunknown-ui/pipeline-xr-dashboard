// Manual Session Cleanup Script
// Run this in browser console if session corruption persists

console.log('🧹 Starting manual session cleanup...');

// Clear all localStorage items containing supabase
const localStorageKeys = Object.keys(localStorage);
let clearedCount = 0;

localStorageKeys.forEach(key => {
  if (key.includes('supabase') || key.includes('sb-')) {
    console.log(`Removing localStorage key: ${key}`);
    localStorage.removeItem(key);
    clearedCount++;
  }
});

// Clear all sessionStorage items containing supabase
const sessionStorageKeys = Object.keys(sessionStorage);
sessionStorageKeys.forEach(key => {
  if (key.includes('supabase') || key.includes('sb-')) {
    console.log(`Removing sessionStorage key: ${key}`);
    sessionStorage.removeItem(key);
    clearedCount++;
  }
});

// Clear all cookies containing supabase
const cookies = document.cookie.split(';');
cookies.forEach(cookie => {
  const [name] = cookie.trim().split('=');
  if (name.includes('supabase') || name.includes('sb-')) {
    console.log(`Removing cookie: ${name}`);
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
    clearedCount++;
  }
});

console.log(`✅ Cleanup complete! Cleared ${clearedCount} items.`);
console.log('🔄 Reloading page in 2 seconds...');

setTimeout(() => {
  window.location.reload();
}, 2000);