/**
 * OAuth 2.0 PKCE helpers for Google Calendar (public client — no client secret).
 * https://developers.google.com/identity/protocols/oauth2/native-app
 */

const CAL_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

/**
 * Trim and strip a trailing slash so the URI matches Google Cloud entries
 * (e.g. .../integrations vs .../integrations/).
 */
export function normalizeOAuthRedirectUri(uri: string): string {
  const t = uri.trim();
  if (!t) return t;
  try {
    const u = new URL(t);
    let path = u.pathname.replace(/\/+$/, "");
    if (!path) path = "/";
    return `${u.origin}${path === "/" ? "" : path}${u.search}`;
  } catch {
    return t.replace(/\/+$/, "") || t;
  }
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest("SHA-256", data);
}

export async function generateGoogleCalendarPkcePair(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const verifier = base64UrlEncode(random.buffer);
  const challenge = base64UrlEncode(await sha256(verifier));
  return { verifier, challenge };
}

export function buildGoogleCalendarAuthUrl(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
): string {
  const redirect = normalizeOAuthRedirectUri(redirectUri);
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirect,
    response_type: "code",
    scope: CAL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
