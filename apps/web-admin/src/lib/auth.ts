'use client';

import { createAuthClient } from 'better-auth/react';
import { AUTH_BASE_URL } from './config';

/**
 * Better Auth client for the admin app (cookie-based staff session).
 * baseURL points at the auth mount: http://localhost:3333/api/v1/auth
 */
export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
});

export const { useSession, signIn, signOut } = authClient;
