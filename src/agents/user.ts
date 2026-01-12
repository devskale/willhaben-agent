import { checkAuth } from "./auth.js";

export interface UserProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  displayName?: string;
  postCode?: string;
  city?: string;
  phoneNumber?: string;
  memberSince?: string; // ISO date string or similar
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const auth = await checkAuth();

  if (!auth.isAuthenticated || !auth.user) {
    return null;
  }

  // Return the data we managed to scrape during auth check
  return {
    id: auth.user.id || "current-user",
    displayName: auth.user.name,
    email: auth.user.email,
    postCode: auth.user.postCode,
    memberSince: auth.user.memberSince,
  };
}
