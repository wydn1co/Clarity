import {
  Message,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
  ChannelType,
  Guild,
} from "discord.js";
import { loadConfig, saveConfig, updateConfig } from "../utils/serverConfig.js";
import { successEmbed, errorEmbed, modLogEmbed, warnEmbed } from "../utils/embeds.js";
import { addWarn, getUserWarns, clearWarns, removeWarn } from "../utils/warns.js";
import { startTime, formatUptime } from "../utils/uptime.js";

// ── Parsing helpers ──────────────────────────────────────────────────────────

function parseMention(str: string): string | null {
  const match = str?.match(/^<@!?(\d+)>$/);
  return match ? match[1] : null;
}

function parseChannelMention(str: string): string | null {
  const match = str?.match(/^<#(\d+)>$/);
  return match ? match[1] : null;
}

const DURATION_RE = /^(\d+)(s|m|h|d)$/i;

function isDuration(str: string): boolean {
  return DURATION_RE.test(str ?? "");
}

function parseDurationMs(str: string): number | null {
  const match = str.match(DURATION_RE);
  if (!match) return null;
  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const mult: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * mult[unit];
}

function parseDurationTimestamp(str: string): number | null {
  const ms = parseDurationMs(str);
  return ms !== null ? Date.now() + ms : null;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (sec > 0 || parts.length === 0) parts.push(`${sec}s`);
  return parts.join(" ");
}

function isAdmin(msg: Message): boolean {
  return msg.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
}

function isMod(msg: Message): boolean {
  return msg.member?.permissions.has(PermissionFlagsBits.ModerateMembers) ?? false;
}

async function denyPerm(msg: Message): Promise<void> {
  await msg.reply({ embeds: [errorEmbed("Permission Denied", "You do not have permission to use this command.")] });
}

async function fetchMember(guild: Guild, userId: string): Promise<GuildMember | null> {
  return guild.members.fetch(userId).catch(() => null);
}

// ── Command handlers ─────────────────────────────────────────────────────────

async function cmdHelp(msg: Message, prefix: string): Promise<void> {
  const uptime = formatUptime(Date.now() - startTime);
  await msg.reply({
    embeds: [
      {
        color: 0x2b2d31,
        title: "Command Reference",
        description: `All moderation commands require **Administrator** or **Moderate Members** permission.\nPrefix: \`${prefix}\` — Slash commands also available via \`/\``,
        fields: [
          {
            name: "Configuration",
            value: [
              `\`${prefix}setup prefix <p>\` — Set the bot prefix`,
              `\`${prefix}setup logchannel #channel\` — Set log channel`,
              `\`${prefix}setup jailchannel #channel\` — Set jail channel`,
              `\`${prefix}setup view\` — View server configuration`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "Information",
            value: [
              `\`${prefix}serverinfo\` — Detailed server information`,
              `\`${prefix}servercount\` — Bot statistics`,
              `\`${prefix}help\` — Display this message`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "Messaging",
            value: [
              `\`${prefix}say <message>\` — Send a message as the bot`,
              `\`${prefix}dm @user <message>\` — Direct message a user`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "Moderation",
            value: [
              `\`${prefix}warn @user <reason>\` — Warn a user`,
              `\`${prefix}warns @user\` — View a user's warnings`,
              `\`${prefix}warns remove @user <id>\` — Remove a warning`,
              `\`${prefix}warns clear @user\` — Clear all warnings`,
              `\`${prefix}timeout @user [duration] [reason]\` — Timeout a user`,
              `\`${prefix}untimeout @user [reason]\` — Remove timeout`,
              `\`${prefix}jail @user <reason> [duration]\` — Jail a user`,
              `\`${prefix}unjail @user [reason]\` — Release from jail`,
              `\`${prefix}tempkick @user <duration> <reason>\` — Temp kick`,
              `\`${prefix}tempban @user <duration> <reason>\` — Temp ban`,
              `\`${prefix}nuke [#channel]\` — Clear all messages in a channel`,
              `\`${prefix}lock [#channel] [reason]\` — Lock a channel`,
              `\`${prefix}unlock [#channel] [reason]\` — Unlock a channel`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "Duration Format",
            value: "`10s` = 10 seconds  `5m` = 5 minutes  `2h` = 2 hours  `1d` = 1 day",
            inline: false,
          },
        ],
        footer: { text: `Clarity  •  Uptime: ${uptime}` },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

async function cmdSay(msg: Message, args: string[]): Promise<void> {
  if (!isAdmin(msg)) { await denyPerm(msg); return; }
  const text = args.join(" ");
  if (!text) {
    await msg.reply({ embeds: [errorEmbed("Usage", "Provide a message to send.")] });
    return;
  }
  try {
    await msg.channel.send(text);
    await msg.delete().catch(() => {});
  } catch {
    await msg.reply({ embeds: [errorEmbed("Error", "Could not send the message.")] });
  }
}

async function cmdDm(msg: Message, args: string[]): Promise<void> {
  if (!isAdmin(msg)) { await denyPerm(msg); return; }
  const userId = parseMention(args[0]);
  if (!userId || args.length < 2) {
    await msg.reply({ embeds: [errorEmbed("Usage", "`dm @user <message>`")] });
    return;
  }
  const text = args.slice(1).join(" ");
  const target = await msg.guild!.members.fetch(userId).catch(() => null);
  if (!target) {
    await msg.reply({ embeds: [errorEmbed("Error", "User not found.")] });
    return;
  }
  try {
    await target.user.send({
      embeds: [{
        color: 0x5865f2,
        title: `Message from ${msg.guild!.name}`,
        description: text,
        footer: { text: `Sent by ${msg.author.tag}` },
        timestamp: new Date().toISOString(),
      }],
    });
    await msg.reply({ embeds: [successEmbed("Message Sent", `Direct message delivered to **${target.user.tag}**.`)] });
  } catch {
    await msg.reply({ embeds: [errorEmbed("Message Failed", `Could not DM **${target.user.tag}**. They may have DMs disabled.`)] });
  }
}

async function cmdWarn(msg: Message, args: string[]): Promise<void> {
  if (!isMod(msg)) { await denyPerm(msg); return; }
  if (!msg.guild || !msg.guildId) return;
  const userId = parseMention(args[0]);
  if (!userId || args.length < 2) {
    await msg.reply({ embeds: [errorEmbed("Usage", "`warn @user <reason>`")] });
    return;
  }
  const reason = args.slice(1).join(" ");
  const target = await fetchMember(msg.guild, userId);
  if (!target) {
    await msg.reply({ embeds: [errorEmbed("Error", "User not found.")] });
    return;
  }
  if (target.id === msg.author.id) {
    await msg.reply({ embeds: [errorEmbed("Error", "You cannot warn yourself.")] });
    return;
  }
  const warns = addWarn(msg.guildId, target.id, {
    reason,
    moderatorId: msg.author.id,
    timestamp: Date.now(),
  });
  try {
    await target.user.send({
      embeds: [{
        color: 0xfee75c,
        title: "Warning Issued",
        description: `You have received a warning in **${msg.guild.name}**.`,
        fields: [
          { name: "Reason", value: reason, inline: false },
          { name: "Warning Number", value: String(warns.length), inline: true },
          { name: "Issued By", value: msg.author.tag, inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    });
  } catch { /* DMs disabled */ }

  const config = loadConfig(msg.guildId);
  if (config.logChannelId) {
    const logCh = msg.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logCh) {
      await logCh.send({
        embeds: [modLogEmbed("Warning Issued", [
          { name: "User", value: `${target.user.tag} (${target.id})`, inline: true },
          { name: "Moderator", value: msg.author.tag, inline: true },
          { name: "Total Warnings", value: String(warns.length), inline: true },
          { name: "Reason", value: reason, inline: false },
        ], 0xfee75c)],
      });
    }
  }
  await msg.reply({
    embeds: [{
      color: 0xfee75c,
      title: "Warning Issued",
      description: `**${target.user.tag}** has been warned.`,
      fields: [
        { name: "Reason", value: reason, inline: false },
        { name: "Total Warnings", value: String(warns.length), inline: true },
        { name: "Warning ID", value: String(warns[warns.length - 1].id), inline: true },
      ],
      timestamp: new Date().toISOString(),
    }],
  });
}

async function cmdWarns(msg: Message, args: string[]): Promise<void> {
  if (!isMod(msg)) { await denyPerm(msg); return; }
  if (!msg.guild || !msg.guildId) return;

  const sub = args[0]?.toLowerCase();

  if (sub === "remove") {
    const userId = parseMention(args[1]);
    const warnId = parseInt(args[2]);
    if (!userId || isNaN(warnId)) {
      await msg.reply({ embeds: [errorEmbed("Usage", "`warns remove @user <id>`")] });
      return;
    }
    const target = await fetchMember(msg.guild, userId);
    if (!target) { await msg.reply({ embeds: [errorEmbed("Error", "User not found.")] }); return; }
    const removed = removeWarn(msg.guildId, target.id, warnId);
    if (!removed) {
      await msg.reply({ embeds: [errorEmbed("Not Found", `Warning #${warnId} not found for **${target.user.tag}**.`)] });
      return;
    }
    const remaining = getUserWarns(msg.guildId, target.id).length;
    await msg.reply({
      embeds: [{
        color: 0x57f287, title: "Warning Removed",
        description: `Warning **#${warnId}** removed from **${target.user.tag}**.\n**Remaining warnings:** ${remaining}`,
        timestamp: new Date().toISOString(),
      }],
    });
    return;
  }

  if (sub === "clear") {
    const userId = parseMention(args[1]);
    if (!userId) { await msg.reply({ embeds: [errorEmbed("Usage", "`warns clear @user`")] }); return; }
    const target = await fetchMember(msg.guild, userId);
    if (!target) { await msg.reply({ embeds: [errorEmbed("Error", "User not found.")] }); return; }
    const count = clearWarns(msg.guildId, target.id);
    await msg.reply({
      embeds: [{
        color: 0x57f287, title: "Warnings Cleared",
        description: `All **${count}** warning${count !== 1 ? "s" : ""} cleared from **${target.user.tag}**.`,
        timestamp: new Date().toISOString(),
      }],
    });
    return;
  }

  const userId = parseMention(sub) ?? parseMention(args[0]);
  if (!userId) {
    await msg.reply({ embeds: [errorEmbed("Usage", "`warns @user` — or `warns remove @user <id>` — or `warns clear @user`")] });
    return;
  }
  const target = await fetchMember(msg.guild, userId);
  if (!target) { await msg.reply({ embeds: [errorEmbed("Error", "User not found.")] }); return; }
  const warns = getUserWarns(msg.guildId, target.id);
  if (warns.length === 0) {
    await msg.reply({
      embeds: [{
        color: 0x2b2d31, title: "Warning Record",
        description: `**${target.user.tag}** has no warnings on record.`,
        timestamp: new Date().toISOString(),
      }],
    });
    return;
  }
  const warnList = warns.map((w) => {
    const date = new Date(w.timestamp).toLocaleDateString("en-GB");
    return `**[#${w.id}]** ${w.reason}\n— <@${w.moderatorId}> on ${date}`;
  }).join("\n\n");
  await msg.reply({
    embeds: [{
      color: 0xfee75c, title: "Warning Record",
      description: `**${target.user.tag}** — ${warns.length} warning${warns.length !== 1 ? "s" : ""}\n\n${warnList}`,
      footer: { text: `User ID: ${target.id}` },
      timestamp: new Date().toISOString(),
    }],
  });
}

async function cmdTimeout(msg: Message, args: string[]): Promise<void> {
  if (!isMod(msg)) { await denyPerm(msg); return; }
  if (!msg.guild || !msg.guildId) return;
  const userId = parseMention(args[0]);
  if (!userId) {
    await msg.reply({ embeds: [errorEmbed("Usage", "`timeout @user [duration] [reason]`")] });
    return;
  }
  const target = await fetchMember(msg.guild, userId);
  if (!target) { await msg.reply({ embeds: [errorEmbed("Error", "User not found.")] }); return; }
  if (target.id === msg.author.id) { await msg.reply({ embeds: [errorEmbed("Error", "You cannot timeout yourself.")] }); return; }
  if (!target.moderatable) { await msg.reply({ embeds: [errorEmbed("Permission Error", "I cannot timeout this user.")] }); return; }

  const MAX = 28 * 24 * 60 * 60 * 1000;
  let durationMs = MAX;
  let durationLabel = "Indefinite (28 days)";
  let reasonStart = 1;

  if (args[1] && isDuration(args[1])) {
    const parsed = parseDurationMs(args[1]);
    if (!parsed || parsed > MAX) {
      await msg.reply({ embeds: [errorEmbed("Invalid Duration", "Max duration is 28 days.")] });
      return;
    }
    durationMs = parsed;
    durationLabel = formatMs(durationMs);
    reasonStart = 2;
  }

  const reason = args.slice(reasonStart).join(" ") || "No reason provided";

  try {
    await target.timeout(durationMs, reason);
  } catch {
    await msg.reply({ embeds: [errorEmbed("Error", "Failed to timeout the user.")] });
    return;
  }

  const config = loadConfig(msg.guildId);
  if (config.logChannelId) {
    const logCh = msg.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logCh) {
      await logCh.send({
        embeds: [modLogEmbed("User Timed Out", [
          { name: "User", value: `${target.user.tag} (${target.id})`, inline: true },
          { name: "Moderator", value: msg.author.tag, inline: true },
          { name: "Duration", value: durationLabel, inline: true },
          { name: "Reason", value: reason, inline: false },
        ])],
      });
    }
  }

  await msg.reply({
    embeds: [successEmbed("User Timed Out", `**${target.user.tag}** has been timed out.\n\n**Duration:** ${durationLabel}\n**Reason:** ${reason}`)],
  });
}

async function cmdUntimeout(msg: Message, args: string[]): Promise<void> {
  if (!isMod(msg)) { await denyPerm(msg); return; }
  if (!msg.guild || !msg.guildId) return;
  const userId = parseMention(args[0]);
  if (!userId) {
    await msg.reply({ embeds: [errorEmbed("Usage", "`untimeout @user [reason]`")] });
    return;
  }
  const target = await fetchMember(msg.guild, userId);
  if (!target) { await msg.reply({ embeds: [errorEmbed("Error", "User not found.")] }); return; }
  if (!target.communicationDisabledUntil) {
    await msg.reply({ embeds: [errorEmbed("Not Timed Out", `**${target.user.tag}** does not have an active timeout.`)] });
    return;
  }
  const reason = args.slice(1).join(" ") || "No reason provided";
  try {
    await target.timeout(null, reason);
  } catch {
    await msg.reply({ embeds: [errorEmbed("Error", "Failed to remove the timeout.")] });
    return;
  }
  const config = loadConfig(msg.guildId);
  if (config.logChannelId) {
    const logCh = msg.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logCh) {
      await logCh.send({
        embeds: [modLogEmbed("Timeout Removed", [
          { name: "User", value: `${target.user.tag} (${target.id})`, inline: true },
          { name: "Moderator", value: msg.author.tag, inline: true },
          { name: "Reason", value: reason, inline: false },
        ], 0x57f287)],
      });
    }
  }
  await msg.reply({ embeds: [successEmbed("Timeout Removed", `**${target.user.tag}** has been released from timeout.\n\n**Reason:** ${reason}`)] });
}

async function cmdNuke(msg: Message, args: string[]): Promise<void> {
  if (!isAdmin(msg)) { await denyPerm(msg); return; }
  if (!msg.guild || !msg.guildId) return;
  const channelIdFromMention = args[0] ? parseChannelMention(args[0]) : null;
  const targetChannel = channelIdFromMention
    ? (msg.guild.channels.cache.get(channelIdFromMention) as TextChannel | undefined)
    : (msg.channel as TextChannel);
  if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
    await msg.reply({ embeds: [errorEmbed("Error", "Invalid channel.")] });
    return;
  }
  const inDifferentChannel = targetChannel.id !== msg.channel.id;
  if (!inDifferentChannel) await msg.delete().catch(() => {});
  try {
    const position = targetChannel.position;
    const newChannel = await targetChannel.clone({ reason: `Nuked by ${msg.author.tag}` });
    await newChannel.setPosition(position);
    await targetChannel.delete();
    await newChannel.send({
      embeds: [{
        color: 0xed4245, title: "Channel Nuked",
        description: `This channel was nuked by **${msg.author.tag}**.\nAll previous messages have been erased.`,
        timestamp: new Date().toISOString(),
      }],
    });
    const config = loadConfig(msg.guildId);
    if (config.logChannelId) {
      const logCh = msg.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
      if (logCh) {
        await logCh.send({
          embeds: [{
            color: 0xed4245, title: "Moderation — Channel Nuked",
            fields: [
              { name: "Moderator", value: `${msg.author.tag}`, inline: true },
              { name: "Channel", value: `<#${newChannel.id}>`, inline: true },
            ],
            timestamp: new Date().toISOString(),
          }],
        });
      }
    }
    if (inDifferentChannel) {
      await (msg.channel as TextChannel).send({ embeds: [successEmbed("Channel Nuked", `<#${newChannel.id}> has been nuked.`)] });
    }
  } catch (err) {
    await (msg.channel as TextChannel).send({ embeds: [errorEmbed("Nuke Failed", String(err))] });
  }
}

async function cmdJail(msg: Message, args: string[]): Promise<void> {
  if (!isAdmin(msg)) { await denyPerm(msg); return; }
  if (!msg.guild || !msg.guildId) return;
  const userId = parseMention(args[0]);
  if (!userId || args.length < 2) {
    await msg.reply({ embeds: [errorEmbed("Usage", "`jail @user <reason> [duration]`")] });
    return;
  }
  const config = loadConfig(msg.guildId);
  if (!config.jailChannelId) {
    await msg.reply({ embeds: [errorEmbed("Not Configured", "No jail channel set. Use `/setup jailchannel` first.")] });
    return;
  }
  const jailChannel = msg.guild.channels.cache.get(config.jailChannelId) as TextChannel | undefined;
  if (!jailChannel) {
    await msg.reply({ embeds: [errorEmbed("Error", "Jail channel not found.")] });
    return;
  }
  const target = await fetchMember(msg.guild, userId);
  if (!target) { await msg.reply({ embeds: [errorEmbed("Error", "User not found.")] }); return; }

  let rest = args.slice(1);
  let durationStr: string | null = null;
  if (rest.length > 1 && isDuration(rest[rest.length - 1])) {
    durationStr = rest.pop()!;
  }
  const reason = rest.join(" ") || "No reason provided";
  const expiresAt = durationStr ? parseDurationTimestamp(durationStr) : null;
  const durationLabel = expiresAt ? formatMs(expiresAt - Date.now()) : "Permanent";

  const originalRoles = target.roles.cache.filter((r) => r.id !== msg.guild!.id).map((r) => r.id);
  try { await target.roles.set([], `Jailed by ${msg.author.tag}: ${reason}`); } catch { /* ignore */ }

  for (const [, ch] of msg.guild.channels.cache) {
    if (ch.type === ChannelType.GuildText && ch.id !== config.jailChannelId) {
      try { await (ch as TextChannel).permissionOverwrites.create(target.id, { ViewChannel: false, SendMessages: false }); } catch { /* ignore */ }
    }
  }
  try {
    await jailChannel.permissionOverwrites.create(target.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
  } catch { /* ignore */ }

  const { saveConfig: sc } = await import("../utils/serverConfig.js");
  config.jails[target.id] = { userId: target.id, reason, moderatorId: msg.author.id, expiresAt, originalRoles, channelId: config.jailChannelId };
  sc(msg.guildId, config);

  if (config.logChannelId) {
    const logCh = msg.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logCh) {
      await logCh.send({
        embeds: [modLogEmbed("User Jailed", [
          { name: "User", value: `${target.user.tag} (${target.id})`, inline: true },
          { name: "Moderator", value: msg.author.tag, inline: true },
          { name: "Duration", value: durationLabel, inline: true },
          { name: "Reason", value: reason, inline: false },
        ])],
      });
    }
  }
  await msg.reply({ embeds: [successEmbed("User Jailed", `**${target.user.tag}** has been confined to ${jailChannel}.\n\n**Duration:** ${durationLabel}\n**Reason:** ${reason}`)] });
}

async function cmdUnjail(msg: Message, args: string[]): Promise<void> {
  if (!isAdmin(msg)) { await denyPerm(msg); return; }
  if (!msg.guild || !msg.guildId) return;
  const userId = parseMention(args[0]);
  if (!userId) {
    await msg.reply({ embeds: [errorEmbed("Usage", "`unjail @user [reason]`")] });
    return;
  }
  const config = loadConfig(msg.guildId);
  const jailEntry = config.jails[userId];
  if (!jailEntry) {
    await msg.reply({ embeds: [errorEmbed("Not Jailed", "This user does not have a jail record.")] });
    return;
  }
  const target = await fetchMember(msg.guild, userId);
  if (!target) { await msg.reply({ embeds: [errorEmbed("Error", "User not found.")] }); return; }
  const reason = args.slice(1).join(" ") || "No reason provided";

  for (const [, ch] of msg.guild.channels.cache) {
    if (ch.isTextBased()) {
      try { await (ch as any).permissionOverwrites.delete(userId); } catch { /* ignore */ }
    }
  }
  if (jailEntry.originalRoles.length > 0) {
    const validRoles = jailEntry.originalRoles.filter((id) => msg.guild!.roles.cache.has(id));
    await target.roles.set(validRoles, `Unjailed by ${msg.author.tag}`).catch(() => {});
  }
  delete config.jails[userId];
  saveConfig(msg.guildId, config);

  if (config.logChannelId) {
    const logCh = msg.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logCh) {
      await logCh.send({
        embeds: [modLogEmbed("User Released from Jail", [
          { name: "User", value: `${target.user.tag} (${target.id})`, inline: true },
          { name: "Moderator", value: msg.author.tag, inline: true },
          { name: "Reason", value: reason, inline: false },
        ], 0x57f287)],
      });
    }
  }
  await msg.reply({ embeds: [successEmbed("User Released", `**${target.user.tag}** has been released from jail.\n\n**Reason:** ${reason}`)] });
}

async function cmdTempban(msg: Message, args: string[]): Promise<void> {
  if (!isAdmin(msg)) { await denyPerm(msg); return; }
  if (!msg.guild || !msg.guildId) return;
  const userId = parseMention(args[0]);
  if (!userId || args.length < 3) {
    await msg.reply({ embeds: [errorEmbed("Usage", "`tempban @user <duration> <reason>`")] });
    return;
  }
  const durationStr = args[1];
  if (!isDuration(durationStr)) {
    await msg.reply({ embeds: [errorEmbed("Invalid Duration", "Provide a valid duration as the second argument (e.g. `1d`, `2h`).")] });
    return;
  }
  const reason = args.slice(2).join(" ");
  const target = await fetchMember(msg.guild, userId);
  if (!target) { await msg.reply({ embeds: [errorEmbed("Error", "User not found.")] }); return; }
  const expiresAt = parseDurationTimestamp(durationStr)!;
  const durationLabel = formatMs(expiresAt - Date.now());

  try {
    await target.ban({ reason: `Temp ban by ${msg.author.tag}: ${reason}` });
  } catch {
    await msg.reply({ embeds: [errorEmbed("Error", "Failed to ban this user.")] });
    return;
  }

  const config = loadConfig(msg.guildId);
  config.tempBans[userId] = { userId, reason, moderatorId: msg.author.id, expiresAt };
  saveConfig(msg.guildId, config);

  if (config.logChannelId) {
    const logCh = msg.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logCh) {
      await logCh.send({
        embeds: [modLogEmbed("User Temp Banned", [
          { name: "User", value: `${target.user.tag} (${target.id})`, inline: true },
          { name: "Moderator", value: msg.author.tag, inline: true },
          { name: "Duration", value: durationLabel, inline: true },
          { name: "Reason", value: reason, inline: false },
        ])],
      });
    }
  }
  await msg.reply({ embeds: [successEmbed("User Temp Banned", `**${target.user.tag}** has been banned.\n\n**Duration:** ${durationLabel}\n**Reason:** ${reason}`)] });
}

async function cmdTempkick(msg: Message, args: string[]): Promise<void> {
  if (!isAdmin(msg)) { await denyPerm(msg); return; }
  if (!msg.guild || !msg.guildId) return;
  const userId = parseMention(args[0]);
  if (!userId || args.length < 3) {
    await msg.reply({ embeds: [errorEmbed("Usage", "`tempkick @user <duration> <reason>`")] });
    return;
  }
  const durationStr = args[1];
  if (!isDuration(durationStr)) {
    await msg.reply({ embeds: [errorEmbed("Invalid Duration", "Provide a valid duration as the second argument.")] });
    return;
  }
  const reason = args.slice(2).join(" ");
  const target = await fetchMember(msg.guild, userId);
  if (!target) { await msg.reply({ embeds: [errorEmbed("Error", "User not found.")] }); return; }
  const durationLabel = formatMs(parseDurationMs(durationStr)!);

  try {
    await target.kick(`Temp kick by ${msg.author.tag}: ${reason}`);
  } catch {
    await msg.reply({ embeds: [errorEmbed("Error", "Failed to kick this user.")] });
    return;
  }

  const config = loadConfig(msg.guildId);
  if (config.logChannelId) {
    const logCh = msg.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logCh) {
      await logCh.send({
        embeds: [modLogEmbed("User Temp Kicked", [
          { name: "User", value: `${target.user.tag} (${target.id})`, inline: true },
          { name: "Moderator", value: msg.author.tag, inline: true },
          { name: "Duration", value: durationLabel, inline: true },
          { name: "Reason", value: reason, inline: false },
        ])],
      });
    }
  }
  await msg.reply({ embeds: [successEmbed("User Kicked", `**${target.user.tag}** has been kicked.\n\n**Suggested stay-out:** ${durationLabel}\n**Reason:** ${reason}`)] });
}

async function cmdLock(msg: Message, args: string[], unlock: boolean): Promise<void> {
  if (!isAdmin(msg)) { await denyPerm(msg); return; }
  if (!msg.guild || !msg.guildId) return;
  const channelId = args[0] ? parseChannelMention(args[0]) : null;
  const targetChannel = channelId
    ? (msg.guild.channels.cache.get(channelId) as TextChannel | undefined)
    : (msg.channel as TextChannel);
  if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
    await msg.reply({ embeds: [errorEmbed("Error", "Invalid channel.")] });
    return;
  }
  const reason = args.slice(channelId ? 1 : 0).join(" ") || (unlock ? "Channel unlocked" : "Channel locked");
  const everyoneRole = msg.guild.roles.everyone;
  const config = loadConfig(msg.guildId);

  try {
    if (unlock) {
      await targetChannel.permissionOverwrites.edit(everyoneRole, { SendMessages: null, AddReactions: null });
      config.lockedChannels = config.lockedChannels.filter((id) => id !== targetChannel.id);
    } else {
      await targetChannel.permissionOverwrites.edit(everyoneRole, { SendMessages: false, AddReactions: false });
      if (!config.lockedChannels.includes(targetChannel.id)) config.lockedChannels.push(targetChannel.id);
    }
    saveConfig(msg.guildId, config);
  } catch {
    await msg.reply({ embeds: [errorEmbed("Error", `I do not have permission to ${unlock ? "un" : ""}lock this channel.`)] });
    return;
  }

  await targetChannel.send({
    embeds: [{
      color: unlock ? 0x57f287 : 0xed4245,
      title: unlock ? "Channel Unlocked" : "Channel Locked",
      description: `This channel has been ${unlock ? "unlocked" : "locked"} by <@${msg.author.id}>.\nReason: ${reason}`,
      timestamp: new Date().toISOString(),
    }],
  });

  if (config.logChannelId) {
    const logCh = msg.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logCh) {
      await logCh.send({
        embeds: [modLogEmbed(unlock ? "Channel Unlocked" : "Channel Locked", [
          { name: "Channel", value: `<#${targetChannel.id}>`, inline: true },
          { name: "Moderator", value: msg.author.tag, inline: true },
          { name: "Reason", value: reason, inline: false },
        ], unlock ? 0x57f287 : 0xed4245)],
      });
    }
  }

  if (targetChannel.id !== msg.channel.id) {
    await msg.reply({ embeds: [successEmbed(unlock ? "Channel Unlocked" : "Channel Locked", `<#${targetChannel.id}> has been ${unlock ? "unlocked" : "locked"}.\n**Reason:** ${reason}`)] });
  }
}

async function cmdSetup(msg: Message, args: string[]): Promise<void> {
  if (!isAdmin(msg)) { await denyPerm(msg); return; }
  if (!msg.guildId) return;
  const sub = args[0]?.toLowerCase();

  if (sub === "prefix") {
    const newPrefix = args[1];
    if (!newPrefix || newPrefix.length > 5) {
      await msg.reply({ embeds: [errorEmbed("Usage", "`setup prefix <new_prefix>` (max 5 characters)")] });
      return;
    }
    updateConfig(msg.guildId, { prefix: newPrefix });
    await msg.reply({ embeds: [successEmbed("Prefix Updated", `Bot prefix has been set to \`${newPrefix}\``)] });
  } else if (sub === "logchannel") {
    const channelId = parseChannelMention(args[1]);
    if (!channelId) { await msg.reply({ embeds: [errorEmbed("Usage", "`setup logchannel #channel`")] }); return; }
    updateConfig(msg.guildId, { logChannelId: channelId });
    await msg.reply({ embeds: [successEmbed("Log Channel Set", `Moderation logs will be sent to <#${channelId}>`)] });
  } else if (sub === "jailchannel") {
    const channelId = parseChannelMention(args[1]);
    if (!channelId) { await msg.reply({ embeds: [errorEmbed("Usage", "`setup jailchannel #channel`")] }); return; }
    updateConfig(msg.guildId, { jailChannelId: channelId });
    await msg.reply({ embeds: [successEmbed("Jail Channel Set", `Jailed users will be confined to <#${channelId}>`)] });
  } else if (sub === "view") {
    const config = loadConfig(msg.guildId);
    const logCh = config.logChannelId ? `<#${config.logChannelId}>` : "Not configured";
    const jailCh = config.jailChannelId ? `<#${config.jailChannelId}>` : "Not configured";
    await msg.reply({
      embeds: [{
        color: 0x2b2d31, title: "Server Configuration",
        fields: [
          { name: "Prefix", value: `\`${config.prefix}\``, inline: true },
          { name: "Log Channel", value: logCh, inline: true },
          { name: "Jail Channel", value: jailCh, inline: true },
          { name: "Active Jails", value: String(Object.keys(config.jails).length), inline: true },
          { name: "Locked Channels", value: String(config.lockedChannels.length), inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    });
  } else {
    await msg.reply({ embeds: [errorEmbed("Usage", "`setup prefix <p>` | `setup logchannel #ch` | `setup jailchannel #ch` | `setup view`")] });
  }
}

async function cmdServerinfo(msg: Message): Promise<void> {
  if (!msg.guild) return;
  await msg.guild.members.fetch();
  const owner = await msg.guild.fetchOwner().catch(() => null);
  const textChannels = msg.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
  const voiceChannels = msg.guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
  const categoryChannels = msg.guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size;
  const roles = msg.guild.roles.cache.size - 1;
  const bots = msg.guild.members.cache.filter((m) => m.user.bot).size;
  const humans = msg.guild.memberCount - bots;
  const boostLevel = msg.guild.premiumTier;
  const boostCount = msg.guild.premiumSubscriptionCount ?? 0;
  const createdAt = Math.floor(msg.guild.createdTimestamp / 1000);
  const verificationLevel = ["None", "Low", "Medium", "High", "Very High"][msg.guild.verificationLevel] ?? "Unknown";
  await msg.reply({
    embeds: [{
      color: 0x2b2d31,
      title: msg.guild.name,
      thumbnail: msg.guild.iconURL() ? { url: msg.guild.iconURL()! } : undefined,
      fields: [
        { name: "Server ID", value: msg.guild.id, inline: true },
        { name: "Owner", value: owner ? owner.user.tag : "Unknown", inline: true },
        { name: "Created", value: `<t:${createdAt}:D>`, inline: true },
        { name: "Members", value: `${msg.guild.memberCount.toLocaleString()} total\n${humans.toLocaleString()} humans / ${bots} bots`, inline: true },
        { name: "Channels", value: `${msg.guild.channels.cache.size} total\n${textChannels} text / ${voiceChannels} voice / ${categoryChannels} categories`, inline: true },
        { name: "Roles", value: String(roles), inline: true },
        { name: "Emojis", value: String(msg.guild.emojis.cache.size), inline: true },
        { name: "Verification", value: verificationLevel, inline: true },
        { name: "Boosts", value: `Level ${boostLevel} — ${boostCount} boosts`, inline: true },
      ],
      footer: { text: `Requested by ${msg.author.tag}` },
      timestamp: new Date().toISOString(),
    }],
  });
}

async function cmdServercount(msg: Message, client: import("discord.js").Client): Promise<void> {
  const totalServers = client.guilds.cache.size;
  let totalMembers = 0;
  for (const [, guild] of client.guilds.cache) {
    totalMembers += guild.memberCount;
  }
  await msg.reply({
    embeds: [{
      color: 0x2b2d31, title: "Bot Statistics",
      fields: [
        { name: "Servers", value: totalServers.toLocaleString(), inline: true },
        { name: "Total Members", value: totalMembers.toLocaleString(), inline: true },
      ],
      timestamp: new Date().toISOString(),
    }],
  });
}

// ── Main dispatcher ──────────────────────────────────────────────────────────

export async function handlePrefixMessage(
  msg: Message,
  client: import("discord.js").Client
): Promise<void> {
  if (msg.author.bot || !msg.guild || !msg.guildId) return;

  const config = loadConfig(msg.guildId);
  const prefix = config.prefix;

  if (!msg.content.startsWith(prefix)) return;

  const content = msg.content.slice(prefix.length).trim();
  if (!content) return;

  const args = content.split(/\s+/);
  const command = args.shift()!.toLowerCase();

  try {
    switch (command) {
      case "help":       await cmdHelp(msg, prefix); break;
      case "say":        await cmdSay(msg, args); break;
      case "dm":         await cmdDm(msg, args); break;
      case "warn":       await cmdWarn(msg, args); break;
      case "warns":      await cmdWarns(msg, args); break;
      case "timeout":    await cmdTimeout(msg, args); break;
      case "untimeout":  await cmdUntimeout(msg, args); break;
      case "nuke":       await cmdNuke(msg, args); break;
      case "jail":       await cmdJail(msg, args); break;
      case "unjail":     await cmdUnjail(msg, args); break;
      case "tempban":    await cmdTempban(msg, args); break;
      case "tempkick":   await cmdTempkick(msg, args); break;
      case "lock":       await cmdLock(msg, args, false); break;
      case "unlock":     await cmdLock(msg, args, true); break;
      case "setup":      await cmdSetup(msg, args); break;
      case "serverinfo": await cmdServerinfo(msg); break;
      case "servercount": await cmdServercount(msg, client); break;
    }
  } catch (err) {
    console.error(`[prefix:${command}] Error:`, err);
    await msg.reply({ embeds: [errorEmbed("Error", "An error occurred while running this command.")] }).catch(() => {});
  }
}
