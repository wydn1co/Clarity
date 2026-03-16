import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
} from "discord.js";
import { errorEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("say")
  .setDescription("🗣️ Make the bot say something in a channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("message")
      .setDescription("What the bot should say")
      .setRequired(true)
      .setMaxLength(2000)
  )
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Channel to send the message in (default: current channel)")
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const message = interaction.options.getString("message", true);
  const channel =
    (interaction.options.getChannel("channel") as TextChannel) ??
    (interaction.channel as TextChannel);

  if (!channel) {
    await interaction.reply({
      embeds: [errorEmbed("Error", "Invalid channel.")],
      ephemeral: true,
    });
    return;
  }

  try {
    await channel.send(message);
    await interaction.reply({
      content: `✅ Message sent in ${channel}`,
      ephemeral: true,
    });
  } catch {
    await interaction.reply({
      embeds: [
        errorEmbed("Error", "Could not send the message. Check my permissions."),
      ],
      ephemeral: true,
    });
  }
}
