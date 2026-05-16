import { User } from '@supabase/supabase-js';

export function getUserDisplayName(user: User | null): string {
  if (!user) return 'User';

  const metadata = user.user_metadata;

  // Google: use full_name first word
  if (metadata?.full_name) {
    const firstName = metadata.full_name.split(' ')[0];
    return firstName;
  }

  // GitHub: use user_name
  if (metadata?.user_name) {
    return metadata.user_name;
  }

  // Fallback
  return metadata?.name || metadata?.email?.split('@')[0] || 'User';
}

export function getUserAvatar(user: User | null): string | null {
  if (!user) return null;
  return user.user_metadata?.avatar_url || null;
}

export function getAuthProvider(user: User | null): string {
  if (!user) return 'unknown';
  return user.app_metadata?.provider || 'unknown';
}
