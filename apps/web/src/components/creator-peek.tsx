"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { CreatorCharts } from "@/components/creator-charts";
import { SourceImage } from "@/components/source-image";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatNumber, formatPercent, StateBadge, timeAgo, TrackingBadge } from "@/components/ui";
import type { PortalCreator, PortalVideo } from "@/lib/portal-types";

/**
 * Right-hand peek for one creator: identity, the numbers that decide whether to
 * act, and the performance charts — without leaving the roster.
 */
export function CreatorPeek({ creator, videos, onClose }: { creator: PortalCreator | null; videos: PortalVideo[]; onClose: () => void }) {
  const followers = creator?.accounts.reduce((sum, account) => sum + (account.followers ?? 0), 0) ?? 0;
  return (
    <Sheet open={Boolean(creator)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="creator-peek">
        {creator ? (
          <>
            <SheetHeader className="creator-peek-header">
              <div className="creator-peek-identity">
                <span className="account-avatar creator-peek-avatar">
                  {creator.discord.avatarUrl ?? creator.accounts[0]?.avatarUrl
                    ? <SourceImage src={creator.discord.avatarUrl ?? creator.accounts[0]!.avatarUrl!} width={46} height={46} />
                    : creator.displayName.slice(0, 1)}
                </span>
                <div>
                  <SheetTitle>{creator.displayName}</SheetTitle>
                  <SheetDescription>
                    {creator.accounts[0] ? `@${creator.accounts[0].username}` : creator.discord.username ? `@${creator.discord.username}` : "No account"}
                    {" · "}{creator.lifecycle}{" · "}last activity {timeAgo(creator.lastActivityAt)}
                  </SheetDescription>
                </div>
              </div>
              <div className="creator-peek-badges">
                <StateBadge label={creator.discord.state} tone={creator.discord.state === "connected" ? "success" : "attention"} />
                {creator.relationships.length
                  ? creator.relationships.map((relationship) => <StateBadge key={relationship.id} label={relationship.provider} tone={relationship.state === "signed_active" ? "success" : "neutral"} />)
                  : <StateBadge label="no signing" tone="attention" />}
                <TrackingBadge state={creator.trackingState} />
              </div>
            </SheetHeader>

            <div className="creator-peek-body">
              <dl className="creator-peek-stats">
                <div><dt>30d views</dt><dd>{formatNumber(creator.views30d)}</dd></div>
                <div><dt>30d posts</dt><dd>{formatNumber(creator.posts30d)}</dd></div>
                <div><dt>Engagement</dt><dd>{formatPercent(creator.engagementRate)}</dd></div>
                <div><dt>Followers</dt><dd>{formatNumber(followers)}</dd></div>
              </dl>
              <CreatorCharts creator={creator} videos={videos} />
            </div>

            <div className="creator-peek-footer">
              <Link href={`/creators/${creator.id}`}>Open full profile <ArrowUpRight /></Link>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
