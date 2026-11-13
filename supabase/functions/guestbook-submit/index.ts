import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
import { createGuestbookHandler } from './handler.ts';

const serviceKey =
  Deno.env.get('GUESTBOOK_SECRET_KEY') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  '';
const url = Deno.env.get('SUPABASE_URL') || '';
const origins = (Deno.env.get('GUESTBOOK_ALLOWED_ORIGINS') || '')
  .split(/[,\r\n]+/)
  .map((value) => value.trim())
  .filter(Boolean);
const handler = createGuestbookHandler(
  {
    origins,
    rateSecret: Deno.env.get('GUESTBOOK_RATE_SECRET') || serviceKey,
    turnstileSecret: Deno.env.get('TURNSTILE_SECRET_KEY'),
  },
  async (input) => {
    if (!url || !serviceKey) throw new Error('Guestbook configuration missing');
    const client = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data, error } = await client.rpc('submit_guestbook', {
      p_nickname: input.nickname,
      p_message: input.message,
      p_rate_key: input.rateKey,
      p_request_id: input.requestId,
    });
    if (error) throw new Error(error.message);
    return data?.[0] ?? null;
  },
);
Deno.serve(handler);
