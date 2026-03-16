import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { errorEmbed } from "../utils/embeds.js";
import { startTime, formatUptime } from "../utils/uptime.js";

export const data = new SlashCommandBuilder()
  .setName("servercount")
  .setDescription("View the number of servers the bot is in")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guildCount = interaction.client.guilds.cache.size;
  const userCount = interaction.client.guilds.cache.reduce(
    (acc, g) => acc + g.memberCount,
    0
  );
  const uptime = formatUptime(Date.now() - startTime);

  await interaction.reply({
    embeds: [
      {
        color: 0x2b2d31,
        title: "Bot Statistics",
        fields: [
          { name: "Servers", value: guildCount.toLocaleString(), inline: true },
          { name: "Total Members", value: userCount.toLocaleString(), inline: true },
          { name: "Uptime", value: uptime, inline: true },
          { name: "Bot Tag", value: interaction.client.user?.tag ?? "Unknown", inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
