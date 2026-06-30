import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * PRIORITY 10.3: Static File Serving
 *
 * Serves static files from .xr-deployments/ directory.
 * Route: /api/deployments/[deploymentId]/static/[...path]
 */

const DEPLOYMENTS_DIR = ".xr-deployments";

/**
 * MIME types for common file extensions
 */
const MIME_TYPES: Record<string, string> = {
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".otf": "font/otf",
    ".txt": "text/plain",
    ".xml": "application/xml",
    ".webmanifest": "application/manifest+json",
    ".map": "application/json",
};

/**
 * GET /api/deployments/[deploymentId]/static/[...path]
 *
 * Serves static files from deployment storage.
 * No authentication required.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; path?: string[] }> }
) {
    try {
        const { id: deploymentId, path: pathSegments } = await params;

        // Validate deployment ID format
        if (!/^[0-9a-f-]{36}$/i.test(deploymentId)) {
            return new NextResponse("Invalid deployment ID", { status: 404 });
        }

        // Build file path
        const requestedPath = pathSegments?.join("/") || "index.html";
        const projectRoot = process.cwd();
        const deploymentDir = path.join(
            projectRoot,
            DEPLOYMENTS_DIR,
            `deployment-${deploymentId}`
        );

        // Check if deployment directory exists
        try {
            await fs.access(deploymentDir);
        } catch {
            return new NextResponse("Deployment not found", { status: 404 });
        }

        // Resolve full file path
        let filePath = path.join(deploymentDir, requestedPath);

        // Security: Ensure path doesn't escape deployment directory
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(path.resolve(deploymentDir))) {
            return new NextResponse("Invalid path", { status: 403 });
        }

        // Check if path is a directory, serve index.html
        try {
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
                filePath = path.join(filePath, "index.html");
            }
        } catch {
            // File doesn't exist, will be handled below
        }

        // Try to read the file
        try {
            const fileContent = await fs.readFile(filePath);

            // Determine content type
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || "application/octet-stream";

            return new NextResponse(fileContent, {
                status: 200,
                headers: {
                    "Content-Type": contentType,
                    "Cache-Control": "public, max-age=3600",
                },
            });
        } catch (err: any) {
            // If file not found, try index.html for SPA routing
            if (err.code === "ENOENT") {
                const indexPath = path.join(deploymentDir, "index.html");

                try {
                    const indexContent = await fs.readFile(indexPath);
                    return new NextResponse(indexContent, {
                        status: 200,
                        headers: {
                            "Content-Type": "text/html",
                            "Cache-Control": "public, max-age=3600",
                        },
                    });
                } catch {
                    return new NextResponse("File not found", { status: 404 });
                }
            }

            throw err;
        }
    } catch (error: any) {
        console.error("[static] Error serving file:", error.message);
        return new NextResponse("Internal server error", { status: 500 });
    }
}
