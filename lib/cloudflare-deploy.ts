interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  r2BucketName: string;
  workerName: string;
}

export class CloudflareDeployer {
  private config: CloudflareConfig;

  constructor(config: CloudflareConfig) {
    this.config = config;
  }

  async deployProject(projectSlug: string, buildOutput: Buffer): Promise<string> {
    try {
      // 1. Upload to R2
      await this.uploadToR2(projectSlug, buildOutput);

      // 2. Deploy/Update Worker
      await this.deployWorker(projectSlug);

      // 3. Return deployment URL
      return `https://${projectSlug}.pipelinexr.app`;
    } catch (error) {
      throw new Error(`Deployment failed: ${error}`);
    }
  }

  private async uploadToR2(projectSlug: string, buildOutput: Buffer): Promise<void> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/r2/buckets/${this.config.r2BucketName}/objects/${projectSlug}/build.zip`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/zip',
        },
        body: new Uint8Array(buildOutput),
      }
    );

    if (!response.ok) {
      throw new Error(`R2 upload failed: ${response.statusText}`);
    }
  }

  private async deployWorker(projectSlug: string): Promise<void> {
    const workerScript = this.generateWorkerScript(projectSlug);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/workers/scripts/${this.config.workerName}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/javascript',
        },
        body: workerScript,
      }
    );

    if (!response.ok) {
      throw new Error(`Worker deployment failed: ${response.statusText}`);
    }
  }

  private generateWorkerScript(projectSlug: string): string {
    return `
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const hostname = url.hostname
  
  // Extract project slug from subdomain
  const projectSlug = hostname.split('.')[0]
  
  // Serve from R2 bucket
  const r2Url = \`https://r2-bucket-url/\${projectSlug}/build.zip\`
  
  try {
    const response = await fetch(r2Url)
    if (!response.ok) {
      return new Response('Project not found', { status: 404 })
    }
    
    // Serve the built project
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (error) {
    return new Response('Internal Server Error', { status: 500 })
  }
}`;
  }
}

export function createCloudflareDeployer(): CloudflareDeployer {
  return new CloudflareDeployer({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    r2BucketName: process.env.CLOUDFLARE_R2_BUCKET!,
    workerName: process.env.CLOUDFLARE_WORKER_NAME!,
  });
}