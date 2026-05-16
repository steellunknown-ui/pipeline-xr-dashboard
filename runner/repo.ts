/**
 * PRIORITY 10.1: Build Runner - Repository Operations
 * 
 * Handles cloning GitHub repositories or extracting ZIP files.
 * All operations use real file system and git commands.
 */

import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { DeploymentLogger } from "./logger";

/**
 * Result of a repository operation
 */
export interface RepoResult {
    success: boolean;
    workDir: string;
    error?: string;
}

/**
 * Clone a GitHub repository to the work directory.
 * 
 * @param repoUrl - Full GitHub repository URL
 * @param branch - Branch to clone
 * @param commitSha - Optional specific commit to checkout
 * @param workDir - Directory to clone into
 * @param logger - Logger for output
 * @returns Promise resolving to result
 */
export async function cloneRepository(
    repoUrl: string,
    branch: string,
    commitSha: string | null,
    workDir: string,
    logger: DeploymentLogger
): Promise<RepoResult> {
    try {
        // Ensure work directory exists
        await fs.mkdir(workDir, { recursive: true });

        logger.info(`Cloning repository: ${repoUrl}`);
        logger.info(`Branch: ${branch}`);

        // Clone with depth 1 for faster clones (unless we need a specific commit)
        const cloneArgs = commitSha
            ? ["clone", "--branch", branch, repoUrl, workDir]
            : ["clone", "--depth", "1", "--branch", branch, repoUrl, workDir];

        const cloneResult = await runGitCommand(cloneArgs, path.dirname(workDir), logger);

        if (!cloneResult.success) {
            return {
                success: false,
                workDir,
                error: cloneResult.error || "Failed to clone repository",
            };
        }

        // If specific commit, checkout that commit
        if (commitSha) {
            logger.info(`Checking out commit: ${commitSha}`);

            const checkoutResult = await runGitCommand(
                ["checkout", commitSha],
                workDir,
                logger
            );

            if (!checkoutResult.success) {
                return {
                    success: false,
                    workDir,
                    error: checkoutResult.error || `Failed to checkout commit ${commitSha}`,
                };
            }
        }

        // Log the current commit
        const headResult = await runGitCommand(
            ["rev-parse", "--short", "HEAD"],
            workDir,
            logger,
            true // silent
        );

        if (headResult.success && headResult.output) {
            logger.success(`Repository cloned at ${headResult.output.trim()}`);
        } else {
            logger.success("Repository cloned successfully");
        }

        return {
            success: true,
            workDir,
        };
    } catch (err: any) {
        logger.error(`Exception cloning repository: ${err.message}`);
        return {
            success: false,
            workDir,
            error: err.message,
        };
    }
}

/**
 * Run a git command and capture output.
 */
async function runGitCommand(
    args: string[],
    cwd: string,
    logger: DeploymentLogger,
    silent = false
): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
        const gitCmd = process.platform === "win32" ? "git" : "git";

        if (!silent) {
            logger.info(`$ git ${args.join(" ")}`);
        }

        const child = spawn(gitCmd, args, {
            cwd,
            shell: process.platform === "win32",
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data: Buffer) => {
            stdout += data.toString();
            if (!silent) {
                const lines = data.toString().split("\n").filter((l) => l.trim());
                for (const line of lines) {
                    logger.info(line);
                }
            }
        });

        child.stderr?.on("data", (data: Buffer) => {
            stderr += data.toString();
            if (!silent) {
                const lines = data.toString().split("\n").filter((l) => l.trim());
                for (const line of lines) {
                    // Git often writes progress to stderr
                    if (line.includes("error") || line.includes("fatal")) {
                        logger.error(line);
                    } else {
                        logger.info(line);
                    }
                }
            }
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve({ success: true, output: stdout });
            } else {
                resolve({
                    success: false,
                    error: stderr || `Git exited with code ${code}`,
                });
            }
        });

        child.on("error", (err) => {
            logger.error(`Git command failed: ${err.message}`);
            resolve({ success: false, error: err.message });
        });
    });
}

/**
 * Extract a ZIP file to the work directory.
 * 
 * @param zipPath - Path to the ZIP file
 * @param workDir - Directory to extract into
 * @param logger - Logger for output
 * @returns Promise resolving to result
 */
