type SignalVideo = {
  id: string;
  accountId: string;
  accountUsername: string;
  caption: string;
  publishedAt: string | null;
  views: number;
  comments: number;
  baselineMultiplier: number;
  included: boolean;
};

type SignalAccount = {
  id: string;
  username: string;
  performanceHealth?: "healthy" | "warming" | "at_risk" | "inactive" | "unknown";
  performanceHealthReason?: string;
};

type SignalCreator = {
  id: string;
  displayName: string;
  lifecycle: "request" | "active" | "watch" | "offboarded";
  accounts: Array<{ id: string; linkState: "suggested" | "confirmed" | "unlinked" }>;
};

export type OverviewSignal = {
  id: string;
  kind: "breakout" | "comments" | "cadence" | "risk";
  title: string;
  detail: string;
  metric: string;
  href: string;
  score: number;
};

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function ageInDays(value: string | null, now: Date): number | null {
  if (!value) return null;
  const elapsed = now.getTime() - new Date(value).getTime();
  return elapsed >= 0 ? elapsed / 86_400_000 : null;
}

function compact(value: number): string {
  return new Intl.NumberFormat("en", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export function buildOverviewSignals(input: {
  creators: SignalCreator[];
  accounts: SignalAccount[];
  videos: SignalVideo[];
  now?: Date;
}): OverviewSignal[] {
  const now = input.now ?? new Date();
  const included = input.videos.filter((video) => video.included);
  const signals: OverviewSignal[] = [];
  const usedVideos = new Set<string>();

  const breakouts = included
    .filter((video) => {
      const age = ageInDays(video.publishedAt, now);
      return age !== null && age <= 14 && video.views >= 500 && video.baselineMultiplier >= 1.75;
    })
    .sort((a, b) => b.baselineMultiplier - a.baselineMultiplier || b.views - a.views)
    .slice(0, 2);
  for (const video of breakouts) {
    usedVideos.add(video.id);
    signals.push({
      id: `breakout:${video.id}`,
      kind: "breakout",
      title: `@${video.accountUsername} has a breakout video`,
      detail: `${video.caption} · ${compact(video.views)} views`,
      metric: `${video.baselineMultiplier.toFixed(1)}×`,
      href: `/videos/${encodeURIComponent(video.id)}`,
      score: 90 + Math.min(40, video.baselineMultiplier * 6),
    });
  }

  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const monthVideos = included.filter((video) => video.publishedAt && new Date(video.publishedAt).getTime() >= monthStart && new Date(video.publishedAt).getTime() <= now.getTime());
  const typicalComments = Math.max(1, median(monthVideos.map((video) => video.comments)));
  const commentVideo = [...monthVideos]
    .filter((video) => !usedVideos.has(video.id) && video.comments >= 5 && video.comments >= typicalComments * 2)
    .sort((a, b) => b.comments - a.comments || b.views - a.views)[0];
  if (commentVideo) {
    signals.push({
      id: `comments:${commentVideo.id}`,
      kind: "comments",
      title: "Comments are unusually high",
      detail: `${commentVideo.caption} · @${commentVideo.accountUsername}`,
      metric: `${commentVideo.comments} comments`,
      href: `/videos/${encodeURIComponent(commentVideo.id)}`,
      score: 80 + Math.min(25, commentVideo.comments / typicalComments * 4),
    });
  }

  const riskAccounts = input.accounts
    .filter((account) => account.performanceHealth === "inactive" || account.performanceHealth === "at_risk")
    .sort((a, b) => (a.performanceHealth === "inactive" ? -1 : 1) - (b.performanceHealth === "inactive" ? -1 : 1))
    .slice(0, 2);
  for (const account of riskAccounts) {
    signals.push({
      id: `risk:${account.id}`,
      kind: "risk",
      title: `@${account.username} needs attention`,
      detail: account.performanceHealthReason ?? "Recent account performance is below its established baseline",
      metric: account.performanceHealth === "inactive" ? "Inactive" : "At risk",
      href: `/accounts/${encodeURIComponent(account.id)}`,
      score: account.performanceHealth === "inactive" ? 112 : 88,
    });
  }

  const mondayIndex = (now.getUTCDay() + 6) % 7;
  const elapsedDays = mondayIndex + 1;
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setUTCDate(today.getUTCDate() - mondayIndex);
  const cadence = input.creators.flatMap((creator) => {
    if (creator.lifecycle !== "active") return [];
    const accountIds = new Set(creator.accounts.filter((account) => account.linkState === "confirmed").map((account) => account.id));
    if (!accountIds.size) return [];
    const completedDays = new Set<string>();
    for (const video of included) {
      if (!video.publishedAt || !accountIds.has(video.accountId)) continue;
      const published = new Date(video.publishedAt);
      if (published < weekStart || published > now) continue;
      completedDays.add(`${video.accountId}:${video.publishedAt.slice(0, 10)}`);
    }
    const expected = accountIds.size * elapsedDays;
    const missed = Math.max(0, expected - completedDays.size);
    const completion = expected ? completedDays.size / expected : 1;
    return expected >= 2 && missed >= 2 && completion < 0.7 ? [{ creator, expected, completed: completedDays.size, missed, completion }] : [];
  }).sort((a, b) => a.completion - b.completion || b.missed - a.missed).slice(0, 2);
  for (const item of cadence) {
    signals.push({
      id: `cadence:${item.creator.id}`,
      kind: "cadence",
      title: `${item.creator.displayName} is behind on posting`,
      detail: `${item.completed} of ${item.expected} account-day goals hit this week`,
      metric: `${item.missed} missed`,
      href: `/creators/${encodeURIComponent(item.creator.id)}`,
      score: 82 + Math.min(20, item.missed * 2),
    });
  }

  return signals.sort((a, b) => b.score - a.score).slice(0, 5);
}
