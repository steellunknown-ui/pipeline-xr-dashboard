import { Octokit } from "@octokit/rest";

export interface RepoAnalysis {
  defaultBranch: string;
  framework: string | null;
  isValid: boolean;
  errors: string[];
  packageJson?: any;
}

export class GitHubAnalyzer {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN,
    });
  }

  async analyzeRepository(repoUrl: string): Promise<RepoAnalysis> {
    try {
      const { owner, repo } = this.parseRepoUrl(repoUrl);
      
      // Get repository info
      const repoResponse = await this.octokit.repos.get({
        owner,
        repo,
      }).catch(error => {
        throw new Error(`Repository not found or access denied: ${owner}/${repo}`);
      });

      const defaultBranch = repoResponse.data.default_branch;
      
      // Get package.json
      let packageJson = null;
      let framework = null;
      const errors: string[] = [];

      try {
        const packageResponse = await this.octokit.repos.getContent({
          owner,
          repo,
          path: "package.json",
          ref: defaultBranch,
        });

        if ("content" in packageResponse.data) {
          const content = Buffer.from(packageResponse.data.content, "base64").toString();
          try {
            packageJson = JSON.parse(content);
            framework = this.detectFramework(packageJson);
          } catch (parseError) {
            errors.push("Invalid package.json format");
          }
        }
      } catch (error: any) {
        if (error.status === 404) {
          errors.push("package.json not found");
        } else {
          errors.push(`Cannot access package.json: ${error.message}`);
        }
      }

      // Validate build script
      if (packageJson && !packageJson.scripts?.build) {
        errors.push("No build script found in package.json");
      }

      return {
        defaultBranch,
        framework,
        isValid: errors.length === 0,
        errors,
        packageJson,
      };
    } catch (error: any) {
      return {
        defaultBranch: "main",
        framework: null,
        isValid: false,
        errors: [`Repository analysis failed: ${error.message}`],
      };
    }
  }

  private parseRepoUrl(url: string): { owner: string; repo: string } {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/)?$/);
    if (!match) {
      throw new Error("Invalid GitHub repository URL");
    }
    return { owner: match[1], repo: match[2] };
  }

  private detectFramework(packageJson: any): string | null {
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (dependencies.next) return "Next.js";
    if (dependencies.react && dependencies["react-scripts"]) return "Create React App";
    if (dependencies.react) return "React";
    if (dependencies.express) return "Express";
    if (dependencies.fastify) return "Fastify";
    if (packageJson.scripts?.dev?.includes("vite")) return "Vite";
    
    return "Node.js";
  }
}