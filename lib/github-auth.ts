import { createClient } from "@/lib/supabase-server";

export async function getGithubAccessToken(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    const token = session?.provider_token || null;
    console.log('GitHub OAuth token available:', !!token);
    
    return token;
  } catch (error) {
    console.log('GitHub OAuth token available:', false);
    return null;
  }
}