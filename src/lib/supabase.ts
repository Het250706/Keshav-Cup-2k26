import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * PRODUCTION-SAFE SINGLETON
 * Ensures only one client is ever created in the browser to prevent lock "steal" conflicts.
 * This resolves: "AbortError: Lock broken by another request with the 'steal' option."
 */
let clientInstance: any = null

export const supabase = (() => {
    if (typeof window === 'undefined') {
        return createBrowserClient(supabaseUrl, supabaseAnonKey)
    }

    if (!clientInstance) {
        clientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false, // Prevents lock conflict during initial hydrate
                flowType: 'pkce',
            }
        })
    }

    return clientInstance
})()