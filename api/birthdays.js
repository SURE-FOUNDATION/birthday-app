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

  const baseUrl =
    process.env.PORTAL_BIRTHDAYS_API_URL || "https://portal.sfgs.com.ng/?page=birthdays_api";
  const token = process.env.PORTAL_BIRTHDAYS_API_TOKEN || "";
  if (!token) {
    res.status(500).json({ success: false, error: "Missing PORTAL_BIRTHDAYS_API_TOKEN" });
    return;
  }

  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 200)));
    const url = new URL(baseUrl);
    url.searchParams.set("limit", String(limit));

    const portalRes = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        "x-portal-token": token,
      },
    });

    const contentType = portalRes.headers.get("content-type") || "";
    const text = await portalRes.text();
    if (!portalRes.ok) {
      res
        .status(502)
        .json({ success: false, error: `Portal error (${portalRes.status})`, detail: text.slice(0, 180) });
      return;
    }

    if (!contentType.includes("application/json")) {
      res.status(502).json({
        success: false,
        error: "Portal did not return JSON (Cloudflare challenge?)",
        detail: text.slice(0, 180),
      });
      return;
    }

    const data = JSON.parse(text);
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : "Request failed" });
  }
}
