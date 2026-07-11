import { google } from "googleapis";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

// GA4/Meta/Google Ads will reuse this OAuth client with different scopes later;
// Search Console is the first connector (see gscConnection.service.ts).
const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

function assertConfigured() {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET || !env.GOOGLE_OAUTH_REDIRECT_URI) {
    throw new HttpError(
      501,
      "Google OAuth is not configured (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI)",
      "GOOGLE_OAUTH_NOT_CONFIGURED"
    );
  }
}

export function createOAuthClient() {
  assertConfigured();
  return new google.auth.OAuth2(env.GOOGLE_OAUTH_CLIENT_ID, env.GOOGLE_OAUTH_CLIENT_SECRET, env.GOOGLE_OAUTH_REDIRECT_URI);
}

// `state` carries the clientId (and a CSRF nonce) through the redirect round-trip —
// Google echoes it back unmodified on the callback.
export function buildConsentUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // force refresh_token on repeat connections too
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new HttpError(
      422,
      "Google did not return a refresh token. Revoke the app's access at myaccount.google.com/permissions and reconnect to force a fresh consent.",
      "NO_REFRESH_TOKEN"
    );
  }
  return tokens;
}

export async function refreshAccessToken(refreshToken: string) {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  try {
    const { credentials } = await client.refreshAccessToken();
    return credentials;
  } catch (error) {
    // Check if the error is invalid_grant (revoked token, etc.)
    const isInvalidGrant = 
      (error as any)?.response?.data?.error === "invalid_grant" ||
      (error as any)?.message?.includes("invalid_grant");
    
    if (isInvalidGrant) {
      throw new HttpError(401, "Google OAuth token is invalid or revoked", "GSC_TOKEN_REVOKED");
    }
    throw error;
  }
}
