"use client";

import { useState } from "react";
import { verifyGithubAccess } from "@/app/dashboard/actions/projects";

export default function GitHubTestPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkGitHub = async () => {
    setLoading(true);
    const result = await verifyGithubAccess();
    setStatus(result);
    setLoading(false);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">GitHub OAuth Test</h1>
      
      <button 
        onClick={checkGitHub}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        {loading ? "Checking..." : "Check GitHub Access"}
      </button>

      {status && (
        <div className="mt-4 p-4 border rounded">
          <p><strong>Success:</strong> {status.success ? "✅" : "❌"}</p>
          <p><strong>Has Token:</strong> {status.hasToken ? "✅ TRUE" : "❌ FALSE"}</p>
          <p><strong>Message:</strong> {status.message || status.error}</p>
        </div>
      )}
    </div>
  );
}