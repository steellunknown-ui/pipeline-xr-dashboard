/**
 * @deprecated Use lib/supabase-browser.ts for client-side or lib/supabase-server.ts for server-side.
 * This file creates a raw Supabase client without proper SSR cookie handling,
 * which can cause session storage issues.
 * 
 * For new code:
 * - Client components: import { supabase } from '@/lib/supabase-browser'
 * - Server components/API routes: import { createClient } from '@/lib/supabase-server'
 */
import { createClient } from '@supabase/supabase-js'

// Force IPv4 for Node.js fetch/undici timeouts connecting to Supabase
// We check if process is defined (runs on server)
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
        const dns = require('node:dns');
        if (typeof dns.setDefaultResultOrder === 'function') {
            dns.setDefaultResultOrder('ipv4first');
        }
    } catch (e) {
        // Ignore in edge/browser
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Only use this for non-SSR contexts (scripts, background jobs)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
