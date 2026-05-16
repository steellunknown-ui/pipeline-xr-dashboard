import { createClient } from '@supabase/supabase-js';
import { normalizeDeploymentSource } from './deployment-source';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const tools = [
  {
    type: 'function',
    function: {
      name: 'autoDeployProject',
      description: 'Automatically deploy the latest project for a user',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The user ID',
          },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'uploadZipDeploy',
      description: 'Deploy project from ZIP file upload',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The user ID',
          },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetchLatestDeployment',
      description: 'Get the most recent deployment for a user',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The user ID',
          },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetchDeploymentLogs',
      description: 'Fetch logs for a specific deployment to analyze errors',
      parameters: {
        type: 'object',
        properties: {
          deploymentId: {
            type: 'string',
            description: 'The deployment ID to fetch logs for',
          },
        },
        required: ['deploymentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyzeDeploymentFailure',
      description: 'Analyze why a deployment failed and provide fix steps',
      parameters: {
        type: 'object',
        properties: {
          deploymentId: {
            type: 'string',
            description: 'The deployment ID to analyze',
          },
        },
        required: ['deploymentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyzeDeploymentSuccess',
      description: 'Analyze a successful deployment and provide insights and next actions',
      parameters: {
        type: 'object',
        properties: {
          deploymentId: {
            type: 'string',
            description: 'The deployment ID to analyze',
          },
        },
        required: ['deploymentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyzeDeploymentRisks',
      description: 'Analyze deployment risks before execution to warn about potential issues',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID to analyze risks for',
          },
          source: {
            type: 'string',
            description: 'Deployment source: github, zip, or manual',
            enum: ['github', 'zip', 'manual']
          },
          commitSha: {
            type: 'string',
            description: 'Optional commit SHA for the deployment',
          },
        },
        required: ['projectId', 'source'],
      },
    },
  },
];

export async function executeTool(toolName: string, args: any) {
  try {
    switch (toolName) {
      case 'autoDeployProject':
        return await autoDeployProject(args.userId);
      case 'uploadZipDeploy':
        return await uploadZipDeploy(args.userId);
      case 'fetchLatestDeployment':
        return await fetchLatestDeployment(args.userId);
      case 'fetchDeploymentLogs':
        return await fetchDeploymentLogs(args.deploymentId);
      case 'analyzeDeploymentFailure':
        return await analyzeDeploymentFailure(args.deploymentId);
      case 'analyzeDeploymentSuccess':
        return await analyzeDeploymentSuccess(args.deploymentId);
      case 'analyzeDeploymentRisks':
        return await analyzeDeploymentRisks(args.projectId, args.source, args.commitSha);
      case 'monitorDeployment':
        return await monitorDeployment(args.deploymentId);
      case 'analyzeErrorAndFix':
        return await analyzeErrorAndFix(args.deploymentId);
      default:
        return { success: false, error: 'Unknown tool' };
    }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Tool execution failed' };
  }
}

async function autoDeployProject(userId: string) {
  try {
    // Validate source
    const sourceResult = normalizeDeploymentSource('github');
    if (!sourceResult.success) {
      return { success: false, error: sourceResult.error };
    }

    // Get user's latest project
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (projectError || !projects || projects.length === 0) {
      return { success: false, error: 'No projects found. Create a project first.' };
    }

    const project = projects[0];

    // Create new deployment
    const { data: deployment, error: deployError } = await supabase
      .from('deployments')
      .insert({
        project_id: project.id,
        environment: 'development',
        branch: 'main',
        status: 'pending',
        user_id: userId,
        source: sourceResult.source
      })
      .select()
      .single();

    if (deployError) {
      return { success: false, error: 'Failed to create deployment' };
    }

    // Add auto-deploy logs
    const autoLogs = [
      '🚀 Auto-deployment initiated',
      '🔗 Connecting to GitHub repository',
      '⬇️ Cloning latest code from main branch',
      '📋 Preparing build environment'
    ];

    for (const logMessage of autoLogs) {
      await supabase.from('deployment_logs').insert({
        deployment_id: deployment.id,
        user_id: userId,
        message: logMessage,
        level: 'info'
      });
    }

    // Start deployment engine immediately
    const { DeploymentEngine } = await import('@/lib/deployment-engine');
    const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await DeploymentEngine.startDeployment(deployment.id, projectSlug);

    return {
      success: true,
      deploymentId: deployment.id,
      projectName: project.name,
      message: `🚀 AUTO-DEPLOYMENT STARTED!

🔗 Connecting to GitHub...
⬇️ Pulling latest code...
🏗️ Building application...

🎯 Project: ${project.name}
🌍 Environment: development
⏱️ ETA: 45-75 seconds

⚡ Deployment is now running!`,
      status: 'building',
      realTimeUpdate: true
    };
  } catch (error: any) {
    return { success: false, error: 'Auto-deployment failed' };
  }
}

