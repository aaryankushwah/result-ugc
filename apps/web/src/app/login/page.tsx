import { ArrowRight, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

const errors: Record<string, string> = {
  not_configured: "Login is temporarily unavailable.",
  invalid_state: "That login attempt expired. Please try again.",
  not_in_guild: "Join the Result Discord server before opening the manager workspace.",
  unauthorized_role: "Your Discord account does not have an authorized Result team role.",
  oauth_failed: "Discord could not complete the login. Please try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/overview");
  const { error } = await searchParams;
  return (
    <main className="login-shell">
      <section className="login-card">
        <header className="login-brand">
          <span className="login-brand-mark font-result">R</span>
          <strong>Result</strong>
        </header>
        <div className="login-heading">
          <p>Internal workspace</p>
          <h1>Sign in.</h1>
        </div>
        {error ? <div className="inline-alert">{errors[error] ?? "Login failed."}</div> : null}
        <Link className="primary-button login-button" href="/api/auth/discord/start"><span>Continue with Discord</span><ArrowRight/></Link>
        <p className="login-footnote"><LockKeyhole/>Result team access only</p>
      </section>
      <p className="login-meta">Creator operations</p>
    </main>
  );
}
