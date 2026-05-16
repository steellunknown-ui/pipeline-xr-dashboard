/**
 * PRIORITY 10.3: Build Output Operations
 *
 * Handles detecting build output folders and copying to deployment storage.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { DeploymentLogger } from "./logger";

/**
 * Output folder detection priority
 */
const OUTPUT_FOLDERS = ["out", "dist", "build", ".next/static"];

/**
 * Base directory for storing deployment outputs
 */
const DEPLOYMENTS_DIR = ".xr-deployments";

/**
 * Detect build output folder in project directory.
 * Checks in priority order: out/, dist/, build/
 *
 * @param projectDir - The project directory after build
 * @returns Path to output folder or null if none found
 */
export async function detectBuildOutput(
    projectDir: string,
    logger: DeploymentLogger
): Promise<string | null> {
    for (const folder of OUTPUT_FOLDERS) {
        const outputPath = path.join(projectDir, folder);

        try {
            const stat = await fs.stat(outputPath);
            if (stat.isDirectory()) {
                logger.info(`Detected build output: ${folder}/`);
                return outputPath;
            }
        } catch {
            // Folder doesn't exist, try next
        }
    }

    return null;
}

/**
 * Copy build output to deployment storage.
 *
 * @param sourceDir - Source directory (e.g., out/)
 * @param deploymentId - Deployment ID
 * @param logger - Logger for output
 * @returns Path to copied output
 */
export async function copyBuildOutput(
    sourceDir: string,
    deploymentId: string,
    logger: DeploymentLogger
): Promise<string> {
    // Get project root - .xr-deployments should be at project root
    const projectRoot = process.cwd();
    const deploymentsDir = path.join(projectRoot, DEPLOYMENTS_DIR);
    const targetDir = path.join(deploymentsDir, `deployment-${deploymentId}`);

    logger.info(`Copying build output to: ${targetDir}`);

    // Ensure base deployments directory exists
    await fs.mkdir(deploymentsDir, { recursive: true });

    // Clean target directory if exists
    try {
        await fs.rm(targetDir, { recursive: true, force: true });
    } catch {
        // Ignore if doesn't exist
    }

    // Create target directory
    await fs.mkdir(targetDir, { recursive: true });

    // Copy files recursively
    await fs.cp(sourceDir, targetDir, { recursive: true });

    // Count files copied
    const files = await countFiles(targetDir);
    logger.success(`Copied ${files} files to deployment storage`);

    return targetDir;
}

/**
 * Count files in a directory recursively
 */
async function countFiles(dir: string): Promise<number> {
    let count = 0;

    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                count += await countFiles(path.join(dir, entry.name));
            } else {
                count++;
            }
        }
    } catch {
        // Ignore errors
    }

    return count;
}

/**
 * Get the deployment URL for a deployment.
 *
 * @param deploymentId - Deployment ID
 * @returns Full URL to access the deployment
 */
export function getDeploymentUrl(deploymentId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return `${baseUrl}/api/deployments/${deploymentId}/static`;
}

/**
 * Get the storage path for a deployment.
 *
 * @param deploymentId - Deployment ID
 * @returns Path to deployment storage
 */
export function getDeploymentStoragePath(deploymentId: string): string {
    return path.join(process.cwd(), DEPLOYMENTS_DIR, `deployment-${deploymentId}`);
}
