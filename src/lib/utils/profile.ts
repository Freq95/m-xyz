/**
 * Generate profile URL based on username or ID
 * Prefers username if available, falls back to ID for backward compatibility
 */
export function getProfileUrl(user: { id: string; username?: string | null }): string {
  return user.username ? `/profile/${user.username}` : `/profile/${user.id}`;
}

/**
 * Generate profile URL from username or ID string
 */
export function getProfileUrlFromIdOrUsername(idOrUsername: string): string {
  return `/profile/${idOrUsername}`;
}
