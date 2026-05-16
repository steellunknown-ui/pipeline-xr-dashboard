/**
 * PRIORITY 10.1: Build Runner - Commands
 * 
 * Executes npm install and npm run build using child_process.spawn.
 * Captures stdout and stderr line by line in real-time.
 */

import { spawn, ChildProcess } from "child_process";
import { DeploymentLogger } from "./logger";

/**
 * Result of a command execution
 */
export interface CommandResult {
    success: boolean;
    exitCode: number | null;
    signal: string | null;
    error?: string;
}

/**
 * Options for running a command
 */
export interface CommandOptions {
    cwd: string;
    logger: DeploymentLogger;
    timeoutMs?: number;
    env?: Record<string, string>;
}

/**
 * Run a shell command and stream output to the logger.
 * 
 * @param command - The command to run (e.g., 'npm')
 * @param args - Command arguments (e.g., ['install'])
 * @param options - Execution options
 * @returns Promise resolving to command result
 */
export async function runCommand(
    command: string,
    args: string[],
    options: CommandOptions
): Promise<CommandResult> {
    const { cwd, logger, timeoutMs = 600000, env } = options;

    return new Promise((resolve) => {
        let child: ChildProcess;
        let killed = false;
        let timeoutHandle: NodeJS.Timeout | null = null;

        try {
            // Log command start
            logger.info(`$ ${command} ${args.join(" ")}`);

            // Merge environment variables
            const processEnv = {
                ...process.env,
                ...env,
                // Force color output for npm
                FORCE_COLOR: "1",
                npm_config_color: "always",
            };

            // Spawn the process
            child = spawn(command, args, {
                cwd,
                env: processEnv,
                shell: process.platform === "win32", // Use shell on Windows
                stdio: ["ignore", "pipe", "pipe"],
            });

            // Set timeout
            timeoutHandle = setTimeout(() => {
                if (!killed) {
                    killed = true;
                    logger.error(`Command timed out after ${timeoutMs / 1000} seconds`);
                    child.kill("SIGTERM");

                    // Force kill after 5 seconds if still running
                    setTimeout(() => {
                        if (!child.killed) {
                            child.kill("SIGKILL");
                        }
                    }, 5000);
                }
            }, timeoutMs);

            // Buffer for incomplete lines
            let stdoutBuffer = "";
            let stderrBuffer = "";

            // Process stdout line by line
            if (child.stdout) {
                child.stdout.on("data", (data: Buffer) => {
                    stdoutBuffer += data.toString();
                    const lines = stdoutBuffer.split("\n");
                    stdoutBuffer = lines.pop() || "";

                    for (const line of lines) {
                        if (line.trim()) {
                            logger.info(line);
                        }
                    }
                });
            }

            // Process stderr line by line
            if (child.stderr) {
                child.stderr.on("data", (data: Buffer) => {
                    stderrBuffer += data.toString();
                    const lines = stderrBuffer.split("\n");
                    stderrBuffer = lines.pop() || "";

                    for (const line of lines) {
                        if (line.trim()) {
                            // npm often writes progress to stderr, not all are errors
                            if (isActualError(line)) {
                                logger.error(line);
                            } else {
                                logger.warn(line);
                            }
                        }
                    }
                });
            }

            // Handle process exit
            child.on("close", (code, signal) => {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }

                // Flush remaining buffer content
                if (stdoutBuffer.trim()) {
                    logger.info(stdoutBuffer);
                }
                if (stderrBuffer.trim()) {
                    logger.warn(stderrBuffer);
                }

                if (killed) {
                    resolve({
                        success: false,
                        exitCode: code,
                        signal: signal || "SIGTERM",
                        error: "Command timed out",
                    });
                } else if (code === 0) {
                    logger.success(`Command completed successfully`);
                    resolve({
                        success: true,
                        exitCode: 0,
                        signal: null,
                    });
                } else {
                    logger.error(`Command failed with exit code ${code}`);
                    resolve({
                        success: false,
                        exitCode: code,
                        signal,
                        error: `Exit code ${code}`,
                    });
                }
            });

            // Handle spawn errors
            child.on("error", (err) => {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }

                logger.error(`Failed to execute command: ${err.message}`);
                resolve({
                    success: false,
                    exitCode: null,
                    signal: null,
                    error: err.message,
                });
            });
        } catch (err: any) {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }

            logger.error(`Exception running command: ${err.message}`);
            resolve({
                success: false,
                exitCode: null,
                signal: null,
                error: err.message,
            });
        }
    });
}

/**
 * Check if a stderr line is an actual error vs npm noise
 */
function isActualError(line: string): boolean {
    const errorPatterns = [
        /^error/i,
        /^ERR!/,
        /npm ERR!/,
        /TypeError/,
        /ReferenceError/,
        /SyntaxError/,
        /ENOENT/,
        /EACCES/,
        /Cannot find module/,
        /Module not found/,
        /Failed to compile/,
        /Build failed/,
    ];

    return errorPatterns.some((pattern) => pattern.test(line));
}

/**
 * Run npm install in the specified directory
 */
export async function runNpmInstall(options: CommandOptions): Promise<CommandResult> {
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    return runCommand(npmCmd, ["install"], options);
}

/**
 * Run npm run build in the specified directory
 */
export async function runNpmBuild(options: CommandOptions): Promise<CommandResult> {
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    return runCommand(npmCmd, ["run", "build"], options);
}

/**
 * Check if package.json exists and has a build script
 */
export async function checkPackageJson(cwd: string): Promise<{
    exists: boolean;
    hasBuildScript: boolean;
    buildScript?: string;
}> {
    const path = await import("path");
    const fs = await import("fs/promises");

    const packagePath = path.join(cwd, "package.json");

    try {
        const content = await fs.readFile(packagePath, "utf-8");
        const pkg = JSON.parse(content);

        const buildScript = pkg.scripts?.build;

        return {
            exists: true,
            hasBuildScript: !!buildScript,
            buildScript,
        };
    } catch {
        return {
            exists: false,
            hasBuildScript: false,
        };
    }
}
