import Link from "next/link";
import { redirect } from "next/navigation";
import { discordAuthConfigured, getCurrentUser } from "@/lib/auth";

const errors: Record<string, string> = {
  not_configured: "Discord login still needs its client credentials and Result guild ID.",
  invalid_state: "That login attempt expired. Please try again.",
  not_in_guild: "Join the Result Discord server before opening the manager workspace.",
  unauthorized_role: "Your Discord account does not have an authorized Result team role.",
  oauth_failed: "Discord could not complete the login. Please try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/overview");
  const { error } = await searchParams;
  const configured = discordAuthConfigured();
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark font-result">R</div>
        <p className="eyebrow">RESULT INTERNAL</p>
        <h1>One place to run creator operations.</h1>
        <p className="login-copy">Creators, signing status, Discord access, tracked accounts, and video performance—connected around one profile.</p>
        {error ? <div className="inline-alert">{errors[error] ?? "Login failed."}</div> : null}
        {configured ? (
          <Link className="primary-button login-button" href="/api/auth/discord/start">Continue with Discord <span>→</span></Link>
        ) : (
          <div className="setup-box"><strong>Discord authentication is ready in code.</strong><span>Add the required environment variables in Vercel to enable team login.</span></div>
        )}
        <p className="login-footnote">Access is limited to the Result guild and configured staff roles.</p>
      </section>
    </main>
  );
}
