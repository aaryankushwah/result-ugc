import Link from "next/link";

export default function ForbiddenPage() {
  return <main className="login-shell"><section className="login-card"><p className="eyebrow">ACCESS LIMITED</p><h1>This action needs a manager role.</h1><p className="login-copy">Your Discord access is valid, but this part of the workspace is restricted.</p><Link className="primary-button login-button" href="/overview">Return to overview</Link></section></main>;
}
