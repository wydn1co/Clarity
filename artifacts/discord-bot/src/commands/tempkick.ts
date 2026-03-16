import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
} from "discord.js";
import { errorEmbed, successEmbed, modLogEmbed } from "../utils/embeds.js";
import { loadConfig } from "../utils/serverConfig.js";

export const data = new SlashCommandBuilder()
  .setName("tempkick")
  .setDescription("👢 Temporarily kick a user (with rejoin blocked for a duration)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The user to kick").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for the kick").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("duration")
      .setDescription("How long to block rejoin (e.g. 10m, 2h, 1d)")
      .setRequired(true)
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

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed("Error", "Server only.")], ephemeral: true });
    return;
  }

  const target = interaction.options.getMember("user") as GuildMember;
  const reason = interaction.options.getString("reason", true);
  const durationStr = interaction.options.getString("duration", true);

  if (!target) {
    await interaction.reply({ embeds: [errorEmbed("Error", "User not found.")], ephemeral: true });
    return;
  }

  if (!target.kickable) {
    await interaction.reply({
      embeds: [errorEmbed("Permission Error", "I cannot kick this user. They may have higher permissions than me.")],
      ephemeral: true,
    });
    return;
  }

  const expiresAt = parseDuration(durationStr);
  if (!expiresAt) {
    await interaction.reply({
      embeds: [errorEmbed("Invalid Duration", "Use format like `10m`, `2h`, `1d`.")],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  // Notify user before kick
  try {
    await target.user.send({
      embeds: [
        {
          color: 0xfee75c,
          title: `👢 You have been kicked from **${interaction.guild.name}**`,
          fields: [
            { name: "📋 Reason", value: reason, inline: false },
            { name: "⏱️ Rejoin Block", value: durationStr, inline: true },
            { name: "👮 Moderator", value: interaction.user.tag, inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch {
    // DMs disabled
  }

  await target.kick(`Temp kick by ${interaction.user.tag}: ${reason}`);

  // Log
  const config = loadConfig(interaction.guildId);
  if (config.logChannelId) {
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logChannel) {
      await logChannel.send({
        embeds: [
          modLogEmbed("Member Temp-Kicked", [
            { name: "👤 User", value: `${target.user.tag} (${target.id})`, inline: true },
            { name: "👮 Moderator", value: `<@${interaction.user.id}>`, inline: true },
            { name: "⏱️ Duration", value: durationStr, inline: true },
            { name: "📋 Reason", value: reason, inline: false },
          ], 0xfee75c),
        ],
      });
    }
  }

  await interaction.editReply({
    embeds: [
      successEmbed(
        "User Temp-Kicked",
        `👢 **${target.user.tag}** has been kicked.\n📋 **Reason:** ${reason}\n⏱️ **Rejoin block:** ${durationStr}`
      ),
    ],
  });
}
