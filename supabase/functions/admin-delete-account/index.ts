import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
import { createDeleteAccountHandler } from './handler.ts';

const origins = (Deno.env.get('ADMIN_ALLOWED_ORIGINS') || '')
  .split(/[,\r\n]+/)
  .map((value) => value.trim())
  .filter(Boolean);
const url = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
function caller(token: string) {
  return createClient(url, anonKey, {
    ...options,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
function service() {
  return createClient(url, serviceKey, options);
}
Deno.serve(
  createDeleteAccountHandler(origins, {
    async isOwner(token) {
      const client = caller(token);
      const { data: identity, error: authError } =
        await client.auth.getUser(token);
      if (authError || !identity.user) return false;
      const { data: access, error } = await client.rpc('gallery_access');
      return !error && access?.is_active === true && access.role === 'owner';
    },
    async prepare(token, userId, expected) {
      const { data, error } = await caller(token).rpc(
        'prepare_gallery_account_deletion',
        { p_user_id: userId, p_expected: expected },
      );
      return { userId: data, error };
    },
    async deleteAuth(userId) {
      // Soft deletion revokes credentials/sessions while retaining the user ID
      // referenced by artwork records and uploaded Storage objects.
      const { error } = await service().auth.admin.deleteUser(userId, true);
      return !error;
    },
    async finish(userId) {
      const { error } = await service().rpc('finish_gallery_account_deletion', {
        p_user_id: userId,
      });
      return !error;
    },
  }),
);
