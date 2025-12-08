import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const userId = 'd17bc26a-cd6f-4817-802a-6ae5bf5b676b';
const newWebhookUrl = 'https://dupable-preferredly-giovani.ngrok-free.dev/api/github/webhook';

async function updateWebhookUrl() {
  console.log('🔄 Updating webhook URL...');

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

  const { data: updated, error: updateError } = await supabase
    .from('projects')
    .update({ webhook_url: newWebhookUrl })
    .eq('id', project.id)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Error updating webhook URL:', updateError);
    return;
  }

  console.log(`✅ Webhook URL updated to: ${newWebhookUrl}`);

  await supabase.from('activity_logs').insert({
    user_id: userId,
    event: 'webhook_url_updated',
    description: `Webhook URL updated to ${newWebhookUrl}`,
    project_id: project.id,
    metadata: { webhook_url: newWebhookUrl }
  });

  console.log('✅ Activity log created');
  console.log('\n🎉 Webhook URL update complete!');
}

updateWebhookUrl();
