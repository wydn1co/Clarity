import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
} from "discord.js";
import { loadConfig } from "../utils/serverConfig.js";
import { errorEmbed, modLogEmbed } from "../utils/embeds.js";
import { addWarn } from "../utils/warns.js";

export const data = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Issue a formal warning to a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The user to warn").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("reason")
      .setDescription("Reason for the warning")
      .setRequired(true)
      .setMaxLength(1000)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed("Error", "This command can only be used in a server.")], ephemeral: true });
    return;
  }

  const target = interaction.options.getMember("user") as GuildMember | null;
  const reason = interaction.options.getString("reason", true);

  if (!target) {
    await interaction.reply({ embeds: [errorEmbed("Error", "User not found in this server.")], ephemeral: true });
    return;
  }

  if (target.id === interaction.user.id) {
    await interaction.reply({ embeds: [errorEmbed("Error", "You cannot warn yourself.")], ephemeral: true });
    return;
  }

  const warns = addWarn(interaction.guildId, target.id, {
    reason,
    moderatorId: interaction.user.id,
    timestamp: Date.now(),
  });

  try {
    await target.user.send({
      embeds: [
        {
          color: 0xfee75c,
          title: "Warning Issued",
          description: `You have received a warning in **${interaction.guild.name}**.`,
          fields: [
            { name: "Reason", value: reason, inline: false },
            { name: "Warning Number", value: String(warns.length), inline: true },
            { name: "Issued By", value: interaction.user.tag, inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch {
    // DMs disabled — proceed silently
  }

  const config = loadConfig(interaction.guildId);
  if (config.logChannelId) {
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logChannel) {
      await logChannel.send({
        embeds: [
          modLogEmbed("Warning Issued", [
            { name: "User", value: `${target.user.tag} (${target.id})`, inline: true },
            { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
            { name: "Total Warnings", value: String(warns.length), inline: true },
            { name: "Reason", value: reason, inline: false },
          ], 0xfee75c),
        ],
      });
    }
  }

  await interaction.reply({
    embeds: [
      {
        color: 0xfee75c,
        title: "Warning Issued",
        description: `**${target.user.tag}** has been warned.`,
        fields: [
          { name: "Reason", value: reason, inline: false },
          { name: "Total Warnings", value: String(warns.length), inline: true },
          { name: "Warning ID", value: String(warns[warns.length - 1].id), inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
