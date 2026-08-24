import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

const staff = PermissionFlagsBits.ManageMessages;
const admin = PermissionFlagsBits.ManageGuild;
const statuses = [
  { name: "Pending", value: "pending" },
  { name: "Approved", value: "approved" },
  { name: "Needs revision", value: "revision" },
  { name: "Rejected", value: "rejected" },
  { name: "Posted", value: "posted" },
] as const;

export const commandBuilders = [
  new SlashCommandBuilder()
    .setName("add-creator")
    .setDescription("Add a creator and create their private channel")
    .addUserOption((option) => option.setName("member").setDescription("Creator to add").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("delete-creator")
    .setDescription("Kick a creator from Discord and delete their private channel")
    .addUserOption((option) => option.setName("member").setDescription("Creator whose private channel should be deleted").setRequired(true))
    .addBooleanOption((option) => option.setName("confirm").setDescription("Confirm permanent channel deletion").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("creator-review")
    .setDescription("View or update a private creator review")
    .addUserOption((option) => option.setName("creator").setDescription("Creator to review").setRequired(true))
    .addStringOption((option) => option.setName("note").setDescription("Append a private staff note"))
    .addStringOption((option) => option.setName("next_steps").setDescription("Replace the private next-steps plan"))
    .addStringOption((option) => option.setName("status").setDescription("Override the review status").addChoices(
      { name: "Active", value: "active" }, { name: "Watch", value: "watch" }, { name: "Inactive", value: "inactive" },
    ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("creator-assign")
    .setDescription("Link a Discord member to a Launchpoint creator")
    .addUserOption((option) => option.setName("discord_member").setDescription("Discord member").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("issue-link")
    .setDescription("Issue a tracked Dub link to a creator")
    .addStringOption((option) => option.setName("url").setDescription("Optional HTTPS destination; defaults to result.dev"))
    .addUserOption((option) => option.setName("creator").setDescription("Optional; inferred from the private channel"))
    .addStringOption((option) => option.setName("campaign").setDescription("Campaign or brief name"))
    .addStringOption((option) => option.setName("partner_id").setDescription("Dub partner ID, if applicable"))
    .addStringOption((option) => option.setName("key").setDescription("Optional Dub short-link slug"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("delete-link")
    .setDescription("Delete a Dub link issued to a creator")
    .addStringOption((option) => option.setName("link").setDescription("Choose a saved active Dub link").setRequired(true).setAutocomplete(true))
    .addBooleanOption((option) => option.setName("confirm").setDescription("Confirm permanent deletion in Dub").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("launchpoint")
    .setDescription("View Launchpoint creators, contracts, programs, analytics, and payouts")
    .addSubcommand((subcommand) => subcommand
      .setName("creators")
      .setDescription("Browse creators and contract status")
      .addStringOption((option) => option.setName("search").setDescription("Search creator name or social handle"))
      .addStringOption((option) => option.setName("program_id").setDescription("Filter by program ID")))
    .addSubcommand((subcommand) => subcommand
      .setName("contracts")
      .setDescription("Browse creator contracts")
      .addStringOption((option) => option.setName("status").setDescription("Filter by contract status").addChoices(
        { name: "Pending", value: "pending" }, { name: "Active", value: "active" }, { name: "Completed", value: "completed" },
        { name: "Declined", value: "declined" }, { name: "Cancelled", value: "cancelled" },
      ))
      .addStringOption((option) => option.setName("creator_id").setDescription("Filter by Launchpoint creator ID"))
      .addStringOption((option) => option.setName("program_id").setDescription("Filter by program ID")))
    .addSubcommand((subcommand) => subcommand
      .setName("programs")
      .setDescription("Browse Launchpoint programs")
      .addStringOption((option) => option.setName("status").setDescription("Filter by program status").addChoices(
        { name: "Draft", value: "draft" }, { name: "Active", value: "active" }, { name: "Paused", value: "paused" },
        { name: "Completed", value: "completed" }, { name: "Archived", value: "archived" },
      ))
      .addStringOption((option) => option.setName("search").setDescription("Search program name")))
    .addSubcommand((subcommand) => subcommand.setName("kpis").setDescription("View Launchpoint KPI totals"))
    .addSubcommand((subcommand) => subcommand
      .setName("leaderboard")
      .setDescription("View a program's all-time creator leaderboard")
      .addStringOption((option) => option.setName("program_id").setDescription("Launchpoint program ID").setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName("payouts")
      .setDescription("View pending creator payouts")
      .addStringOption((option) => option.setName("creator_id").setDescription("Filter by Launchpoint creator ID"))
      .addStringOption((option) => option.setName("program_id").setDescription("Filter by program ID")))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("group-call")
    .setDescription("Post a weekly group-call availability poll")
    .addStringOption((option) => option.setName("week_start").setDescription("Monday in YYYY-MM-DD; defaults to this week"))
    .addStringOption((option) => option.setName("base_timezone").setDescription("Timezone used for the candidate window").addChoices(
      { name: "Eastern", value: "est" }, { name: "Pacific", value: "pst" }, { name: "India", value: "ist" },
    ))
    .addIntegerOption((option) => option.setName("duration").setDescription("Call length").addChoices(
      { name: "30 minutes", value: 30 }, { name: "45 minutes", value: 45 }, { name: "60 minutes", value: 60 },
    ))
    .setDefaultMemberPermissions(staff)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("group-call-results")
    .setDescription("Show the best times from the latest group-call poll")
    .setDefaultMemberPermissions(staff)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("group-call-reset")
    .setDescription("Clear responses from the latest group-call poll")
    .addBooleanOption((option) => option.setName("confirm").setDescription("Confirm clearing this week's responses").setRequired(true))
    .setDefaultMemberPermissions(staff)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("export")
    .setDescription("Export creators and submissions as CSV")
    .setDefaultMemberPermissions(admin)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("health")
    .setDescription("Check Result Clanker's permissions and setup")
    .setDefaultMemberPermissions(admin)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("creator-progress")
    .setDescription("Post the current weekly Launchpoint creator progress")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show Result Clanker's command guide")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show creators ranked by approved and posted work")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("mark")
    .setDescription("Update a submission's status")
    .addStringOption((option) => option.setName("submission").setDescription("Submission ID").setRequired(true))
    .addStringOption((option) => option.setName("status").setDescription("New status").setRequired(true).addChoices(...statuses))
    .addStringOption((option) => option.setName("published_url").setDescription("Live post URL when status is Posted"))
    .setDefaultMemberPermissions(staff)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("onboarding-sessions")
    .setDescription("Show recent verification and onboarding activity")
    .setDefaultMemberPermissions(staff)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("posting-status")
    .setDescription("Show weekly creator submission progress against quota")
    .setDefaultMemberPermissions(staff)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("program-remove")
    .setDescription("Remove saved program data without deleting Discord channels")
    .addBooleanOption((option) => option.setName("confirm").setDescription("Confirm removal of saved program data").setRequired(true))
    .setDefaultMemberPermissions(admin)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("programs")
    .setDescription("Show this server's UGC program")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("quickstart")
    .setDescription("Set the program name and repair the server layout")
    .addStringOption((option) => option.setName("name").setDescription("Program name"))
    .setDefaultMemberPermissions(admin)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("refresh-metrics")
    .setDescription("Refresh creator and submission totals")
    .setDefaultMemberPermissions(staff)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("reminders")
    .setDescription("Turn the daily reminder digest on or off")
    .addBooleanOption((option) => option.setName("enabled").setDescription("Reminder state").setRequired(true))
    .setDefaultMemberPermissions(admin)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("reset-onboarding")
    .setDescription("Reset a creator's roles and private-channel access")
    .addUserOption((option) => option.setName("member").setDescription("Creator to reset").setRequired(true))
    .setDefaultMemberPermissions(admin)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("set-key")
    .setDescription("Show secure metrics API key setup instructions")
    .setDefaultMemberPermissions(admin)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("set-quota")
    .setDescription("Set the weekly submission quota")
    .addIntegerOption((option) => option.setName("posts").setDescription("Submissions per creator per week").setMinValue(0).setMaxValue(100).setRequired(true))
    .setDefaultMemberPermissions(admin)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("set-trial")
    .setDescription("Set the creator trial period; 0 turns it off")
    .addIntegerOption((option) => option.setName("days").setDescription("Trial length in days").setMinValue(0).setMaxValue(365).setRequired(true))
    .setDefaultMemberPermissions(admin)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Create or repair the compact UGC server layout")
    .setDefaultMemberPermissions(admin)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("setup-onboarding")
    .setDescription("Repair the verification panel and onboarding settings")
    .setDefaultMemberPermissions(admin)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("submissions")
    .setDescription("List recent UGC submissions")
    .addUserOption((option) => option.setName("creator").setDescription("Filter by creator"))
    .addStringOption((option) => option.setName("status").setDescription("Filter by status").addChoices(...statuses))
    .setDefaultMemberPermissions(staff)
    .setDMPermission(false),
] as const;

const retiredCommandNames = new Set([
  "export", "leaderboard", "mark", "onboarding-sessions", "posting-status", "program-remove", "programs",
  "quickstart", "refresh-metrics", "reminders", "reset-onboarding", "set-key", "set-quota", "set-trial",
  "setup-onboarding", "submissions",
]);

export const commandData = commandBuilders.filter((command) => !retiredCommandNames.has(command.name)).map((command) => command.toJSON());
