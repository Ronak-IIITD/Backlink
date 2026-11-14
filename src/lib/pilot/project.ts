export function publicProject<T extends { cmsWebhookSecret?: string | null }>(project: T) {
  const { cmsWebhookSecret: _secret, ...safe } = project;
  return safe;
}
