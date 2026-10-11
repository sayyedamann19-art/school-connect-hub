// Direct Firebase Cloud Messaging access for hosts (e.g. Cloudflare) without
// Lovable's gateway. Uses the FIREBASE_SERVICE_ACCOUNT server secret only.
export const UPDATES_TOPIC = "school-updates";

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

async function getAccessToken(sa: ServiceAccount): Promise<string> {
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
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
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

/** Adds or removes device tokens from the updates topic. */
export async function setTopicMembership(sa: ServiceAccount, tokens: string[], subscribe: boolean) {
  if (tokens.length === 0) return;
  const accessToken = await getAccessToken(sa);
  const res = await fetch(`https://iid.googleapis.com/iid/v1:${subscribe ? "batchAdd" : "batchRemove"}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      access_token_auth: "true",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: `/topics/${UPDATES_TOPIC}`, registration_tokens: tokens.slice(0, 1000) }),
  });
  if (!res.ok) throw new Error(`Topic update failed [${res.status}]: ${await res.text()}`);
}

/** Sends one message to every device in the updates topic. */
export async function sendToTopic(
  sa: ServiceAccount,
  message: { title: string; body: string; updateId: string },
) {
  const accessToken = await getAccessToken(sa);
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          topic: UPDATES_TOPIC,
          notification: { title: message.title, body: message.body.slice(0, 180) },
          data: { updateId: message.updateId, path: "/parent/notifications" },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`FCM send failed [${res.status}]: ${await res.text()}`);
}
