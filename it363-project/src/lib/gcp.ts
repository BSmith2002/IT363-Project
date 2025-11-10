// Helper to fetch GCP IAM members for the current project. Uses googleapis dynamically
// and caches results in-process for a short TTL to avoid excessive calls.

let _cache: { members: string[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60s cache by default

function parseServiceAccount(raw: string) {
  let jsonStr = raw.trim();
  if (!jsonStr.startsWith("{")) {
    try {
      jsonStr = Buffer.from(jsonStr, "base64").toString("utf8");
    } catch (e) {
      throw new Error("Service account does not appear to be JSON or base64-encoded JSON");
    }
  }
  const svc = JSON.parse(jsonStr);
  if (svc?.private_key && typeof svc.private_key === "string") svc.private_key = svc.private_key.replace(/\\n/g, "\n");
  return svc;
}

export async function getGcpIamMembers(options?: { forceRefresh?: boolean; rawServiceAccount?: string }) {
  const now = Date.now();
  if (!options?.forceRefresh && _cache && _cache.expiresAt > now) {
    return _cache.members.slice();
  }

  const rawSvc = options?.rawServiceAccount || process.env.GOOGLE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!rawSvc) throw new Error("GOOGLE_SERVICE_ACCOUNT (or FIREBASE_SERVICE_ACCOUNT) env var required on server");

  const svc = parseServiceAccount(rawSvc);
  const projectId = process.env.GCP_PROJECT_ID || process.env.NEXT_PUBLIC_FB_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("GCP_PROJECT_ID (or NEXT_PUBLIC_FB_PROJECT_ID) env var required");

  const { google } = await import("googleapis");
  const auth = new google.auth.GoogleAuth({ credentials: svc, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const authClient = await auth.getClient();

  const crm = google.cloudresourcemanager({ version: "v3", auth: auth });
  // The API expects the resource in the form `projects/PROJECT_ID` or the project number.
  // Accept either plain project id or already-prefixed value.
  const resourceName = projectId.startsWith("projects/") ? projectId : `projects/${projectId}`;
  // helpful debug if something goes wrong (server logs)
  // console.debug(`[getGcpIamMembers] calling getIamPolicy for resource=${resourceName}`);
  const res = await crm.projects.getIamPolicy({ resource: resourceName, requestBody: {} as any });
  const policy = res.data as any;
  const bindings = policy?.bindings || [];
  const members: string[] = [];
  for (const b of bindings) {
    const arr = Array.isArray(b.members) ? b.members : [];
    for (const m of arr) {
      const parts = (m || "").toString().split(":");
      if (parts.length >= 2) {
        const kind = parts[0];
        const value = parts.slice(1).join(":");
        if (kind === "user" || kind === "group" || kind === "serviceAccount") {
          members.push(value.toLowerCase());
        }
      }
    }
  }

  const uniq = Array.from(new Set(members));
  _cache = { members: uniq.slice(), expiresAt: Date.now() + CACHE_TTL_MS };
  return uniq;
}
