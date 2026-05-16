import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

interface DeploymentChange {
  type: 'env' | 'code' | 'time' | 'source' | 'branch' | 'framework';
  key?: string;
  from?: string;
  to?: string;
  status?: 'added' | 'removed' | 'changed';
  delta?: string;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ deploymentId: string }> }) {
  try {
    const { deploymentId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 200 });
    }

    // Fetch current deployment
    const { data: currentDeployment, error: currentError } = await supabase
      .from("deployments")
      .select(`
        *,
        projects!inner(user_id, name)
      `)
      .eq("id", deploymentId)
      .eq("projects.user_id", user.id)
      .single();

    if (currentError || !currentDeployment) {
      return NextResponse.json({ success: false, error: "Deployment not found" }, { status: 200 });
    }

    // Fetch previous deployment of the same project
    const { data: previousDeployment, error: previousError } = await supabase
      .from("deployments")
      .select("*")
      .eq("project_id", currentDeployment.project_id)
      .lt("created_at", currentDeployment.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (previousError || !previousDeployment) {
      return NextResponse.json({ 
        success: false, 
        error: "No previous deployment to compare" 
      }, { status: 200 });
    }

    // Fetch environment variables for both deployments
    const { data: currentEnvs } = await supabase
      .from("environment_variables")
      .select("key")
      .eq("project_id", currentDeployment.project_id)
      .lte("created_at", currentDeployment.created_at);

    const { data: previousEnvs } = await supabase
      .from("environment_variables")
      .select("key")
      .eq("project_id", currentDeployment.project_id)
      .lte("created_at", previousDeployment.created_at);

    // Compare deployments
    const changes: DeploymentChange[] = [];
    let confidence = 0.6; // Default for code changes

    // Compare environment variables
    const currentEnvKeys = new Set(currentEnvs?.map(e => e.key) || []);
    const previousEnvKeys = new Set(previousEnvs?.map(e => e.key) || []);

    for (const key of previousEnvKeys) {
      if (!currentEnvKeys.has(key)) {
        changes.push({ type: 'env', key, status: 'removed' });
        confidence = 0.9;
      }
    }

    for (const key of currentEnvKeys) {
      if (!previousEnvKeys.has(key)) {
        changes.push({ type: 'env', key, status: 'added' });
        confidence = 0.9;
      }
    }

    // Compare code changes
    if (currentDeployment.commit_sha !== previousDeployment.commit_sha) {
      changes.push({
        type: 'code',
        from: previousDeployment.commit_sha?.substring(0, 7) || 'unknown',
        to: currentDeployment.commit_sha?.substring(0, 7) || 'unknown'
      });
    }

    // Compare other fields
    if (currentDeployment.source !== previousDeployment.source) {
      changes.push({
        type: 'source',
        from: previousDeployment.source,
        to: currentDeployment.source
      });
    }

    if (currentDeployment.branch !== previousDeployment.branch) {
      changes.push({
        type: 'branch',
        from: previousDeployment.branch,
        to: currentDeployment.branch
      });
    }

    if (currentDeployment.framework !== previousDeployment.framework) {
      changes.push({
        type: 'framework',
        from: previousDeployment.framework,
        to: currentDeployment.framework
      });
    }

    // Compare build duration
    const currentDuration = currentDeployment.completed_at && currentDeployment.started_at
      ? new Date(currentDeployment.completed_at).getTime() - new Date(currentDeployment.started_at).getTime()
      : null;

    const previousDuration = previousDeployment.completed_at && previousDeployment.started_at
      ? new Date(previousDeployment.completed_at).getTime() - new Date(previousDeployment.started_at).getTime()
      : null;

    if (currentDuration && previousDuration) {
      const deltaMs = currentDuration - previousDuration;
      const deltaMinutes = Math.floor(Math.abs(deltaMs) / 60000);
      const deltaSeconds = Math.floor((Math.abs(deltaMs) % 60000) / 1000);
      const sign = deltaMs >= 0 ? '+' : '-';
      
      if (Math.abs(deltaMs) > 30000) { // Only show if difference > 30s
        changes.push({
          type: 'time',
          delta: `${sign}${deltaMinutes}m ${deltaSeconds}s`
        });
        if (confidence < 0.7) confidence = 0.4;
      }
    }

    // Generate summary
    let summary = "";
    if (changes.some(c => c.type === 'env' && c.status === 'removed')) {
      const removedEnvs = changes.filter(c => c.type === 'env' && c.status === 'removed');
      summary = `Deployment ${currentDeployment.status} because ${removedEnvs.map(e => e.key).join(', ')} was removed while the previous deployment had it.`;
    } else if (changes.some(c => c.type === 'env' && c.status === 'added')) {
      const addedEnvs = changes.filter(c => c.type === 'env' && c.status === 'added');
      summary = `Deployment ${currentDeployment.status} with new environment variables: ${addedEnvs.map(e => e.key).join(', ')}.`;
    } else if (changes.some(c => c.type === 'code')) {
      const codeChange = changes.find(c => c.type === 'code');
      summary = `Deployment ${currentDeployment.status} with code changes from ${codeChange?.from} to ${codeChange?.to}.`;
    } else if (changes.length === 0) {
      summary = `No significant changes detected between deployments.`;
      confidence = 0.3;
    } else {
      summary = `Deployment ${currentDeployment.status} with ${changes.length} configuration changes.`;
    }

    return NextResponse.json({
      success: true,
      summary,
      changes,
      confidence,
      current: {
        id: currentDeployment.id,
        status: currentDeployment.status,
        created_at: currentDeployment.created_at
      },
      previous: {
        id: previousDeployment.id,
        status: previousDeployment.status,
        created_at: previousDeployment.created_at
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Deployment comparison error:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to compare deployments" 
    }, { status: 200 });
  }
}