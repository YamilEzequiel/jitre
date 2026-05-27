export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  avatarUrl?: string | null;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member';
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  displayName: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
  workspace: AuthWorkspace;
}

export interface RefreshResponse {
  accessToken: string;
  user: AuthUser;
  workspace: AuthWorkspace | null;
}
