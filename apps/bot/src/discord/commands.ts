import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

const staff = PermissionFlagsBits.ManageMessages;
const admin = PermissionFlagsBits.ManageGuild;

const commandBuilders = [
  new SlashCommandBuilder()
    .setName("add-creator")
    .setDescription("Add a creator and create their private channel")
    .addUserOption((option) => option.setName("member").setDescription("Creator to add").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("delete-creator")
    .setDescription("Offboard a creator and preserve their channel in the staff archive")
    .addUserOption((option) => option.setName("member").setDescription("Creator to offboard").setRequired(true))
    .addBooleanOption((option) => option.setName("confirm").setDescription("Confirm access removal, archival, and kick").setRequired(true))
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
    .setName("warmup")
    .setDescription("Start or restart the creator's warmup in this private channel")
    .addIntegerOption((option) => option
      .setName("days")
      .setDescription("Warmup length; defaults to 3 days")
      .setMinValue(1)
      .setMaxValue(90))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("warmup-details")
    .setDescription("Show every creator currently in warmup")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show Result Clanker's command guide")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("scripts")
    .setDescription("See the scripts assigned to you")
    .addUserOption((option) => option.setName("creator").setDescription("Staff only: look up another creator's scripts"))
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Create or repair the compact UGC server layout")
    .setDefaultMemberPermissions(admin)
    .setDMPermission(false),
] as const;

export const commandData = commandBuilders.map((command) => command.toJSON());
