import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { Octokit } from "@octokit/rest";
import crypto from "crypto";

/**
 * Webhook Management API
 * 
 * POST - Create GitHub webhook programmatically
 * DELETE - Remove GitHub webhook
 * GET - Get webhook status
 */

/**
 * POST /api/projects/[id]/webhooks
 * Creates a GitHub webhook for auto-deployment
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const supabase = await createClient();

        // Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({
                success: false,
                error: "Unauthorized"
            }, { status: 401 });
        }

        // Get project and verify ownership
        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("*")
            .eq("id", projectId)
            .eq("user_id", user.id)
            .single();

        if (projectError || !project) {
            return NextResponse.json({
                success: false,
                error: "Project not found"
            }, { status: 404 });
        }

        // Check if webhook already exists
        if (project.github_webhook_id) {
            return NextResponse.json({
                success: false,
                error: "Webhook already exists. Delete it first to create a new one."
            }, { status: 400 });
        }

        // Check if user has GitHub identity
        const hasGitHubIdentity = user.identities?.some(identity => identity.provider === 'github');
        if (!hasGitHubIdentity) {
            return NextResponse.json({
                success: false,
                error: "To connect GitHub, please sign up or log in using a GitHub account.",
                signup_url: 'https://github.com/signup',
                needsReauth: true
            }, { status: 401 });
        }

        // Get GitHub access token from session
        const { data: { session } } = await supabase.auth.getSession();
        const githubToken = session?.provider_token;

        if (!githubToken) {
            return NextResponse.json({
                success: false,
                error: "GitHub token not found. Please reconnect your GitHub account.",
                needsReauth: true
            }, { status: 401 });
        }

        // Extract repo owner and name from GitHub URL
        const repoMatch = project.github_repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!repoMatch) {
            return NextResponse.json({
                success: false,
                error: "Invalid GitHub repository URL"
            }, { status: 400 });
        }

        const [, owner, repo] = repoMatch;
        const repoName = repo.replace(/\.git$/, ""); // Remove .git suffix if present

        // Generate webhook secret if not exists
        let webhookSecret = project.webhook_secret;
        if (!webhookSecret) {
            webhookSecret = crypto.randomBytes(32).toString("hex");
        }

        // Create webhook using Octokit
        const octokit = new Octokit({ auth: githubToken });

        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://api.pipelinexr.app'}/api/github/webhook`;

        try {
            const { data: webhook } = await octokit.repos.createWebhook({
                owner,
                repo: repoName,
                config: {
                    url: webhookUrl,
                    content_type: "json",
                    secret: webhookSecret,
                    insecure_ssl: "0"
                },
                events: ["push"],
                active: true
            });

            // Update project with webhook details
            const { error: updateError } = await supabase
                .from("projects")
                .update({
                    github_webhook_id: webhook.id,
                    webhook_secret: webhookSecret,
                    webhook_enabled: true,
                    auto_deploy_branch: project.auto_deploy_branch || "main"
                })
                .eq("id", projectId)
                .eq("user_id", user.id);

            if (updateError) {
                // Rollback: delete webhook from GitHub
                try {
                    await octokit.repos.deleteWebhook({
                        owner,
                        repo: repoName,
                        hook_id: webhook.id
                    });
                } catch (rollbackError) {
                    console.error("[Webhook] Rollback failed:", rollbackError);
                }

                return NextResponse.json({
                    success: false,
                    error: "Failed to save webhook configuration"
                }, { status: 500 });
            }

            console.log(`[Webhook] Created: webhook_id=${webhook.id} project=${projectId} repo=${owner}/${repoName}`);

            return NextResponse.json({
                success: true,
                message: "Webhook created successfully",
                webhook: {
                    id: webhook.id,
                    url: webhookUrl,
                    events: ["push"],
                    active: true
                }
            }, { status: 200 });

        } catch (githubError: any) {
            console.error("[Webhook] GitHub API error:", githubError);

            if (githubError.status === 401 || githubError.status === 403) {
                return NextResponse.json({
                    success: false,
                    error: "GitHub token expired. Please reconnect your GitHub account.",
                    needsReauth: true
                }, { status: 401 });
            }

            if (githubError.status === 404) {
                return NextResponse.json({
                    success: false,
                    error: "Repository not found or you don't have admin access"
                }, { status: 404 });
            }

            return NextResponse.json({
                success: false,
                error: githubError.message || "Failed to create webhook on GitHub"
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("[Webhook] Unexpected error:", error);
        return NextResponse.json({
            success: false,
            error: "Internal server error"
        }, { status: 500 });
    }
}

/**
 * DELETE /api/projects/[id]/webhooks
 * Removes GitHub webhook
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const supabase = await createClient();

        // Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({
                success: false,
                error: "Unauthorized"
            }, { status: 401 });
        }

        // Get project and verify ownership
        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("*")
            .eq("id", projectId)
            .eq("user_id", user.id)
            .single();

        if (projectError || !project) {
            return NextResponse.json({
                success: false,
                error: "Project not found"
            }, { status: 404 });
        }

        // Always allow disabling webhook in database, even if GitHub deletion fails
        let githubDeletionAttempted = false;

        // Only attempt GitHub webhook deletion if we have the necessary info
        if (project.github_webhook_id && project.github_repo_url) {
            // Get GitHub access token
            const { data: { session } } = await supabase.auth.getSession();
            const githubToken = session?.provider_token;

            if (githubToken) {
                // Extract repo owner and name
                const repoMatch = project.github_repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);

                if (repoMatch) {
                    const [, owner, repo] = repoMatch;
                    const repoName = repo.replace(/\.git$/, "");

                    // Try to delete webhook from GitHub
                    const octokit = new Octokit({ auth: githubToken });

                    try {
                        await octokit.repos.deleteWebhook({
                            owner,
                            repo: repoName,
                            hook_id: project.github_webhook_id
                        });

                        console.log(`[Webhook] Deleted from GitHub: webhook_id=${project.github_webhook_id} project=${projectId}`);
                        githubDeletionAttempted = true;
                    } catch (githubError: any) {
                        // Log but don't fail - we'll still disable in database
                        console.warn(`[Webhook] GitHub deletion failed (continuing anyway):`, githubError.message);
                    }
                } else {
                    console.warn(`[Webhook] Invalid GitHub URL format, skipping GitHub deletion`);
                }
            } else {
                console.warn(`[Webhook] No GitHub token found, skipping GitHub deletion`);
            }
        }

        // Update project to remove webhook info (always execute this)
        const { error: updateError } = await supabase
            .from("projects")
            .update({
                github_webhook_id: null,
                webhook_enabled: false
            })
            .eq("id", projectId)
            .eq("user_id", user.id);

        if (updateError) {
            console.error(`[Webhook] Database update failed:`, updateError);
            return NextResponse.json({
                success: false,
                error: "Failed to update project configuration"
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: githubDeletionAttempted
                ? "Webhook deleted successfully"
                : "Auto-deploy disabled (GitHub webhook may still exist)"
        }, { status: 200 });

    } catch (error: any) {
        console.error("[Webhook] Unexpected error:", error);
        return NextResponse.json({
            success: false,
            error: "Internal server error"
        }, { status: 500 });
    }
}

/**
 * GET /api/projects/[id]/webhooks
 * Get webhook status and configuration
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const supabase = await createClient();

        // Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({
                success: false,
                error: "Unauthorized"
            }, { status: 401 });
        }

        // Get project
        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("github_webhook_id, webhook_enabled, auto_deploy_branch, github_repo_url")
            .eq("id", projectId)
            .eq("user_id", user.id)
            .single();

        if (projectError || !project) {
            return NextResponse.json({
                success: false,
                error: "Project not found"
            }, { status: 404 });
        }

        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://api.pipelinexr.app'}/api/github/webhook`;

        return NextResponse.json({
            success: true,
            webhook: {
                enabled: project.webhook_enabled,
                webhook_id: project.github_webhook_id,
                webhook_url: webhookUrl,
                auto_deploy_branch: project.auto_deploy_branch,
                configured: !!project.github_webhook_id
            }
        }, { status: 200 });

    } catch (error: any) {
        console.error("[Webhook] Unexpected error:", error);
        return NextResponse.json({
            success: false,
            error: "Internal server error"
        }, { status: 500 });
    }
}
