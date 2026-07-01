export async function getUserRepos(token: string) {
  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) throw new Error("Failed to fetch user repos");
  return res.json();
}

export async function getRepoDetails(token: string, owner: string, repo: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) throw new Error("Failed to fetch repo details");
  return res.json();
}

export async function getRepoTree(token: string, owner: string, repo: string, ref: string = "HEAD") {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) throw new Error("Failed to fetch repo tree");
  return res.json();
}

export async function getFileContent(token: string, owner: string, repo: string, path: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch file content: ${path} (Status ${res.status}) - ${text}`);
  }
  return res.json();
}

export async function getLatestCommitSha(token: string, owner: string, repo: string, branch: string = "main") {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) throw new Error(`Failed to get ref for branch ${branch}`);
  const data = await res.json();
  return data.object.sha;
}

export async function getCommitDetails(token: string, owner: string, repo: string, commitSha: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) throw new Error("Failed to get commit details");
  return res.json();
}

export async function createBlob(token: string, owner: string, repo: string, content: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: Buffer.from(content).toString("base64"),
      encoding: "base64",
    }),
  });
  if (!res.ok) throw new Error("Failed to create blob");
  const data = await res.json();
  return data.sha;
}

export async function createTree(token: string, owner: string, repo: string, baseTreeSha: string, path: string, blobSha: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [
        {
          path,
          mode: "100644",
          type: "blob",
          sha: blobSha,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error("Failed to create tree");
  const data = await res.json();
  return data.sha;
}

export async function createCommit(token: string, owner: string, repo: string, message: string, treeSha: string, parentSha: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [parentSha],
    }),
  });
  if (!res.ok) throw new Error("Failed to create commit");
  const data = await res.json();
  return data.sha;
}

export async function updateBranchRef(token: string, owner: string, repo: string, branch: string, commitSha: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sha: commitSha,
      force: true, // ensure we update the branch
    }),
  });
  if (!res.ok) throw new Error("Failed to update branch ref");
  return res.json();
}

export async function createBranch(token: string, owner: string, repo: string, branchName: string, commitSha: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: commitSha,
    }),
  });
  if (!res.ok) throw new Error("Failed to create branch");
  return res.json();
}

export async function createPullRequest(token: string, owner: string, repo: string, title: string, body: string, head: string, base: string = "main") {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      body,
      head,
      base,
    }),
  });
  if (!res.ok) throw new Error("Failed to create pull request");
  return res.json();
}
