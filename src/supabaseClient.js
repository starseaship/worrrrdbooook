import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

async function loadRuntimeConfig() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' })
    if (!response.ok) return {}
    return await response.json()
  } catch (_error) {
    return {}
  }
}

const config = await loadRuntimeConfig()

const supabaseUrl = config.supabaseUrl || ''
const supabaseAnonKey = config.supabaseAnonKey || ''

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
