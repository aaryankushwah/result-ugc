# Result UGC Product Plan

Status: Planning  
Primary users: Result creators, Result managers, reviewers, finance, and administrators  
Future users: customer teams with organization-scoped workspaces

## 1. Product decision

Result UGC should be one product with two role-based workspaces:

```text
Result UGC
├── Creator portal
│   └── What do I need to do, what was approved, how am I performing, and what am I owed?
└── Manager portal
    └── Who needs attention, what needs approval, what is working, and what happens next?
```

Both portals use the same creators, campaigns, briefs, tasks, submissions, reviews, posts, and activity history. A user's organization role determines which workspace and records they can access.

The recommended responsibility split is:

- **Result owns the workflow:** identity mapping, briefs, tasks, submissions, review, internal notes, AI analysis, and activity history.
- **Launchpoint proves the relationship:** creator status, signed contracts, programs, existing posts, compliance, and payout records remain authoritative there.
- **Viral supplies performance data:** tracked accounts, tracked videos, cross-platform metrics, refresh state, and analytics.
- **Discord carries conversation:** notifications and existing creator communication stay in Discord initially; Result links the conversation back to the correct work item.

This avoids running duplicate contract, payout, and chat systems while still giving the team a single operating view.

## 2. What the research says

### Launchpoint

Launchpoint is strongest as the trust and execution layer: creator vetting, verified views, contracts, tax/compliance, payout rules, and program management. Its Discord workflow reinforces that briefs, submissions, approvals, and creator channels should be connected rather than managed as separate inboxes.

Implications for Result:

- Do not recreate contract signing or tax collection in the first version.
- Display Launchpoint relationship and contract status everywhere it matters.
- Treat Launchpoint status as synced evidence, not a manually edited checkbox.
- Use Result to make Launchpoint information easier to understand alongside creative work.