export async function extractZip(
    zipPath: string,
    workDir: string,
    logger: DeploymentLogger
): Promise<RepoResult> {
    try {
        logger.info(`Extracting ZIP: ${zipPath}`);

        // Ensure work directory exists
        await fs.mkdir(workDir, { recursive: true });

        // Use built-in unzip or PowerShell on Windows
        if (process.platform === "win32") {
            return await extractZipWindows(zipPath, workDir, logger);
        } else {
            return await extractZipUnix(zipPath, workDir, logger);
        }
    } catch (err: any) {
        logger.error(`Exception extracting ZIP: ${err.message}`);
        return {
            success: false,
            workDir,
            error: err.message,
        };
    }
}

/**
 * Extract ZIP on Windows using PowerShell
 */
async function extractZipWindows(
    zipPath: string,
    workDir: string,
    logger: DeploymentLogger
): Promise<RepoResult> {
    return new Promise((resolve) => {
        const psCommand = `Expand-Archive -Path '${zipPath}' -DestinationPath '${workDir}' -Force`;

        const child = spawn("powershell", ["-Command", psCommand], {
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stderr = "";

        child.stdout?.on("data", (data: Buffer) => {
            const lines = data.toString().split("\n").filter((l) => l.trim());
            for (const line of lines) {
                logger.info(line);
            }
        });

        child.stderr?.on("data", (data: Buffer) => {
            stderr += data.toString();
            const lines = data.toString().split("\n").filter((l) => l.trim());
            for (const line of lines) {
                logger.error(line);
            }
        });

        child.on("close", async (code) => {
            if (code === 0) {
                // Handle nested folder case - ZIP often contains a single root folder
                const normalized = await normalizeExtractedDir(workDir, logger);
                logger.success("ZIP extracted successfully");
                resolve({ success: true, workDir: normalized });
            } else {
                resolve({
                    success: false,
                    workDir,
                    error: stderr || `Extraction failed with code ${code}`,
                });
            }
        });

        child.on("error", (err) => {
            resolve({ success: false, workDir, error: err.message });
        });
    });
}

/**
 * Extract ZIP on Unix using unzip command
 */
async function extractZipUnix(
    zipPath: string,
    workDir: string,
    logger: DeploymentLogger
): Promise<RepoResult> {
    return new Promise((resolve) => {
        const child = spawn("unzip", ["-o", zipPath, "-d", workDir], {
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stderr = "";

        child.stdout?.on("data", (data: Buffer) => {
            const lines = data.toString().split("\n").filter((l) => l.trim());
            for (const line of lines) {
                logger.info(line);
            }
        });

        child.stderr?.on("data", (data: Buffer) => {
            stderr += data.toString();
        });

        child.on("close", async (code) => {
            if (code === 0) {
                const normalized = await normalizeExtractedDir(workDir, logger);
                logger.success("ZIP extracted successfully");
                resolve({ success: true, workDir: normalized });
            } else {
                resolve({
                    success: false,
                    workDir,
                    error: stderr || `Extraction failed with code ${code}`,
                });
            }
        });

        child.on("error", (err) => {
            resolve({ success: false, workDir, error: err.message });
        });
    });
}

/**
 * If ZIP extracts to a single folder, move contents up.
 * Returns the actual project root directory.
 */
async function normalizeExtractedDir(
    workDir: string,
    logger: DeploymentLogger
): Promise<string> {
    try {
        const entries = await fs.readdir(workDir, { withFileTypes: true });

        // If single directory and no files, move contents up
        if (entries.length === 1 && entries[0].isDirectory()) {
            const nestedDir = path.join(workDir, entries[0].name);
            logger.info(`Found nested directory: ${entries[0].name}`);
            return nestedDir;
        }

        return workDir;
    } catch {
        return workDir;
    }
}

/**
 * Clean up work directory after build completes.
 */
export async function cleanupWorkDir(
    workDir: string,
    logger: DeploymentLogger
): Promise<void> {
    try {
        logger.info("Cleaning up work directory...");
        await fs.rm(workDir, { recursive: true, force: true });
        logger.info("Work directory cleaned up");
    } catch (err: any) {
        // Non-fatal - log and continue
        logger.warn(`Failed to clean up work directory: ${err.message}`);
    }
}

/**
 * Prepare a fresh work directory for a build.
 */
export async function prepareWorkDir(deploymentId: string): Promise<string> {
    const os = await import("os");
    const tmpDir = os.tmpdir();
    const workDir = path.join(tmpDir, "pipelinexr", deploymentId);

    // Clean up if exists from previous failed attempt
    try {
        await fs.rm(workDir, { recursive: true, force: true });
    } catch {
        // Ignore
    }

    await fs.mkdir(workDir, { recursive: true });
    return workDir;
}
