import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // Check if user already has GitHub identity
    const hasGitHubIdentity = user.identities?.some(identity => identity.provider === 'github');
    
    if (hasGitHubIdentity) {
      return NextResponse.json({
        success: false,
        error_code: 'ALREADY_LINKED',
        error: 'GitHub is already linked to this account'
      });
    }

    // Link GitHub identity to existing user
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'github',
      options: {
        scopes: 'repo read:user',
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`
      }
    });

    if (error) {
      if (error.message?.includes('already linked')) {
        return NextResponse.json({
          success: false,
          error_code: 'GITHUB_ALREADY_LINKED',
          error: 'This GitHub account is already linked to another Pipeline XR user'
        });
      }
      
      return NextResponse.json({
        success: false,
        error: 'Failed to link GitHub account'
      });
    }

    return NextResponse.json({
      success: true,
      url: data.url
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'GitHub linking failed'
    }, { status: 500 });
  }
}