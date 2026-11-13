import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = url && key ? createClient(url, key) : null
export type GuestbookEntry = {id:string; nickname:string; message:string; created_at:string}
const STORAGE_KEY = 'quiet-gallery-demo-guestbook'
export function demoRead(): GuestbookEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as GuestbookEntry[] } catch { return [] }
}
export function demoWrite(nickname: string, message: string): GuestbookEntry {
  const entry = {id:crypto.randomUUID(), nickname, message, created_at:new Date().toISOString()}
  localStorage.setItem(STORAGE_KEY, JSON.stringify([entry,...demoRead()].slice(0,30)))
  return entry
}
