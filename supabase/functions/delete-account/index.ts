// Fully deletes the caller's account.
//
// The app can already wipe its own rows through RLS, but the auth.users row
// itself is off-limits to the anon key - removing it needs the service-role
// key, which must never ship inside the app. Hence this function.
//
// The target user is always derived from the caller's own JWT, never from the
// request body, so a user can only ever delete themselves.
//
// Everything else disappears with it: profiles has
//   references auth.users(id) on delete cascade
// and diary_logs / expenses / goods / friendships all cascade off profiles
// (see supabase/schema.sql).
//
// Deploy:  npx supabase functions deploy delete-account
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing Authorization header' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: 'Invalid session' }, 401);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ ok: true });
});
