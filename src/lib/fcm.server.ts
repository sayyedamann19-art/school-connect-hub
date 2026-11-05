// Direct Firebase Cloud Messaging access for hosts (e.g. Cloudflare) without
// Lovable's gateway. Uses the FIREBASE_SERVICE_ACCOUNT server secret only.

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

export function readServiceAccount(): ServiceAccount | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    return sa.client_email && sa.private_key && sa.project_id ? sa : null;
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
}

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cached: { email: string; key: string; token: Promise<string>; expires: number } | undefined;
function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (
    cached &&
    cached.email === sa.client_email &&
    cached.key === sa.private_key &&
    cached.expires > Date.now()
  )
    return cached.token;
  const entry = {
    email: sa.client_email,
    key: sa.private_key,
    token: requestAccessToken(sa),
    expires: Date.now() + 50 * 60_000,
  };
  cached = entry;
  void entry.token.catch(() => {
    if (cached === entry) cached = undefined;
  });
  return entry.token;
}
async function requestAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const unsigned = `${header}.${claims}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token failed [${res.status}]: ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** Send to a device selected by the server after checking current role and preferences. */
export async function sendToDevice(
  sa: ServiceAccount,
  message: { title: string; body: string; updateId: string; token: string; path?: string },
) {
  const accessToken = await getAccessToken(sa);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token: message.token,
        notification: { title: message.title, body: message.body.slice(0, 180) },
        webpush: {
          headers: { Urgency: "high" },
          notification: { icon: "/icon-192.png", tag: message.updateId },
        },
        data: { updateId: message.updateId, path: message.path ?? "/parent/notifications" },
      },
    }),
  });
  if (!res.ok) throw new Error(`FCM send failed [${res.status}]: ${await res.text()}`);
}
