import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
} from "discord.js";
import { loadConfig } from "../utils/serverConfig.js";
import { successEmbed, errorEmbed, modLogEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("timeout")
  .setDescription("Timeout a user, preventing them from sending messages")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The user to timeout").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("duration")
      .setDescription("Duration (e.g. 10m, 2h, 1d, max 28d) — leave blank for indefinite (28d)")
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt
      .setName("reason")
      .setDescription("Reason for the timeout")
      .setRequired(false)
      .setMaxLength(1000)
  );

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

function parseDurationMs(str: string): number | null {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed("Error", "This command can only be used in a server.")], ephemeral: true });
    return;
  }

  const target = interaction.options.getMember("user") as GuildMember | null;
  const durationStr = interaction.options.getString("duration");
  const reason = interaction.options.getString("reason") ?? "No reason provided";

  if (!target) {
    await interaction.reply({ embeds: [errorEmbed("Error", "User not found in this server.")], ephemeral: true });
    return;
  }

  if (target.id === interaction.user.id) {
    await interaction.reply({ embeds: [errorEmbed("Error", "You cannot timeout yourself.")], ephemeral: true });
    return;
  }

  if (!target.moderatable) {
    await interaction.reply({ embeds: [errorEmbed("Permission Error", "I do not have permission to timeout this user. They may have a higher role than me.")], ephemeral: true });
    return;
  }

  let durationMs = MAX_TIMEOUT_MS;
  let durationLabel = "Indefinite (28 days)";

  if (durationStr) {
    const parsed = parseDurationMs(durationStr);
    if (!parsed || parsed > MAX_TIMEOUT_MS) {
      await interaction.reply({ embeds: [errorEmbed("Invalid Duration", "Duration must be a valid format (e.g. `10m`, `2h`, `1d`) and cannot exceed 28 days.")], ephemeral: true });
      return;
    }
    durationMs = parsed;
    durationLabel = formatMs(durationMs);
  }

  try {
    await target.timeout(durationMs, reason);
  } catch {
    await interaction.reply({ embeds: [errorEmbed("Timeout Failed", "Failed to timeout the user. Check my role permissions.")], ephemeral: true });
    return;
  }

  const config = loadConfig(interaction.guildId);
  if (config.logChannelId) {
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logChannel) {
      await logChannel.send({
        embeds: [
          modLogEmbed("User Timed Out", [
            { name: "User", value: `${target.user.tag} (${target.id})`, inline: true },
            { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
            { name: "Duration", value: durationLabel, inline: true },
            { name: "Reason", value: reason, inline: false },
          ]),
        ],
      });
    }
  }

  await interaction.reply({
    embeds: [
      successEmbed(
        "User Timed Out",
        `**${target.user.tag}** has been timed out.\n\n**Duration:** ${durationLabel}\n**Reason:** ${reason}`
      ),
    ],
  });
}
