import { DeploymentAnalysis } from './failure-analyzer';
import { PatchPlan, safeReadFile } from './patch-engine';

/**
 * Deterministically suggests a fix based on the failure analysis.
 * Returns a PatchPlan with low confidence if no specific fix is found.
 */
export async function suggestFix(
    analysis: DeploymentAnalysis,
    workdir: string
): Promise<PatchPlan> {

    // 1. MODULE_NOT_FOUND
    if (analysis.failure_type === 'BUILD_ERROR' || analysis.failure_type === 'INSTALL_ERROR') {
        const match = analysis.detailed_reason.match(/Can't resolve '([^']+)'/) ||
            analysis.short_reason.match(/Module not found: ([^ ]+)/);

        if (match) {
            const packageName = match[1];
            try {
                const packageJsonContent = await safeReadFile(workdir, 'package.json');
                const pkg = JSON.parse(packageJsonContent);

                if (!pkg.dependencies) pkg.dependencies = {};
                if (pkg.dependencies[packageName]) {
                    // Already exists? weird. Maybe devDependencies?
                    return createNoFixPlan();
                }

                // Add dependency (simple version assumption, or "latest")
                // In a real agent we might npm view, here we put a placeholder or "latest"
                pkg.dependencies[packageName] = "latest";

                return {
                    title: `Add missing dependency: ${packageName}`,
                    summary: `Adding '${packageName}' to package.json dependencies.`,
                    confidence: 0.8,
                    changes: [{
                        filePath: 'package.json',
                        reason: `Fix missing module '${packageName}'`,
                        before: packageJsonContent,
                        after: JSON.stringify(pkg, null, 2)
                    }]
                };
            } catch (e) {
                // package.json missing or invalid
            }
        }
    }

    // 2. ENV_MISSING
    if (analysis.failure_type === 'ENV_ERROR') {
        const match = analysis.detailed_reason.match(/variable '([^']+)'/);
        if (match) {
            const envKey = match[1];
            try {
                const envExamplePath = '.env.example';
                let beforeContent = '';
                try {
                    beforeContent = await safeReadFile(workdir, envExamplePath);
                } catch {
                    // File doesn't exist, created new
                }

                if (!beforeContent.includes(envKey)) {
                    const afterContent = beforeContent
                        ? (beforeContent.endsWith('\n') ? beforeContent : beforeContent + '\n') + `${envKey}=YOUR_VALUE_HERE\n`
                        : `${envKey}=YOUR_VALUE_HERE\n`;

                    return {
                        title: `Document missing env var: ${envKey}`,
                        summary: `Adding '${envKey}' to .env.example.`,
                        confidence: 0.9,
                        changes: [{
                            filePath: envExamplePath,
                            reason: 'Document requirement',
                            before: beforeContent,
                            after: afterContent
                        }]
                    };
                }
            } catch (e) {
                // ignore
            }
        }
    }

    return createNoFixPlan();
}

function createNoFixPlan(): PatchPlan {
    return {
        title: 'No automatic fix available',
        summary: 'Pipeline XR could not deterministically identify a safe code patch.',
        confidence: 0.0,
        changes: []
    };
}
