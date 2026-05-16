import { GitHubRepoSelector } from "@/components/github/GitHubRepoSelector";

export default function GitHubProjectPage() {
  return (
    <div className="container mx-auto py-8">
      <GitHubRepoSelector />
    </div>
  );
}