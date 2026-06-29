import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const requestUrl = new URL(req.url);
    const origin = requestUrl.origin;
    const supabase = await createClient();
    
    // Get current user with identities
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Check if user has GitHub identity (primary or linked)
    const hasGitHubIdentity = user.identities?.some(identity => identity.provider === 'github');
    
    if (!hasGitHubIdentity) {
      return NextResponse.json({
        success: false,
        error_code: 'PROVIDER_MISMATCH',
        error: 'To connect GitHub, please sign up or log in using a GitHub account.',
        signup_url: 'https://github.com/signup'
      });
    }

    // Proceed with GitHub OAuth
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'repo read:user',
        redirectTo: `${origin}/auth/callback`
      }
    });

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to initiate GitHub OAuth'
      });
    }

    const response = NextResponse.json({
      success: true,
      url: data.url
    });
    
    // Explicitly set cookie on the response object to guarantee delivery
    response.cookies.set('github_return_url', '/dashboard/projects/github', { 
      maxAge: 60 * 5, 
      path: '/' 
    });

    return response;
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'GitHub OAuth failed'
    });
  }
}