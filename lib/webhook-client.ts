/**
 * Client-side helper functions for webhook management
 */

export interface WebhookResponse {
    success: boolean;
    message?: string;
    error?: string;
    needsReauth?: boolean;
    webhook?: {
        id: number;
        url: string;
        events: string[];
        active: boolean;
        enabled?: boolean;
        webhook_id?: number;
        webhook_url?: string;
        auto_deploy_branch?: string;
        configured?: boolean;
    };
}

/**
 * Create GitHub webhook for a project
 */
export async function createWebhook(projectId: string): Promise<WebhookResponse> {
    try {
        const response = await fetch(`/api/projects/${projectId}/webhooks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Create webhook error:", error);
        return {
            success: false,
            error: "Network error: Failed to create webhook",
        };
    }
}

/**
 * Delete GitHub webhook for a project
 */
export async function deleteWebhook(projectId: string): Promise<WebhookResponse> {
    try {
        const response = await fetch(`/api/projects/${projectId}/webhooks`, {
            method: "DELETE",
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Delete webhook error:", error);
        return {
            success: false,
            error: "Network error: Failed to delete webhook",
        };
    }
}

/**
 * Get webhook status for a project
 */
export async function getWebhookStatus(projectId: string): Promise<WebhookResponse> {
    try {
        const response = await fetch(`/api/projects/${projectId}/webhooks`, {
            method: "GET",
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Get webhook status error:", error);
        return {
            success: false,
            error: "Network error: Failed to get webhook status",
        };
    }
}
