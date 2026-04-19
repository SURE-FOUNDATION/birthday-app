export default function handler(_req, res) {
  const cookie = [
    "sfgs_bday_sso=",
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
  res.writeHead(302, { Location: "/" });
  res.end();
}

