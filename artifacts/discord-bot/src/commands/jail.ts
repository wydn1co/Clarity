import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
  ChannelType,
  PermissionOverwrites,
} from "discord.js";
import { loadConfig, saveConfig, JailEntry } from "../utils/serverConfig.js";
import { errorEmbed, successEmbed, modLogEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("jail")
  .setDescription("⛓️ Jail a user — confine them to the jail channel only")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The user to jail").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for jailing").setRequired(true).setMaxLength(1000)
  )
  .addStringOption((opt) =>
    opt
      .setName("duration")
      .setDescription("Duration (e.g. 10m, 2h, 1d) — leave blank for permanent")
      .setRequired(false)
  );

function parseDuration(dur: string): number | null {
  const match = dur.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return Date.now() + amount * multipliers[unit];
}

function formatDuration(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return "expired";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed("Error", "Server only.")], ephemeral: true });
    return;
  }

  const target = interaction.options.getMember("user") as GuildMember;
  const reason = interaction.options.getString("reason", true);
  const durationStr = interaction.options.getString("duration");

  if (!target) {
    await interaction.reply({ embeds: [errorEmbed("Error", "User not found in this server.")], ephemeral: true });
    return;
  }

  const config = loadConfig(interaction.guildId);

  if (!config.jailChannelId) {
    await interaction.reply({
      embeds: [errorEmbed("Not Configured", "No jail channel set. Use `/setup jailchannel` first.")],
      ephemeral: true,
    });
    return;
  }

  const jailChannel = interaction.guild.channels.cache.get(config.jailChannelId) as TextChannel | undefined;
  if (!jailChannel) {
    await interaction.reply({
      embeds: [errorEmbed("Error", "Jail channel not found. Please reconfigure with `/setup jailchannel`.")],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  // Save original roles
  const originalRoles = target.roles.cache
    .filter((r) => r.id !== interaction.guild!.id)
    .map((r) => r.id);

  // Remove all roles
  try {
    await target.roles.set([], `Jailed by ${interaction.user.tag}: ${reason}`);
  } catch {
    // Continue even if we can't remove roles
  }

  // Deny view permission on all text channels
  const allChannels = interaction.guild.channels.cache.filter(
    (ch) => ch.type === ChannelType.GuildText && ch.id !== config.jailChannelId
  );

  for (const [, ch] of allChannels) {
    try {
      await (ch as TextChannel).permissionOverwrites.create(target.id, {
        ViewChannel: false,
        SendMessages: false,
      });
    } catch {
      // ignore permission errors on some channels
    }
  }

  // Allow jailed user to see and send in jail channel only
  try {
    await jailChannel.permissionOverwrites.create(target.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
  } catch {
    // ignore
  }

  const expiresAt = durationStr ? parseDuration(durationStr) : null;

  const jailEntry: JailEntry = {
    userId: target.id,
    reason,
    moderatorId: interaction.user.id,
    expiresAt,
    originalRoles,
    channelId: config.jailChannelId,
  };

  config.jails[target.id] = jailEntry;
  saveConfig(interaction.guildId, config);

  const durationDisplay = expiresAt
    ? `⏱️ ${formatDuration(expiresAt)}`
    : "♾️ Permanent";

  // Notify jailed user
  try {
    await target.user.send({
      embeds: [
        {
          color: 0xed4245,
          title: `⛓️ You have been jailed in **${interaction.guild.name}**`,
          fields: [
            { name: "📋 Reason", value: reason, inline: false },
            { name: "⏱️ Duration", value: durationDisplay, inline: true },
            { name: "👮 Moderator", value: interaction.user.tag, inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch {
    // DMs disabled
  }

  // Log to log channel
  if (config.logChannelId) {
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logChannel) {
      await logChannel.send({
        embeds: [
          modLogEmbed("Member Jailed", [
            { name: "👤 User", value: `<@${target.id}> (${target.user.tag})`, inline: true },
            { name: "👮 Moderator", value: `<@${interaction.user.id}>`, inline: true },
            { name: "⏱️ Duration", value: durationDisplay, inline: true },
            { name: "📋 Reason", value: reason, inline: false },
            { name: "🔒 Jail Channel", value: `<#${config.jailChannelId}>`, inline: true },
          ], 0xed4245),
        ],
      });
    }
  }

  await interaction.editReply({
    embeds: [
      {
        color: 0xed4245,
        title: "⛓️ User Jailed",
        fields: [
          { name: "👤 User", value: `<@${target.id}> (${target.user.tag})`, inline: true },
          { name: "⏱️ Duration", value: durationDisplay, inline: true },
          { name: "📋 Reason", value: reason, inline: false },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
