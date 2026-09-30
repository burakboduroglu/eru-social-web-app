import { Link } from "@tanstack/react-router";

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="social-web ana sayfa">
      <img src="/assets/social-web-mark.svg" width="36" height="36" alt="" />
      <span className="brand-name">social<span className="brand-dash">-</span>web</span>
    </Link>
  );
}
