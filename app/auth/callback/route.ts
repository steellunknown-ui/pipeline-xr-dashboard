import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirect = requestUrl.searchParams.get('redirect')
  const origin = requestUrl.origin

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
          remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
        },
      }
    )

    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // Save GitHub token to user_profiles so AI Fix works for all users
    if (data?.session?.provider_token && data.session.user) {
      const user = data.session.user
      const providerToken = data.session.provider_token
      const identity = user.identities?.find((id: any) => id.provider === 'github')

      if (identity) {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        await adminClient.from('user_profiles').upsert({
          id: user.id,
          github_access_token: providerToken,
          github_username: identity.identity_data?.user_name || identity.identity_data?.login,
          github_avatar_url: identity.identity_data?.avatar_url,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
      }
    }
  }

  let redirectUrl = redirect || '/dashboard';
  
  const cookieStore = await cookies();
  const githubReturnUrl = cookieStore.get('github_return_url')?.value;
  if (githubReturnUrl) redirectUrl = githubReturnUrl;

  return NextResponse.redirect(`${origin}${redirectUrl}`)
}
