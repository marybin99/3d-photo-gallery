import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
import { createAccountHandler } from './handler.ts';

const origins = (Deno.env.get('ADMIN_ALLOWED_ORIGINS') || '')
  .split(/[,\r\n]+/)
  .map((value) => value.trim())
  .filter(Boolean);
const url = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
function caller(token: string) {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function service() {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
Deno.serve(
  createAccountHandler(origins, {
    async isOwner(token) {
      const client = caller(token);
      const { data: identity, error: authError } =
        await client.auth.getUser(token);
      if (authError || !identity.user) return false;
      const { data: access, error } = await client.rpc('gallery_access');
      return !error && access?.is_active === true && access.role === 'owner';
    },
    async validRooms(token, ids) {
      const { data, error } = await caller(token)
        .from('gallery_rooms')
        .select('id');
      return !error && ids.every((id) => data?.some((room) => room.id === id));
    },
    async create(email, password) {
      const { data, error } = await service().auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user)
        return {
          error:
            error?.code === 'email_exists' ||
            error?.code === 'user_already_exists'
              ? 'duplicate'
              : 'failed',
        };
      return { id: data.user.id };
    },
    async grant(token, email, input) {
      const { error } = await caller(token).rpc('set_gallery_account', {
        p_email: email,
        p_role: input.role,
        p_active: input.is_active,
        p_rooms: input.room_ids,
        p_expected: null,
      });
      return !error;
    },
    async removeUnassigned(userId) {
      const client = service();
      // Do not delete a user if another request has already assigned permissions
      // (or a response was lost after the DB transaction committed).
      const { data, error } = await client
        .from('gallery_admins')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw new Error('Cannot verify account registration');
      if (!data) {
        const { error: removeError } =
          await client.auth.admin.deleteUser(userId);
        if (removeError) throw new Error('Cannot clean up unassigned account');
      }
    },
  }),
);
