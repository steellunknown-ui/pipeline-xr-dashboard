import { createBrowserClient } from '@supabase/ssr'

// Custom storage adapter that validates and auto-repairs corrupted session data
// This fixes: "Cannot create property 'user' on string" TypeError
const createSafeStorage = (): Storage | undefined => {
  if (typeof window === 'undefined') return undefined

  return {
    getItem: (key: string): string | null => {
      try {
        const value = localStorage.getItem(key)
        if (!value) return null

        // Check if the stored value is a valid session format
        // The error occurs when session data gets double-stringified
        if (key.includes('auth-token') || key.includes('supabase')) {
          try {
            const parsed = JSON.parse(value)
            // If parsing resulted in a string (double-stringified), clear it
            if (typeof parsed === 'string') {
              console.warn(`[Supabase] Clearing corrupted session data for key: ${key}`)
              localStorage.removeItem(key)
              return null
            }
          } catch {
            // If it's not valid JSON, clear it
            console.warn(`[Supabase] Clearing invalid session data for key: ${key}`)
            localStorage.removeItem(key)
            return null
          }
        }
        return value
      } catch (error) {
        console.error('[Supabase] Storage getItem error:', error)
        return null
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        localStorage.setItem(key, value)
      } catch (error) {
        console.error('[Supabase] Storage setItem error:', error)
      }
    },
    removeItem: (key: string): void => {
      try {
        localStorage.removeItem(key)
      } catch (error) {
        console.error('[Supabase] Storage removeItem error:', error)
      }
    },
    get length(): number {
      return localStorage.length
    },
    clear: (): void => {
      localStorage.clear()
    },
    key: (index: number): string | null => {
      return localStorage.key(index)
    },
  }
}

// Create browser client with safe storage and explicit config
// This ensures proper sync with the proxy session refresh
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    isSingleton: true,
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: createSafeStorage(),
    },
  }
)

// Backward compatibility
export const createClient = () => supabase
