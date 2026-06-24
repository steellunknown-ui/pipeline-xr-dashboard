import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: proj } = await supabase.from('projects').select('id, user_id').limit(1);

  const res = await supabase.from('deployments').insert({
    project_id: proj![0].id,
    user_id: proj![0].user_id,
    environment: 'development',
    branch: 'zip-upload',
    status: 'pending',
    source: 'zip'
  }).select();

  return NextResponse.json(res);
}
