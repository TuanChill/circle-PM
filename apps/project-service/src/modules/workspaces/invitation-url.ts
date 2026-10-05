export function buildInvitationUrl(
  frontendUrl: string | undefined,
  token: string,
  email: string,
): string | undefined {
  const baseUrl = frontendUrl?.trim().replace(/\/$/, '');
  if (!baseUrl) return undefined;

  const query = new URLSearchParams({ token, email });
  return `${baseUrl}/invite?${query.toString()}`;
}
