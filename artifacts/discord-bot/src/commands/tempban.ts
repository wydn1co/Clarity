import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
} from "discord.js";
import { loadConfig, saveConfig, TempBanEntry } from "../utils/serverConfig.js";
import { errorEmbed, successEmbed, modLogEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("tempban")
  .setDescription("🔨 Temporarily ban a user from the server")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The user to temp ban").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for the ban").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("duration")
      .setDescription("Ban duration (e.g. 10m, 2h, 1d, 7d)")
      .setRequired(true)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("delete_messages")
      .setDescription("Delete messages from the past N days (0-7)")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(7)
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

function formatDuration(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "expired";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed("Error", "Server only.")], ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const targetMember = interaction.options.getMember("user") as GuildMember | null;
  const reason = interaction.options.getString("reason", true);
  const durationStr = interaction.options.getString("duration", true);
  const deleteMessages = interaction.options.getInteger("delete_messages") ?? 0;

  if (targetMember && !targetMember.bannable) {
    await interaction.reply({
      embeds: [errorEmbed("Permission Error", "I cannot ban this user.")],
      ephemeral: true,
    });
    return;
  }

  const expiresAt = parseDuration(durationStr);
  if (!expiresAt) {
    await interaction.reply({
      embeds: [errorEmbed("Invalid Duration", "Use format like `10m`, `2h`, `1d`, `7d`.")],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  // Notify user before ban
  try {
    await targetUser.send({
      embeds: [
        {
          color: 0xed4245,
          title: `🔨 You have been temp-banned from **${interaction.guild.name}**`,
          fields: [
            { name: "📋 Reason", value: reason, inline: false },
            { name: "⏱️ Duration", value: formatDuration(expiresAt), inline: true },
            { name: "📅 Expires", value: `<t:${Math.floor(expiresAt / 1000)}:F>`, inline: true },
            { name: "👮 Moderator", value: interaction.user.tag, inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch {
    // DMs disabled
  }

  // Apply ban
  await interaction.guild.members.ban(targetUser.id, {
    reason: `Temp ban by ${interaction.user.tag}: ${reason}`,
    deleteMessageSeconds: deleteMessages * 86400,
  });

  // Save to config
  const config = loadConfig(interaction.guildId);
  const banEntry: TempBanEntry = {
    userId: targetUser.id,
    reason,
    moderatorId: interaction.user.id,
    expiresAt,
  };
  config.tempBans[targetUser.id] = banEntry;
  saveConfig(interaction.guildId, config);

  // Log
  if (config.logChannelId) {
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logChannel) {
      await logChannel.send({
        embeds: [
          modLogEmbed("Member Temp-Banned", [
            { name: "👤 User", value: `${targetUser.tag} (${targetUser.id})`, inline: true },
            { name: "👮 Moderator", value: `<@${interaction.user.id}>`, inline: true },
            { name: "⏱️ Duration", value: formatDuration(expiresAt), inline: true },
            { name: "📅 Expires", value: `<t:${Math.floor(expiresAt / 1000)}:F>`, inline: true },
            { name: "📋 Reason", value: reason, inline: false },
          ], 0xed4245),
        ],
      });
    }
  }

  await interaction.editReply({
    embeds: [
      {
        color: 0xed4245,
        title: "🔨 User Temp-Banned",
        fields: [
          { name: "👤 User", value: `${targetUser.tag}`, inline: true },
          { name: "⏱️ Duration", value: formatDuration(expiresAt), inline: true },
          { name: "📅 Expires", value: `<t:${Math.floor(expiresAt / 1000)}:F>`, inline: true },
          { name: "📋 Reason", value: reason, inline: false },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
