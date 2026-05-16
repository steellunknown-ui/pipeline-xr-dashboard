/**
 * PRIORITY 10.2: Build Runner - Build Orchestration
 *
 * Orchestrates the complete build process:
 * 1. Fetch deployment info
 * 2. Update status to building
 * 3. Clone repo or extract ZIP
 * 4. Run npm install
 * 5. Run npm run build
 * 6. Update final status
 * 7. Clean up
 *
 * NO in-memory state. All locking is done via database.
 */

import {
    DeploymentLogger,
    updateDeploymentStatus,
    fetchDeployment,
} from "./logger";
import { cloneRepository, prepareWorkDir, cleanupWorkDir } from "./repo";
import { runNpmInstall, runNpmBuild, checkPackageJson } from "./commands";
import { detectBuildOutput, copyBuildOutput, getDeploymentUrl } from "./output";

/**
 * Build result
 */
export interface BuildResult {
    success: boolean;
    deploymentId: string;
    error?: string;
    duration?: number;
}

/**
 * Execute a build for a deployment.
 * This is the main build logic - no locking here, locking is done in index.ts.
 *
 * @param deploymentId - The deployment to build
 * @returns Promise resolving to build result
 */
export async function executeBuild(deploymentId: string): Promise<BuildResult> {
    const startTime = Date.now();
    let logger: DeploymentLogger | null = null;
    let workDir: string | null = null;

    try {
        // Step 1: Fetch deployment info
        const deployment = await fetchDeployment(deploymentId);

        if (!deployment) {
            console.error(`[runner] Deployment not found: ${deploymentId}`);
            return {
                success: false,
                deploymentId,
                error: "Deployment not found",
            };
        }

        // PRIORITY 10.7: Only build pending deployments (immutability guard)
        if (deployment.status !== "pending") {
            console.error(`[runner] Refusing to build: status is ${deployment.status}, expected pending`);
            return {
                success: false,
                deploymentId,
                error: `Deployment is not in pending state (current: ${deployment.status})`,
            };
        }

        // Initialize logger
        logger = new DeploymentLogger(deploymentId, deployment.user_id);
        logger.info("Build started");
        logger.info(`Project: ${deployment.projects.name}`);
        logger.info(`Source: ${deployment.source}`);
        logger.info(`Branch: ${deployment.branch}`);

        // Step 2: Update status to building
        await updateDeploymentStatus(deploymentId, "building", {
            started_at: new Date().toISOString(),
        });

        // Step 3: Prepare work directory
        logger.info("Preparing build environment...");
        workDir = await prepareWorkDir(deploymentId);
        logger.info(`Work directory: ${workDir}`);

        // Step 4: Clone repo or extract ZIP
        let projectDir: string;

        if (deployment.source === "github") {
            const repoUrl = deployment.projects.github_repo_url;

            if (!repoUrl) {
                throw new Error("No GitHub repository URL configured");
            }

            const cloneResult = await cloneRepository(
                repoUrl,
                deployment.branch,
                deployment.commit_sha,
                workDir,
                logger
            );

            if (!cloneResult.success) {
                throw new Error(cloneResult.error || "Failed to clone repository");
            }

            projectDir = cloneResult.workDir;
        } else if (deployment.source === "zip") {
            logger.error(
                "ZIP deployment source requires ZIP file path - not implemented yet"
            );
            throw new Error("ZIP deployment requires ZIP file storage implementation");
        } else {
            throw new Error(`Unsupported deployment source: ${deployment.source}`);
        }

        // Step 5: Check for package.json
        logger.info("Checking project configuration...");
        const pkgInfo = await checkPackageJson(projectDir);

        if (!pkgInfo.exists) {
            throw new Error("No package.json found in project root");
        }

        logger.info(`Found package.json`);

        // Step 6: Run npm install
        logger.info("Installing dependencies...");
        const installResult = await runNpmInstall({
            cwd: projectDir,
            logger,
            timeoutMs: 300000, // 5 minutes for install
        });

        if (!installResult.success) {
            throw new Error(installResult.error || "npm install failed");
        }

        // Step 7: Run npm run build (if build script exists)
        if (pkgInfo.hasBuildScript) {
            logger.info("Building project...");
            const buildResult = await runNpmBuild({
                cwd: projectDir,
                logger,
                timeoutMs: 300000, // 5 minutes for build
            });

            if (!buildResult.success) {
                throw new Error(buildResult.error || "npm run build failed");
            }
        } else {
            logger.warn("No build script found in package.json - skipping build step");
        }

        // Step 8: Detect and copy build output
        logger.info("Detecting build output...");
        const outputDir = await detectBuildOutput(projectDir, logger);

        if (!outputDir) {
            throw new Error("No build output found (checked: out/, dist/, build/, .next/static/)");
        }

        // Step 9: Copy to deployment storage
        await copyBuildOutput(outputDir, deploymentId, logger);

        // Get deployment URL
        const deploymentUrl = getDeploymentUrl(deploymentId);
        logger.success(`Deployment live at: ${deploymentUrl}`);

        // Step 10: Build successful
        const duration = Date.now() - startTime;
        logger.success(`Build completed successfully in ${Math.round(duration / 1000)}s`);

        // Finalize logs before updating status
        await logger.finalize();

        // Update status to success with deployment URL
        await updateDeploymentStatus(deploymentId, "success", {
            completed_at: new Date().toISOString(),
            deployment_url: deploymentUrl,
        });

        // Clean up work directory
        if (workDir) {
            await cleanupWorkDir(workDir, logger);
        }

        return {
            success: true,
            deploymentId,
            duration,
        };
    } catch (err: any) {
        // Build failed
        const duration = Date.now() - startTime;
        const errorMessage = err.message || "Unknown error";

        console.error(`[runner] Build failed: ${errorMessage}`);

        if (logger) {
            logger.error(`Build failed: ${errorMessage}`);
            await logger.finalize();
        }

        // Update status to failed
        await updateDeploymentStatus(deploymentId, "failed", {
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
        });

        // Clean up work directory
        if (workDir) {
            try {
                const { cleanupWorkDir: cleanup } = await import("./repo");
                if (logger) {
                    await cleanup(workDir, logger);
                }
            } catch {
                // Ignore cleanup errors
            }
        }

        return {
            success: false,
            deploymentId,
            error: errorMessage,
            duration,
        };
    }
}
