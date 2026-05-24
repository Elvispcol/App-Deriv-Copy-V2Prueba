import crypto from 'crypto';

const DERIV_TOKEN_URL = 'https://auth.deriv.com/oauth2/token';

export interface DerivTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * Exchange authorization code for access token via Deriv OAuth2.
 * Uses PKCE (no client_secret required).
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<DerivTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.DERIV_CLIENT_ID!,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });

  const response = await fetch(DERIV_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return data as DerivTokenResponse;
}

/**
 * Generate a unique session ID.
 */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}
