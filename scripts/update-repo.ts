import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const userId = 'd17bc26a-cd6f-4817-802a-6ae5bf5b676b';
const newRepoUrl = 'https://github.com/steellunknown-ui/pipeline-xr-dashboard';

async function updateRepository() {
  console.log('🔄 Updating repository...');

  const { data: projects, error: fetchError } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId);

  if (fetchError || !projects || projects.length === 0) {
    console.error('❌ Error fetching project:', fetchError);
    return;
  }

  const project = projects[0];
  console.log(`📦 Found project: ${project.name} (${project.id})`);
  console.log(`📍 Old repo: ${project.github_repo_url}`);

  const { data: updated, error: updateError } = await supabase
    .from('projects')
    .update({ github_repo_url: newRepoUrl })
    .eq('id', project.id)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Error updating project:', updateError);
    return;
  }

  console.log(`✅ Repository updated to: ${newRepoUrl}`);

  await supabase.from('activity_logs').insert({
    user_id: userId,
    event: 'project_updated',
    description: `Updated repository to ${newRepoUrl}`,
    project_id: project.id,
    metadata: { old_repo: project.github_repo_url, new_repo: newRepoUrl }
  });

  console.log('✅ Activity log created');
  console.log('\n🎉 Repository update complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Navigate to /dashboard/validate-repo');
  console.log('2. Click "Validate Repository"');
  console.log('3. Verify the repository structure');
}

updateRepository();
