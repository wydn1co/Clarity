import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { infoEmbed, errorEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("servercount")
  .setDescription("📊 View the number of servers the bot is in")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.client) {
    await interaction.reply({
      embeds: [errorEmbed("Error", "Could not access client.")],
      ephemeral: true,
    });
    return;
  }

  const guildCount = interaction.client.guilds.cache.size;
  const userCount = interaction.client.guilds.cache.reduce(
    (acc, g) => acc + g.memberCount,
    0
  );

  await interaction.reply({
    embeds: [
      {
        color: 0x5865f2,
        title: "📊 Bot Statistics",
        fields: [
          {
            name: "🌐 Servers",
            value: `**${guildCount.toLocaleString()}** servers`,
            inline: true,
          },
          {
            name: "👥 Total Members",
            value: `**${userCount.toLocaleString()}** members`,
            inline: true,
          },
          {
            name: "🤖 Bot Name",
            value: interaction.client.user?.tag ?? "Unknown",
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
