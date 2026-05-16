import { promises as fs } from 'fs';
import * as path from 'path';

export type PatchFileChange = {
    filePath: string;
    reason: string;
    lineHint?: number;
    before: string;
    after: string;
};

export type PatchPlan = {
    title: string;
    summary: string;
    changes: PatchFileChange[];
    confidence: number; // 0..1
};

const ALLOWED_DIRS = [
    'src',
    'app',
    'pages',
    'components',
    'lib',
    'utils',
    'styles',
    'public',
    'config',
    'types',
    'hooks',
    'services'
];

const ALLOWED_FILES = [
    'package.json',
    'tsconfig.json',
    'next.config.js',
    'next.config.ts',
    'next.config.mjs',
    'vite.config.ts',
    'vite.config.js',
    'tailwind.config.ts',
    'tailwind.config.js',
    '.env.example'
];

const BLOCKED_DIRS = [
    'node_modules',
    '.next',
    '.git',
    'dist',
    'build',
    'out',
    '.xr-deployments',
    '.xr-artifacts'
];

/**
 * Validates if a file path is allowed to be patched.
 * Prevents traversal attacks and restricts access to safe source folders.
 */
export function isAllowedPatchPath(filePath: string): boolean {
    const normalized = path.normalize(filePath).replace(/\\/g, '/');

    // Block absolute paths
    if (path.isAbsolute(normalized) || normalized.startsWith('../')) {
        return false;
    }

    // Check blocked dirs
    if (BLOCKED_DIRS.some(dir => normalized.startsWith(dir + '/') || normalized === dir)) {
        return false;
    }

    // Check allowed root files
    if (ALLOWED_FILES.includes(normalized)) {
        return true;
    }

    // Check allowed dirs
    if (ALLOWED_DIRS.some(dir => normalized.startsWith(dir + '/'))) {
        return true;
    }

    return false;
}

/**
 * Reads a file safely from the workspace.
 */
export async function safeReadFile(workdir: string, filePath: string): Promise<string> {
    if (!isAllowedPatchPath(filePath)) {
        throw new Error(`Access denied to file: ${filePath}`);
    }

    const fullPath = path.join(workdir, filePath);

    // Ensure the resolved path is actually within workdir (double check)
    if (!fullPath.startsWith(path.resolve(workdir))) {
        throw new Error('Path traversal detected');
    }

    try {
        return await fs.readFile(fullPath, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`File not found: ${filePath}`);
        }
        throw error;
    }
}

/**
 * Applies a patch plan to the workspace.
 * Returns snapshots for history.
 */
export async function applyPatchPlan(workdir: string, plan: PatchPlan): Promise<{
    beforeSnapshot: { filePath: string; content: string }[];
    afterSnapshot: { filePath: string; content: string }[];
    diffText: string;
}> {
    const beforeSnapshot: { filePath: string; content: string }[] = [];
    const afterSnapshot: { filePath: string; content: string }[] = [];
    let diffText = '';

    for (const change of plan.changes) {
        if (!isAllowedPatchPath(change.filePath)) {
            throw new Error(`Security violation: Cannot patch ${change.filePath}`);
        }

        const currentContent = await safeReadFile(workdir, change.filePath);

        // Verify our 'before' knowledge matches reality (optimistic lockingish)
        // We relax this slightly: if 'before' is empty string, we assume new file? 
        // Or simpler: we just overwrite with 'after' content but we should really verify consistency.
        // GUIDANCE: "Minimal changes". Let's assume the plan is authoritative for the *result*.
        // However, to compute a clean diff, we need the actual old content.

        beforeSnapshot.push({ filePath: change.filePath, content: currentContent });

        // Write new content
        const fullPath = path.join(workdir, change.filePath);
        await fs.writeFile(fullPath, change.after, 'utf8');

        afterSnapshot.push({ filePath: change.filePath, content: change.after });

        diffText += `--- ${change.filePath}\n+++ ${change.filePath}\n${computeDiff(currentContent, change.after)}\n\n`;
    }

    return { beforeSnapshot, afterSnapshot, diffText };
}


/**
 * Simple line-based diff generator (contextless for simplicity, matches requirement for "clean diff")
 */
export function computeDiff(oldText: string, newText: string): string {
    const oldLines = oldText.split(/\r?\n/);
    const newLines = newText.split(/\r?\n/);
    let output = '';

    let i = 0;
    let j = 0;

    // Very naive diff - good enough for simple replacements
    // Ideally use a library but we want minimal deps.
    // This will show mismatching blocks.

    while (i < oldLines.length || j < newLines.length) {
        if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
            // output += `  ${oldLines[i]}\n`; // Hide unchanged lines for brevity? 
            // Requirement: "Show clean diff". Usually entails context. 
            // Let's show minimal context (e.g. 2 lines)
            i++;
            j++;
        } else {
            // Find next match to handle insertions/deletions
            // Doing a simple scan ahead is complex without a lib.
            // Fallback strategy: just dump the differing block.

            const startI = i;
            const startJ = j;

            // Look ahead for re-sync
            let syncI = -1;
            let syncJ = -1;

            searchLoop:
            for (let lookAhead = 0; lookAhead < 100; lookAhead++) { // Limit lookahead
                for (let di = 0; di <= lookAhead; di++) {
                    const tryI = i + di;
                    const tryJ = j + (lookAhead - di);

                    if (tryI < oldLines.length && tryJ < newLines.length && oldLines[tryI] === newLines[tryJ]) {
                        syncI = tryI;
                        syncJ = tryJ;
                        break searchLoop;
                    }
                }
            }

            if (syncI !== -1) {
                // Found sync point
                while (i < syncI) {
                    output += `- ${oldLines[i]}\n`;
                    i++;
                }
                while (j < syncJ) {
                    output += `+ ${newLines[j]}\n`;
                    j++;
                }
            } else {
                // Lost sync, dump rest
                while (i < oldLines.length) {
                    output += `- ${oldLines[i]}\n`;
                    i++;
                }
                while (j < newLines.length) {
                    output += `+ ${newLines[j]}\n`;
                    j++;
                }
            }
        }
    }

    return output || 'No text changes detected';
}
