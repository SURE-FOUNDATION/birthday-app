import { requireSession } from "./_auth.js";

export default async function handler(req, res) {
  const session = requireSession(req);
  if (!session.ok) {
    res.status(401).json({ success: false, error: session.error });
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const apiUrl = process.env.PORTAL_BIRTHDAYS_API_URL || "https://portal.sfgs.com.ng/?page=birthdays_api";
  const token = process.env.PORTAL_BIRTHDAYS_API_TOKEN || "";
  if (!token) {
    res.status(500).json({ success: false, error: "Missing PORTAL_BIRTHDAYS_API_TOKEN" });
    return;
  }

  try {
    const portalRes = await fetch(apiUrl, {
      headers: {
        accept: "application/json",
        "x-portal-token": token,
      },
    });

    const contentType = portalRes.headers.get("content-type") || "";
    const text = await portalRes.text();
    if (!portalRes.ok) {
      res.status(502).json({ success: false, error: `Portal error (${portalRes.status})` });
      return;
    }

    if (!contentType.includes("application/json")) {
      res.status(502).json({ success: false, error: "Portal did not return JSON" });
      return;
    }

    const data = JSON.parse(text);
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : "Request failed" });
  }
}

