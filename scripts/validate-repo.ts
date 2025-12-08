const repoUrl = 'https://github.com/steellunknown-ui/pipeline-xr-dashboard';

async function validateRepo() {
  console.log('🔍 Validating repository structure...\n');
  
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    console.error('❌ Invalid GitHub URL');
    return;
  }
  const [, owner, repo] = match;
  const repoName = repo.replace(/\.git$/, '');
  
  console.log(`📦 Repository: ${owner}/${repoName}`);
  console.log(`🔗 URL: ${repoUrl}\n`);
  
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents`);
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch repository: ${response.status}`);
      console.log('\n⚠️  You may need to authenticate with GitHub in the app');
      return;
    }
    
    const contents = await response.json();
    const files = contents.map((item: any) => item.name);
    
    console.log('📁 Root files/folders found:');
    files.forEach((file: string) => console.log(`   - ${file}`));
    
    console.log('\n✅ Validation checks:');
    console.log(`   ${files.includes('app') ? '✓' : '✗'} app/ folder`);
    console.log(`   ${files.includes('components') ? '✓' : '✗'} components/ folder`);
    console.log(`   ${files.includes('package.json') ? '✓' : '✗'} package.json`);
    console.log(`   ${files.includes('next.config.js') || files.includes('next.config.ts') || files.includes('next.config.mjs') ? '✓' : '✗'} next.config`);
    console.log(`   ${files.includes('tsconfig.json') ? '✓' : '✗'} tsconfig.json`);
    
    const isValid = files.includes('app') && files.includes('package.json');
    
    if (isValid) {
      console.log('\n🎉 Repository is a valid Next.js project!');
    } else {
      console.log('\n⚠️  Repository may not contain a complete Next.js project');
    }
    
  } catch (error) {
    console.error('❌ Error validating repository:', error);
  }
}

validateRepo();
