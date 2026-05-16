export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

export function generateDeploymentUrl(slug: string): string {
  return `https://${slug}.pipelinexr.app`;
}