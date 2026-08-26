import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { SourceImage } from "@/components/source-image";
import { PageTitle, StateBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { buildOnboardingFunnel, onboardingStages, summarizeOnboardingFunnel, type OnboardingStage } from "@/lib/onboarding-funnel";
import { getPortalData } from "@/lib/portal-data";

function isStage(value: string | undefined): value is OnboardingStage {
  return Boolean(value) && (onboardingStages as readonly string[]).includes(value!);
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  await requireUser();
  const [data, params] = await Promise.all([getPortalData(), searchParams]);
  const selected = isStage(params.stage) ? params.stage : null;
  const entries = buildOnboardingFunnel(data.creators);
  const summary = summarizeOnboardingFunnel(entries);
  const shown = selected ? entries.filter((entry) => entry.stage === selected) : entries.filter((entry) => entry.stage !== "live");
  const heading = selected ? summary.find((stage) => stage.stage === selected)!.label : "Needs action";

  return (
    <div className="page-stack">
      <PageTitle eyebrow="OPERATIONS" title="Onboarding" />

      <section className="funnel-rail" aria-label="Onboarding funnel">
        {summary.map((stage, index) => {
          const href = selected === stage.stage ? "/onboarding" : `/onboarding?stage=${stage.stage}`;
          return (
            <Link key={stage.stage} href={href} className="funnel-stage" data-selected={selected === stage.stage || undefined} data-terminal={stage.stage === "live" || undefined}>
              <span className="funnel-stage-index">{index + 1}</span>
              <strong className="funnel-stage-label">{stage.label}</strong>
              <span className="funnel-stage-reached">{stage.reached}</span>
              <span className="funnel-stage-meter" aria-hidden="true"><span style={{ width: `${Math.round(stage.conversion * 100)}%` }} /></span>
              <span className="funnel-stage-waiting" data-blocked={stage.waiting > 0 || undefined}>
                {stage.stage === "live" ? `${Math.round(stage.conversion * 100)}% of funnel` : stage.waiting ? `${stage.waiting} waiting here` : "Nobody waiting"}
              </span>
            </Link>
          );
        })}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{heading}</h2>
          <div className="funnel-panel-actions">
            <StateBadge label={`${shown.length} creator${shown.length === 1 ? "" : "s"}`} tone={shown.length ? "attention" : "success"} />
            {selected ? <Link className="funnel-clear" href="/onboarding">Clear filter</Link> : null}
          </div>
        </div>
        {shown.length ? (
          <div className="funnel-list">
            {shown.map((entry) => (
              <Link href={`/creators/${entry.creator.id}`} key={entry.creator.id}>
                <span className="account-avatar">
                  {entry.creator.accounts[0]?.avatarUrl ? <SourceImage src={entry.creator.accounts[0].avatarUrl} width={30} height={30} /> : entry.creator.displayName.slice(0, 1)}
                </span>
                <span className="funnel-identity">
                  <strong>{entry.creator.displayName}</strong>
                  <small>@{entry.creator.accounts[0]?.username ?? entry.creator.discord.username ?? "unknown"} · {entry.creator.accounts[0]?.platform ?? "no account"}</small>
                </span>
                <span className="funnel-blocker">
                  <small>Blocked on</small>
                  <strong title={entry.blocker}>{entry.blocker}</strong>
                </span>
                <span className="funnel-action">
                  <small>Next action</small>
                  <strong title={entry.action}>{entry.action}</strong>
                </span>
                <StateBadge label={entry.stage === "live" ? "live" : entry.stage} tone={entry.stage === "live" ? "success" : "attention"} />
                <ArrowUpRight />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state small">
            <CheckCircle2 />
            <strong>{selected ? `Nobody is waiting at ${heading.toLowerCase()}` : "Every creator has cleared onboarding"}</strong>
          </div>
        )}
      </section>
    </div>
  );
}
