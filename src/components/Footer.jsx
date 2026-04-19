export default function Footer({ school }) {
  const name = school?.name || "Sure Foundation Group of Schools";
  const address = school?.address || "";
  const phone = school?.phone || "";
  const email = school?.email || "";

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-col">
          <div className="footer-title">{name}</div>
          <div className="footer-text">
            Birthday sender dashboard connected to the school portal.
          </div>
        </div>

        <div className="footer-col">
          <div className="footer-title">Contact</div>
          {address && <div className="footer-text">{address}</div>}
          {phone && (
            <div className="footer-text">
              <a href={`tel:${phone}`}>{phone}</a>
            </div>
          )}
          {email && (
            <div className="footer-text">
              <a href={`mailto:${email}`}>{email}</a>
            </div>
          )}
        </div>

        <div className="footer-col">
          <div className="footer-title">Links</div>
          <div className="footer-text">
            <a href="https://portal.sfgs.com.ng/" target="_blank" rel="noopener noreferrer">
              Portal
            </a>
          </div>
          <div className="footer-text">
            <a href="https://www.sfgs.com.ng/" target="_blank" rel="noopener noreferrer">
              Website
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        © {new Date().getFullYear()} {name}. All Rights Reserved.
      </div>
    </footer>
  );
}

