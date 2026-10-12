import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const GET: APIRoute = async ({ cookies, request }) => {
  const supabase = createSupabaseServerClient({ cookies, request });
  const { data: { user } } = await supabase.auth.getUser();

  return Response.json(
    { email: user?.email ?? null },
    { headers: { "Cache-Control": "private, no-store" } }
  );
};
