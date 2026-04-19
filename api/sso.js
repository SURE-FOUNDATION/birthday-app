import { verifyPortalToken } from "./_auth.js";

export default function handler(req, res) {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const secret = process.env.BIRTHDAY_SSO_SECRET || "";

  const verified = verifyPortalToken(token, secret);
  if (!verified.ok) {
    res.status(401).send("Unauthorized");
    return;
  }

  // Short-lived session cookie.
  const maxAge = 60;
  const cookie = [
    `sfgs_bday_sso=${encodeURIComponent(token)}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);

  res.writeHead(302, { Location: "/" });
  res.end();
}

