import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import type { Auth } from '@kartini/auth';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3010',
  plugins: [inferAdditionalFields<Auth>()],
});

export const { signIn, signOut, useSession } = authClient;
