import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { successEmbed, errorEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("dm")
  .setDescription("📨 Send a direct message to a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The user to DM").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("message")
      .setDescription("The message to send")
      .setRequired(true)
      .setMaxLength(2000)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const target = interaction.options.getUser("user", true);
  const message = interaction.options.getString("message", true);

  try {
    await target.send({
      embeds: [
        {
          color: 0x5865f2,
          title: `📨 Message from ${interaction.guild?.name ?? "a server"}`,
          description: message,
          footer: {
            text: `Sent by ${interaction.user.tag}`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    await interaction.reply({
      embeds: [
        successEmbed(
          "DM Sent",
          `✉️ Successfully sent a DM to **${target.tag}**.`
        ),
      ],
      ephemeral: true,
    });
  } catch {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "DM Failed",
          `❌ Could not send a DM to **${target.tag}**. They may have DMs disabled.`
        ),
      ],
      ephemeral: true,
    });
  }
}
