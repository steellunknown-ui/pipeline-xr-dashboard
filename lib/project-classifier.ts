export type ProjectType =
    | "STATIC_FRONTEND"
    | "FRONTEND_WITH_API"
    | "FULLSTACK"
    | "UNKNOWN";

export interface ProjectClassification {
    type: ProjectType;
    requiresEnv: boolean;
    reason: string;
    detectedFramework?: string;
}

export function classifyProject(input: {
    packageJson: any;
    fileTree: string[];
    lightweightSourceFiles?: { path: string, content: string }[];
}): ProjectClassification {
    const { packageJson, fileTree, lightweightSourceFiles = [] } = input;

    const deps = {
        ...((packageJson || {}).dependencies || {}),
        ...((packageJson || {}).devDependencies || {}),
    };
    const entries = Object.keys(deps);

    // 1. Detect frontend frameworks
    const frontendFrameworks = ["react", "vite", "next", "astro", "nuxt"];
    const detectedFramework = frontendFrameworks.find(fw => entries.some(dep => dep.includes(fw))) || "unknown";

    // 2. Detect backend dependencies
    const backendDeps = ["express", "fastify", "nestjs", "prisma", "mongoose", "pg", "mysql", "redis"];
    const hasBackendDeps = backendDeps.some(bk => entries.some(dep => dep.includes(bk)));

    // 3. Detect backend folders and signals (middleware/route)
    const backendFolders = ["/api", "/server", "/backend", "/functions", "app/api"];
    const hasBackendFolders = fileTree.some(file =>
        backendFolders.some(folder => file.includes(folder + "/") || file === folder.replace("/", ""))
    );

    // Detect Next.js API routes specifically
    const hasNextApiRoutes = fileTree.some(file =>
        file.includes("pages/api/") || file.includes("app/api/") ||
        file.endsWith("middleware.ts") || file.endsWith("middleware.js") ||
        file.endsWith("route.ts") || file.endsWith("route.js")
    );

    // 4. Detect config signals
    const configSignals = [".env.example", "prisma/schema.prisma", "docker-compose.yml"];
    const hasConfigSignals = fileTree.some(file =>
        configSignals.some(sig => file.includes(sig))
    );

    // 5. Lightweight ENV scan
    const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    let hasEnvUsage = false;
    let scannedSize = 0;
    for (const file of lightweightSourceFiles) {
        if (!validExtensions.some(ext => file.path.endsWith(ext))) continue;
        if (scannedSize > 2 * 1024 * 1024) break; // max 2MB
        scannedSize += file.content.length;
        if (file.content.includes("process.env") || file.content.includes("import.meta.env")) {
            hasEnvUsage = true;
            break;
        }
    }

    // Classification logic
    let type: ProjectType = "UNKNOWN";
    let requiresEnv = false;
    let reason = "Unable to determine project type securely.";

    if (hasBackendDeps || (hasBackendFolders && !hasNextApiRoutes) || hasConfigSignals) {
        type = "FULLSTACK";
        requiresEnv = true;
        reason = "Backend services or databases detected.";
    } else if (detectedFramework === "next" && hasNextApiRoutes) {
        type = "FRONTEND_WITH_API";
        requiresEnv = true; // Next.js API project -> ENV required
        reason = "Next.js with custom API routes detected.";
    } else if (detectedFramework !== "unknown" && !hasBackendDeps && !hasBackendFolders) {
        type = "STATIC_FRONTEND";
        requiresEnv = hasEnvUsage;
        reason = hasEnvUsage
            ? "Static frontend but environment variables were explicitly found in source."
            : "Static frontend project with no backend dependencies.";
    } else {
        // If unknown, we still consider if env variables were used
        requiresEnv = hasEnvUsage;
        if (hasEnvUsage) {
            reason = "Unknown project structure but environment variables detected in source code.";
        }
    }

    // Final override if explicit signals were found
    if (hasConfigSignals) {
        requiresEnv = true;
        reason = "Explicit environment config files (.env.example or schema) detected.";
    }

    return {
        type,
        requiresEnv,
        reason,
        detectedFramework: detectedFramework !== "unknown" ? detectedFramework : undefined
    };
}