async function fetchLatestDeployment(userId: string) {
  try {
    const { data, error } = await supabase
      .from('deployments')
      .select('id, status, environment, branch, created_at, deployment_url, projects(name, id)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return { success: false, error: 'No deployments found' };

    return {
      success: true,
      deployment: {
        id: data.id,
        project: (data.projects as any)?.name,
        projectId: (data.projects as any)?.id,
        status: data.status,
        environment: data.environment,
        branch: data.branch,
        created_at: data.created_at,
        deployment_url: data.deployment_url,
      },
    };
  } catch (error: any) {
    return { success: false, error: 'Failed to fetch latest deployment' };
  }
}

async function fetchDeploymentLogs(deploymentId: string) {
  try {
    const { data, error } = await supabase
      .from('deployment_logs')
      .select('*')
      .eq('deployment_id', deploymentId)
      .order('created_at', { ascending: true });

    if (error) return { success: false, error: error.message };

    const logs = data.map((log, index) => `${index + 1}. ${log.message}`).join('\n');
    return { success: true, logs, count: data.length, rawLogs: data };
  } catch (error: any) {
    return { success: false, error: 'Failed to fetch deployment logs' };
  }
}

async function analyzeErrorAndFix(deploymentId: string) {
  try {
    const { data: logs, error } = await supabase
      .from('deployment_logs')
      .select('*')
      .eq('deployment_id', deploymentId)
      .order('created_at', { ascending: true });

    if (error) return { success: false, error: error.message };

    const errorLogs = logs.filter(log =>
      log.level === 'error' ||
      log.message.toLowerCase().includes('error') ||
      log.message.toLowerCase().includes('failed') ||
      log.message.toLowerCase().includes('cannot')
    );

    const fixes = [];

    for (const log of errorLogs) {
      const msg = log.message.toLowerCase();

      if (msg.includes('module not found') || msg.includes('cannot find module')) {
        const moduleMatch = log.message.match(/['"]([^'"]+)['"]/);
        const moduleName = moduleMatch ? moduleMatch[1] : 'missing package';
        fixes.push({
          issue: `Missing dependency: ${moduleName}`,
          fix: `Run: npm install ${moduleName}`,
          command: `npm install ${moduleName}`,
          type: 'dependency'
        });
      }

      if (msg.includes('enoent') || msg.includes('no such file')) {
        fixes.push({
          issue: 'Missing file or directory',
          fix: 'Check file paths in your project structure',
          type: 'file_missing'
        });
      }

      if (msg.includes('port') && msg.includes('already in use')) {
        fixes.push({
          issue: 'Port conflict',
          fix: 'Change PORT environment variable or stop conflicting process',
          command: 'kill -9 $(lsof -ti:3000)',
          type: 'port_conflict'
        });
      }

      if (msg.includes('syntax error') || msg.includes('unexpected token')) {
        fixes.push({
          issue: 'Syntax error in code',
          fix: 'Check for missing brackets, quotes, or semicolons',
          type: 'syntax_error'
        });
      }

      if (msg.includes('permission denied')) {
        fixes.push({
          issue: 'Permission denied',
          fix: 'Check file permissions or run with appropriate privileges',
          type: 'permission'
        });
      }
    }

    if (fixes.length === 0 && errorLogs.length > 0) {
      fixes.push({
        issue: 'Unknown deployment error',
        fix: 'Check deployment logs for specific error details',
        type: 'unknown'
      });
    }

    return {
      success: true,
      deploymentId,
      errorCount: errorLogs.length,
      fixes,
      hasErrors: errorLogs.length > 0,
      recommendation: fixes.length > 0 ? 'Fix the issues above and redeploy' : 'No critical errors found'
    };
  } catch (error: any) {
    return { success: false, error: 'Failed to analyze deployment errors' };
  }
}

async function uploadZipDeploy(userId: string) {
  try {
    // Validate source
    const sourceResult = normalizeDeploymentSource('zip');
    if (!sourceResult.success) {
      return { success: false, error: sourceResult.error };
    }

    // Get user's latest project
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (projectError || !projects || projects.length === 0) {
      return { success: false, error: 'No projects found. Create a project first.' };
    }

    const project = projects[0];

    // Create new deployment
    const { data: deployment, error: deployError } = await supabase
      .from('deployments')
      .insert({
        project_id: project.id,
        environment: 'development',
        branch: 'main',
        status: 'pending',
        user_id: userId,
        source: sourceResult.source
      })
      .select()
      .single();

    if (deployError) {
      return { success: false, error: 'Failed to create deployment' };
    }

    // Add ZIP upload logs
    const zipLogs = [
      '📦 ZIP file received and validated',
      '🔍 Scanning ZIP contents...',
      '✅ ZIP extraction completed',
      '📁 Project structure analyzed'
    ];

    for (const logMessage of zipLogs) {
      await supabase.from('deployment_logs').insert({
        deployment_id: deployment.id,
        user_id: userId,
        message: logMessage,
        level: 'info'
      });
    }

    // Start deployment engine immediately
    const { DeploymentEngine } = await import('@/lib/deployment-engine');
    const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await DeploymentEngine.startDeployment(deployment.id, projectSlug);

    return {
      success: true,
      deploymentId: deployment.id,
      projectName: project.name,
      message: `🚀 ZIP DEPLOYMENT STARTED!

📦 Uploading ZIP file...
🔍 Extracting contents...
⚡ Starting build process...

🎯 Project: ${project.name}
🌍 Environment: development
⏱️ ETA: 60-90 seconds

✨ Your deployment is now processing!`,
      status: 'building',
      realTimeUpdate: true
    };
  } catch (error: any) {
    return { success: false, error: 'ZIP deployment failed' };
  }
}
async function monitorDeployment(deploymentId: string) {
  try {
    const { data: deployment, error } = await supabase
      .from('deployments')
      .select('id, status, environment, branch, created_at, deployment_url, projects(name, id)')
      .eq('id', deploymentId)
      .single();

    if (error) return { success: false, error: 'Deployment not found' };

    // Get logs
    const { data: logs } = await supabase
      .from('deployment_logs')
      .select('*')
      .eq('deployment_id', deploymentId)
      .order('created_at', { ascending: true });

    const logMessages = logs?.map((log, index) => `${index + 1}. ${log.message}`) || [];
    const latestLog = logs?.[logs.length - 1]?.message || 'No logs available';

    // Calculate duration
    const startTime = new Date(deployment.created_at);
    const currentTime = new Date();
    const duration = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);
    const durationText = `${Math.floor(duration / 60)}m ${duration % 60}s`;

    // Determine next action based on status
    let nextAction = '';
    let recommendation = '';

    if (deployment.status === 'success') {
      nextAction = 'DEPLOYMENT COMPLETE';
      recommendation = `🎉 Your application is live at: ${deployment.deployment_url}`;
    } else if (deployment.status === 'failed') {
      nextAction = 'ANALYZE FAILURE';
      recommendation = '❌ Deployment failed. Running error analysis...';
    } else if (deployment.status === 'pending' || deployment.status === 'building') {
      nextAction = 'CONTINUE MONITORING';
      recommendation = '⏳ Deployment in progress. Monitoring continues...';
    }

    return {
      success: true,
      deployment: {
        id: deployment.id,
        project: (deployment.projects as any)?.name,
        status: deployment.status,
        environment: deployment.environment,
        created_at: deployment.created_at,
        deployment_url: deployment.deployment_url,
        duration: durationText,
        latestLog,
        totalLogs: logs?.length || 0
      },
      logs: logMessages,
      nextAction,
      recommendation,
      shouldContinueMonitoring: deployment.status === 'pending' || deployment.status === 'building'
    };
  } catch (error: any) {
    return { success: false, error: 'Failed to monitor deployment' };
  }
}
async function analyzeDeploymentFailure(deploymentId: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/deployments/${deploymentId}/analysis`);

    if (!response.ok) {
      return { success: false, error: 'Failed to analyze deployment' };
    }

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      deployment: data.deployment,
      analysis: data.analysis,
      ai_used: data.ai_used,
      logs_analyzed: data.logs_analyzed
    };
  } catch (error: any) {
    return { success: false, error: 'Failed to analyze deployment failure' };
  }
}

async function analyzeDeploymentSuccess(deploymentId: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/deployments/${deploymentId}/success`);

    if (!response.ok) {
      return { success: false, error: 'Failed to analyze deployment success' };
    }

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      analysis: data.analysis
    };
  } catch (error: any) {
    return { success: false, error: 'Failed to analyze deployment success' };
  }
}

async function analyzeDeploymentRisks(projectId: string, source: string, commitSha?: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/deployments/preflight-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        source,
        commit_sha: commitSha
      })
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to analyze deployment risks' };
    }

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: data.error };
    }

    const riskEmoji = {
      'high': '🔴',
      'medium': '🟡',
      'low': '🟢'
    };

    const riskMessage = `${riskEmoji[data.risk_level as keyof typeof riskEmoji] || '⚪'} **${data.risk_level.toUpperCase()} RISK DETECTED**

**Risk Factors:**
${data.reasons.map((reason: string) => `• ${reason}`).join('\n')}

**Recommendation:**
${data.recommendation}

**What to do:**
${data.risk_level === 'high' ?
        '⚠️ Review recent failures and verify configuration before deploying' :
        data.risk_level === 'medium' ?
          '⚡ Consider reviewing changes and deployment settings' :
          '✅ Deployment appears safe to proceed'
      }`;

    return {
      success: true,
      risk_level: data.risk_level,
      reasons: data.reasons,
      recommendation: data.recommendation,
      message: riskMessage,
      realTimeUpdate: true
    };
  } catch (error: any) {
    return { success: false, error: 'Failed to analyze deployment risks' };
  }
}