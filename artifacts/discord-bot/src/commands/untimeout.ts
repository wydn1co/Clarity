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
  .setName("untimeout")
  .setDescription("Remove a timeout from a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The user to remove the timeout from").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("reason")
      .setDescription("Reason for removing the timeout")
      .setRequired(false)
      .setMaxLength(1000)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed("Error", "This command can only be used in a server.")], ephemeral: true });
    return;
  }

  const target = interaction.options.getMember("user") as GuildMember | null;
  const reason = interaction.options.getString("reason") ?? "No reason provided";

  if (!target) {
    await interaction.reply({ embeds: [errorEmbed("Error", "User not found in this server.")], ephemeral: true });
    return;
  }

  if (!target.communicationDisabledUntil) {
    await interaction.reply({ embeds: [errorEmbed("Not Timed Out", `**${target.user.tag}** does not currently have an active timeout.`)], ephemeral: true });
    return;
  }

  if (!target.moderatable) {
    await interaction.reply({ embeds: [errorEmbed("Permission Error", "I do not have permission to modify this user's timeout.")], ephemeral: true });
    return;
  }

  try {
    await target.timeout(null, reason);
  } catch {
    await interaction.reply({ embeds: [errorEmbed("Error", "Failed to remove the timeout. Check my role permissions.")], ephemeral: true });
    return;
  }

  const config = loadConfig(interaction.guildId);
  if (config.logChannelId) {
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logChannel) {
      await logChannel.send({
        embeds: [
          modLogEmbed("Timeout Removed", [
            { name: "User", value: `${target.user.tag} (${target.id})`, inline: true },
            { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
            { name: "Reason", value: reason, inline: false },
          ], 0x57f287),
        ],
      });
    }
  }

  await interaction.reply({
    embeds: [
      successEmbed(
        "Timeout Removed",
        `**${target.user.tag}** has been released from timeout.\n\n**Reason:** ${reason}`
      ),
    ],
  });
}
