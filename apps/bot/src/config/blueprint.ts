import { PermissionFlagsBits, type PermissionResolvable } from "discord.js";

export type RoleKey = "admin" | "manager" | "moderator" | "creator" | "member" | "applicant";

export type ChannelAccess = "everyone" | "member" | "creator" | "team";
export type BlueprintChannelType = "text" | "announcement" | "forum" | "voice" | "stage";

export interface RoleBlueprint {
  key: RoleKey;
  name: string;
  color: number;
  hoist?: boolean;
  mentionable?: boolean;
  permissions: PermissionResolvable[];
}

export interface ChannelBlueprint {
  key: string;
  name: string;
  type: BlueprintChannelType;
  access: ChannelAccess;
  readOnly?: boolean;
  topic?: string;
  slowmode?: number;
  tags?: string[];
}

export interface CategoryBlueprint {
  name: string;
  channels: ChannelBlueprint[];
}

export const roles: RoleBlueprint[] = [
  {
    key: "admin",
    name: "Admin",
    color: 0xed4245,
    hoist: true,
    permissions: [PermissionFlagsBits.Administrator],
  },
  {
    key: "manager",
    name: "UGC Manager",
    color: 0x5865f2,
    hoist: true,
    permissions: [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageThreads,
    ],
  },
  {
    key: "moderator",
    name: "Moderator",
    color: 0x57f287,
    hoist: true,
    permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads],
  },
  { key: "creator", name: "Verified Creator", color: 0xfee75c, hoist: true, permissions: [] },
  { key: "member", name: "Member", color: 0x95a5a6, permissions: [] },
  { key: "applicant", name: "Applicant", color: 0x3498db, permissions: [] },
];

export const categories: CategoryBlueprint[] = [
  {
    name: "START HERE",
    channels: [
      {
        key: "verify",
        name: "verify",
        type: "text",
        access: "everyone",
        readOnly: true,
        topic: "Read #rules, then verify to access the UGC server.",
      },
    ],
  },
  {
    name: "UGC",
    channels: [
      {
        key: "announcements",
        name: "announcements",
        type: "text",
        access: "member",
        readOnly: true,
        topic: "Official UGC updates and announcements.",
      },
      {
        key: "faq",
        name: "faq",
        type: "text",
        access: "member",
        readOnly: true,
        topic: "Answers to common creator questions.",
      },
      {
        key: "resources",
        name: "resources",
        type: "text",
        access: "member",
        readOnly: true,
        topic: "Creator resources, templates, and useful links.",
      },
      {
        key: "general",
        name: "general",
        type: "text",
        access: "member",
        topic: "General UGC discussion.",
      },
      {
        key: "wins",
        name: "wins",
        type: "text",
        access: "member",
        topic: "Share approvals, milestones, and wins.",
      },
      {
        key: "accounts",
        name: "accounts",
        type: "text",
        access: "creator",
        topic: "Creator-only account and platform coordination. Never post passwords or recovery codes.",
      },
    ],
  },
  {
    name: "TEAM",
    channels: [
      {
        key: "approved-content",
        name: "approved-content",
        type: "text",
        access: "team",
        readOnly: true,
        topic: "Private archive of approved creator submissions.",
      },
      {
        key: "onboarding-alerts",
        name: "onboarding-alerts",
        type: "text",
        access: "team",
        topic: "Private creator applications and onboarding updates.",
      },
    ],
  },
  {
    name: "CREATORS",
    channels: [],
  },
];

export const blueprintChannels = categories.flatMap((category) => category.channels);