Sources: [Launchpoint product](https://www.launchpointhq.com/), [Launchpoint Discord workflow](https://www.launchpointhq.com/blog/launchpoint-discord-integration-agencies), [Launchpoint Canvas workflow](https://www.launchpointhq.com/blog/canvas-ugc-what-it-is-how-it-works)

### Viral.app

Viral's strongest design decision is to start with tracking and build campaign operations on top of connected creator accounts. Its API exposes tracked accounts, individual videos, analytics, creator records, campaign assignments, chat, jobs, applications, and payout queues.

Implications for Result:

- Connect a creator's social accounts before depending on creator-level analytics.
- Track account and video refresh health as first-class operational states.
- Use Viral's account, video, and analytics APIs before building independent scraping.
- Avoid adopting Viral's creator, campaign, job, chat, and payout writes in the first version; they overlap with Launchpoint and Result's workflow model.
- Read Viral Creator Hub analytics where useful, but keep Result's campaign and brief IDs canonical.

Sources: [brand setup](https://viral.app/docs/brands), [creator management](https://viral.app/docs/brands/creator-hub/creators), [campaign rules](https://viral.app/docs/brands/creator-hub/campaigns), [payout workflow](https://viral.app/docs/brands/creator-hub/payouts), [creator onboarding](https://viral.app/docs/creators)

### SideShift and adjacent products

SideShift consistently collapses briefs, messages, approvals, tracking, and payments into one creator relationship. Impact's creator task workflow adds a useful draft → review → approval → final-deliverable state machine. UGC Infra and NewWave emphasize an exception-driven campaign command center rather than a collection of disconnected dashboards.

Implications for Result:

- The creator portal should center on tasks, deadlines, feedback, performance, and earnings.
- The manager portal should center on exceptions, review queues, roster health, and campaign progress.
- Every deliverable needs version history and an explicit state.
- A brief, its creator, submissions, feedback, posts, metrics, and payout context should remain one connected record.
- Marketplace discovery is not an MVP requirement because Result already has a signed roster.

Sources: [SideShift creators](https://sideshift.app/creators), [SideShift campaign management](https://sideshift.app/platform/campaign-management), [SideShift reporting](https://sideshift.app/platform/reporting), [Impact creator tasks](https://creatorsupport.freshdesk.com/support/solutions/articles/155000005306-manage-your-campaign-tasks), [UGC Infra](https://ugcinfra.com/), [NewWave](https://www.new-wave.ai/)

## 3. Source-of-truth model

| Domain | Authoritative source in v1 | What Result stores |
|---|---|---|
| User login and roles | Result | Users, organization memberships, permissions |
| Creator identity | Result | Canonical creator record and identity links |
| Launchpoint membership | Launchpoint | External ID, cached status, contracts, last sync, sync errors |
| Contracts and compliance | Launchpoint | Read-only snapshots and deep links |
| Payout status | Launchpoint | Read-only snapshots and reconciliation state |
| Social accounts | Result + Viral | Canonical links with Viral account IDs and tracking state |
| Social posts and metrics | Viral | Normalized posts, metric snapshots, refresh timestamps |
| Campaign workflow | Result | Campaigns, assignments, stages, owners, deadlines |
| Briefs and AI adaptations | Result | Source references, transcript, analysis, versions, approvals |
| Drafts and deliverables | Result | Assets, versions, feedback, review decisions |
| Conversation | Discord initially | Discord channel/message links and notification events |
| AI output | Result, derived | Model, prompt/version, sources, result, human approval |

### Provider rule

Every external record must be linked with:

- `organization_id`
- `provider`
- `external_id`
- `last_synced_at`
- `sync_status`
- `source_url` when available

Provider data should never overwrite Result-authored notes, briefs, reviews, or ownership fields.

## 4. Launchpoint relationship status

“Signed to Launchpoint” must not be a manually maintained boolean. It is a derived relationship state based on the synced creator mapping and contract/program records.

### Canonical states

| Result status | Meaning | Display |
|---|---|---|
| Unlinked | No Launchpoint creator match | Gray `Not linked` |
| Needs match | More than one possible creator match | Coral `Resolve match` |
| Linked | Creator exists in Launchpoint but no signed active contract was returned | Gray `Linked` |
| Pending | Invitation or contract is waiting for creator action | Neutral `Signature pending` |
| Signed — upcoming | Signed contract has a future start date | Green `Signed · starts [date]` |
| Signed — active | At least one signed/active contract is currently effective | Green `Signed · active` |
| Expiring | Active contract is approaching its end date | Coral `Expires [date]` |
| Inactive | Contracts are canceled, expired, or otherwise inactive | Gray `Inactive` |
| Sync issue | Previously linked but the provider cannot currently be read | Coral `Sync issue` |

### Where it appears

- Creator portal header and Profile → Connections
- Manager creator roster as a filterable column
- Manager creator profile relationship card
- Campaign roster rows
- Assignment and payout validation warnings
- Command-center exception queue when a signed relationship is missing or expiring

Every badge should include “Synced from Launchpoint” and the last successful sync time in its detail view.

## 5. Creator portal

The creator portal answers four questions:

1. What do I need to do next?
2. What exactly does Result expect from me?
3. What happened to the work I submitted?
4. How is my content performing and what am I owed?

### Creator navigation

```text
Today
My work
Submissions
Performance
Earnings
Profile & connections
```

### C1. Today

The creator's action-oriented home screen.

Required modules:

- Launchpoint relationship card
- Next required action with one primary CTA
- Active campaign and current brief
- Due-soon tasks
- Feedback waiting on a revision
- Recently approved work
- Current-period content output
- Estimated/confirmed earnings summary
- Important Discord or system notifications

The page must never be a generic analytics dashboard. If the creator has work due, that work comes before performance metrics.

### C2. My work

Shows current and historical assignments.

Views:

- Active
- Upcoming
- Waiting on Result
- Completed

Each work card shows campaign, brief, deliverable count, next deadline, review status, publishing requirement, and compensation summary.

### C3. Brief detail

The working surface for one assignment.

Sections:

- Objective and target audience
- Required hook/message/CTA
- Deliverables, formats, and platform
- Shot list or scene guidance
- Dos, don'ts, disclosure requirements, and non-negotiables
- Reference videos with transcript/analysis notes
- AI-adapted script or outline approved by the team
- Due dates and posting window
- Compensation terms from the associated Launchpoint program/contract
- Ask-question action that opens the correct Discord location
- Submit draft or paste submission link

The creator sees only the approved brief version. Internal drafts and team notes remain private.

### C4. Submission detail

One timeline for every version of a deliverable.

State machine:

```text
Not started
→ Draft submitted
→ In review
→ Changes requested
→ Revised
→ Approved to post
→ Posted
→ Metrics tracking
→ Complete
```

Required capabilities:

- Upload file or provide a supported link
- Version history
- Structured and time-coded feedback
- Clear revision checklist
- Approval decision and approver
- Final post URL
- Tracking connection and refresh status

### C5. Performance

Creator-friendly, not finance-analyst-heavy.

- Posted videos
- Views, likes, comments, shares, saves, and engagement
- Seven-day and thirty-day movement
- Campaign and platform filters
- Best-performing videos
- Performance against the creator's own baseline
- Brief/format insights written in plain language
- Last data refresh and source platform

Avoid public creator rankings in the first version; they can damage trust without enough context.

### C6. Earnings

Read-only in v1 because Launchpoint remains authoritative.

- Upcoming
- Due or processing
- Paid
- Payout breakdown by campaign/period
- Base pay versus performance bonuses
- Link to the relevant Launchpoint payout or support workflow
- Reconciliation warning when Result estimates and Launchpoint status differ

Never display an estimated amount as confirmed earnings.

### C7. Profile & connections

- Name, avatar, email, timezone, and preferred communication
- Launchpoint identity and contract status
- Discord membership/channel status
- Connected TikTok, Instagram, YouTube, Facebook, or Snapchat accounts
- Viral tracking status for each account
- Portfolio links
- Notification preferences

Creators can propose account/profile edits; identity and contract links that affect reporting require manager confirmation.

## 6. Manager and team portal

The manager portal is an exception-and-decision system. It should reveal work that needs intervention before showing broad analytics.

### Manager navigation

```text
Command center
Creators
Campaigns
Briefs & references
Review
Content library
Analytics
Contracts & payouts
Activity
Team & integrations
```

### M1. Command center

The daily operating view.

Top line:

- Active creators
- Active campaigns
- Posts this period
- Views and engagement movement
- Deliverables awaiting review
- Overdue work

Action queues:

- Submissions waiting for review
- Creators missing a Launchpoint match or active contract
- Briefs waiting for team approval
- Creators behind target
- Social tracking failures or stale metrics
- Contracts expiring soon
- Payout discrepancies or due items

Recent activity should combine Result, Launchpoint, Viral, and Discord events into one normalized feed.

### M2. Creators roster

This is the team directory and relationship-health surface.

Columns:

- Creator
- Launchpoint status
- Active campaign
- Current stage
- Output this period versus target
- Latest post
- Views and engagement
- Pending review/revision count
- Discord status
- Viral tracking status
- Owner

Filters:

- Launchpoint relationship
- Campaign/program
- Stage
- Platform
- Owner
- Behind target
- Needs review
- Tracking issue
- Active/inactive

Bulk actions should begin with assign campaign, set owner, request sync, and notify—not contract or payout mutations.

### M3. Creator profile

One complete relationship record.

Header:

- Identity and contact
- Launchpoint status with contract/program details
- Discord identity/channel
- Social accounts and tracking health
- Internal owner

Tabs:

- Overview
- Work and campaigns
- Submissions
- Published content
- Performance
- Contracts and payouts
- Internal notes
- Activity history

Internal notes and private review context must never appear in the creator portal.

### M4. Campaigns

Campaign list fields:

- Status and stage
- Owner
- Active dates
- Assigned/active creators
- Video target and progress
- Content awaiting review
- Published videos
- Views and effective CPM
- Expected/paid amount when available

Campaign detail tabs:

- Overview
- Roster
- Briefs
- Deliverables
- Published content
- Performance
- Contracts and payouts
- Activity

Result campaigns may link to one or more Launchpoint programs. The mapping must be explicit, not inferred from similar names.

### M5. Briefs & references

This is Result's main differentiated workflow.

Reference intake:

1. Paste Instagram, TikTok, YouTube, or other supported URL.
2. Resolve and archive the source metadata.
3. Transcribe speech and extract on-screen text.
4. Break the video into hook, scenes, proof, CTA, pacing, and visual pattern.
5. Compare against Result's brand/product context.
6. Generate adapted concepts or a draft brief.
7. Human edits and approves the brief.
8. Assign the approved version to creators.

Screens:

- Reference library
- Reference detail and transcript
- AI analysis panel
- Brief builder
- Brief version comparison
- Approval and assignment sheet

Every AI claim should link back to the transcript, source scene, or brand guideline that produced it.

### M6. Review queue

The highest-frequency team surface.

- Queue filters by campaign, creator, reviewer, status, and due date
- Video player with transcript and brief side by side
- Brief compliance checklist
- Time-coded comments
- Approve, request changes, or escalate
- Reusable feedback snippets
- Version comparison
- Next item navigation
- Discord notification after a decision

Approval is a recorded decision with actor, timestamp, brief version, submission version, and reason.

### M7. Content library

A searchable record of references, drafts, approved assets, and published posts.

Filters:

- Asset stage
- Creator
- Campaign/brief
- Platform and format
- Hook, angle, CTA, product, and audience tags
- Performance band
- Usage rights
- Approval state
- Date

The library should show what an asset is cleared for, not merely where the file is stored.

### M8. Analytics

Views:

- Overview
- Creators
- Campaigns
- Content/formats
- Platforms
- Posting activity
- Geography
- Data health

Core metrics:

- Posts
- Active creators/accounts
- Views
- Engagement and engagement rate
- Shares, saves, and comments
- View velocity
- Spend per video and effective CPM when reliable
- Output versus target
- Top creators/videos/accounts

Every metric view needs date, campaign, creator, platform, project, and tag filters. Viral refresh timestamps and exclusions must be visible.

### M9. Contracts & payouts

Read-only Launchpoint view in v1.

- Contracts by status
- Programs
- Pending/paid payouts
- Contract expiry queue
- Creator payout history
- Data reconciliation warnings
- Deep links to Launchpoint for action

Result should not present a mutation it cannot complete in Launchpoint.

### M10. Activity

An audit and notification center:

- New submission
- Review decision
- Brief approved/assigned
- Post discovered
- Metric milestone
- Launchpoint contract/status change
- Tracking error/recovery
- Payout status change
- Discord notification sent/failed

Users can filter by creator, campaign, source system, and event type.

### M11. Team & integrations

- Team members and roles
- Launchpoint connection and last sync
- Viral API connection, quota, refresh health, and tracked limits
- Discord guild/channel mapping
- Brand context and guidelines used for AI
- Notification routing
- Audit log

Secrets are never displayed after entry.

## 7. Roles and permissions

| Role | Access |
|---|---|
| Creator | Own profile, assignments, briefs, submissions, content, performance, earnings |
| Reviewer | Assigned review queue, briefs, submissions, comments, approval decisions |
| Manager | All creator and campaign operations within the organization |
| Finance | Contracts, payout snapshots, reconciliation, exports; no creative edits by default |
| Admin | Team, roles, integrations, brand context, sync controls, full audit access |
| Customer member — future | Customer organization data only, with scoped manager/reviewer/finance roles |

Build organization scoping into every table and request from the beginning even while Result is the only organization.

## 8. Core product records

- Organization
- User
- Organization membership and role
- Creator
- Creator identity/link
- External provider connection
- Contract snapshot
- Program mapping
- Campaign
- Campaign assignment
- Reference video
- Transcript and analysis
- Brief and brief version
- Task/deliverable requirement
- Submission and submission version
- Review decision and feedback
- Content asset
- Social account
- Published post
- Metric snapshot
- Payout snapshot
- Internal note
- Activity event
- Notification delivery

## 9. What the Viral API should power first

The supplied Viral API supports far more than the first release needs. Initial use should be intentionally narrow.

### Use first

- `/accounts/tracked` for account enrollment and tracking health
- `/accounts` and account metrics for profile performance
- `/videos` and video metrics for the content library and post detail
- `/analytics/kpis`, `/analytics/metrics`, and top-account/video/creator endpoints
- `/videos/activity` for posting cadence
- `/projects` for clean reporting boundaries if required
- Creator Hub overview activity/performance/events for useful operational rollups

### Defer

- Viral creator creation/invitations
- Viral campaign creation and assignment writes
- Jobs and applications
- Viral chat
- Viral payouts
- Live one-off scraping/lookups except explicit user-triggered reference intake

The deferred areas overlap with Launchpoint or Result and would create multiple systems of record.

## 10. MVP sequence

### Milestone 0 — Foundations

- Organization-scoped authentication
- Creator and team roles
- Canonical creator identity model
- Provider connection model
- Audit/activity event model

### Milestone 1 — Roster and Launchpoint truth

- Launchpoint creator import and scheduled sync
- Identity matching with manual resolution
- Contract/program snapshot sync
- Manager creator roster
- Manager creator profile
- Creator Profile & Connections page
- Launchpoint status badges and exceptions

### Milestone 2 — Work loop

- Campaign and assignment records
- Brief builder and versioning
- Creator Today and My Work
- Draft submission and version history
- Manager review queue
- Approval/revision workflow
- Discord notifications and deep links

### Milestone 3 — Reference intelligence

- Reference URL intake
- Media metadata and secure storage
- Transcription and on-screen text extraction
- Structured creative analysis
- Brand-aware adaptation
- Human-approved brief generation

### Milestone 4 — Performance layer

- Viral tracked-account linking
- Video ingestion and matching
- Manager overview and analytics
- Creator performance view
- Content library with performance filters
- Refresh/data-health visibility

### Milestone 5 — Financial visibility

- Launchpoint contract and payout read views
- Estimated versus confirmed separation
- Expiry and payout exception queues
- Finance role and exports

### Milestone 6 — Customer readiness

- Customer organizations
- Customer-specific brand context and integrations
- Customer team invitations
- External review/approval links
- Organization-specific Discord and provider mappings
- Billing and plan limits only after the workflow is proven internally

## 11. First screens to design

Design these six screens before expanding navigation:

1. Manager creator roster
2. Manager creator profile
3. Creator Today
4. Creator brief detail
5. Manager review queue
6. Manager campaign detail

Together they validate the core identity, assignment, submission, approval, Launchpoint-status, and cross-role permission model.

## 12. Explicit non-goals for v1

- Replacing Launchpoint contracts, taxes, or payouts
- Building a public creator marketplace
- Duplicating full Discord chat inside Result
- Autonomous publishing to social accounts
- Running an independent broad Instagram scraper
- Public creator leaderboards
- Customer billing before internal adoption
- Unreviewed AI-generated briefs sent directly to creators

## 13. Product success measures

Internal MVP success should be measured by operational improvement, not signups.

- Percentage of active creators correctly linked to Launchpoint
- Percentage of active creators with tracked social accounts
- Time from reference link to approved brief
- Time from submission to first review decision
- Revision rounds per approved deliverable
- On-time deliverable rate
- Percentage of published posts automatically matched to a creator and brief
- Manager hours spent chasing status each week
- Percentage of work visible without opening Launchpoint, Discord, or a spreadsheet
- Creator-reported clarity of next action and payout status
