# Compact UGC Discord Bot

A Discord.js bot for a small UGC team. It keeps the public server simple and gives every creator one private workspace shared only with that creator, the server owner, the `UGC Manager` role, and the bot.

## What `/setup` builds

- `START HERE`: `#verify`
- `UGC`: `#announcements`, `#faq`, `#resources`, `#general`, `#wins`, `#accounts`
- `TEAM`: private `#approved-content` and `#onboarding-alerts`
- `CREATORS`: private creator channels are added here as needed
- Five roles: blanket `Admin`, plus `UGC Manager`, `Moderator`, `Verified Creator`, and `Member`

The existing Discord `#rules`, default text channel, and voice channel are left alone.

## Commands

- Setup: `/setup`, `/quickstart`, `/setup-onboarding`, `/health`
- Creators: `/add-creator`, `/delete-creator`, `/creator-assign`, `/creator-review`, `/creator-progress`, `/issue-link`, `/delete-link`
- Content: Launchpoint is the source of truth for creator submissions and approvals; legacy local content commands are hidden from Discord.
- Program: `/programs`, `/program-remove`, `/set-quota`, `/set-trial`, `/reminders`, `/refresh-metrics`, `/export`
- Launchpoint: `/launchpoint creators`, `/launchpoint contracts`, `/launchpoint programs`, `/launchpoint kpis`, `/launchpoint leaderboard`, `/launchpoint payouts` (read-only)
- Launchpoint content sync: new posts returned by Launchpoint are checked every 10 minutes and announced in `#approved-content` once, with creator, platform, link, and performance details.
- Calls: `/group-call` posts a timezone-aware weekly availability poll; `/group-call-results` posts the ranked best times; `/group-call-reset confirm:true` clears the current poll's responses for a fresh vote. Creators choose EST/PST/IST, days, and all workable times.
- Help and security: `/help`, `/set-key`

Editing-assignment commands and FOMO monitoring are intentionally excluded. `/set-key` never accepts secrets in Discord; it explains how to set `METRICS_API_KEY` locally in `.env`.

The Launchpoint public API is currently read-only: it can expose creators, contract statuses, programs, posts, analytics, payouts, pay structures, and invite links, but the published API does not provide a contract-cancellation mutation. To cancel a contract, use Launchpoint's dashboard/support workflow; the bot can still surface the resulting `cancelled` status through `/launchpoint contracts`.

Set `DUB_API_KEY` and `DUB_DEFAULT_URL` on the bot host to enable creator attribution. The bot idempotently allocates one conversion-tracked Dub link to every active Result creator, posts it in the creator's private channel whenever Discord is connected, and refreshes Dub totals every 15 minutes. The manager portal reads those source-backed snapshots from Postgres. `/issue-link` remains available inside a creator's private channel (or `#bot-tests`) for an immediate/manual upsert; `url:` overrides the default destination. For Dub partner attribution, pass that creator's Dub `partner_id` (or set `DUB_DEFAULT_PARTNER_ID`). `/delete-link link:<id-or-url> confirm:true` removes a saved link from Dub.

Program state is stored locally in `.data/state.json` with owner-only file permissions and is excluded from Git. `/program-remove confirm:true` removes only that saved state; it never deletes Discord roles or channels.

Creator workflow: `/creator-review creator:@name` automatically resolves the existing Launchpoint creator link when the identity is unambiguous. Notes and next steps remain private staff data.

## Verification

The `#verify` button grants only the `Applicant` role and sends a private approval request to `#onboarding-alerts`. Discord's server verification level is set to **Medium**, so new members are not forced to wait 10 minutes before speaking. Approved members receive `Member`, `Verified Creator`, and a private creator channel. The bot still requires all of the following:

- Discord Rules Screening has been completed
- the Discord account is at least 7 days old
- the account is not a bot and is not already verified

Attempts are rate-limited and logged in private `#onboarding-alerts`. `/setup` keeps Discord's server verification level at **Medium** or lower. Creator access is always assigned separately with `/add-creator`.

## Run it

1. Put `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `DISCORD_GUILD_ID` in `.env`.
2. Run `npm install`.
3. Deploy commands with `npm run deploy:commands`.
4. Start the bot with `npm start` (after `npm run build`) or `npm run dev`.
5. Assign `Admin`, `UGC Manager`, and `Moderator` only to trusted team members.

The generated `Admin` role has Discord's blanket `Administrator` permission. Assign it only to fully trusted people. Result Clanker also needs `Administrator` while running `/setup` so Discord allows it to create or update that role; keep the bot role above the five roles it manages.

## Security

- Private creator channels deny `View Channel` to `@everyone` and explicitly allow only the creator, owner, trusted team roles, and bot.
- Channel topics and panels contain only member-facing information; setup markers are kept out of the visible server UI.
- Do not post passwords, recovery codes, identity documents, bank details, or tax files in Discord.
- Keep the bot token only in `.env`; never commit it.
