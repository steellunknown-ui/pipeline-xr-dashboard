import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
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
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/projects/github`
      }
    });

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to initiate GitHub OAuth'
      });
    }

    return NextResponse.json({
      success: true,
      url: data.url
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'GitHub OAuth failed'
    });
  }
}