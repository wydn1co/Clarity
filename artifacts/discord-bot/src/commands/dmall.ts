import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { successEmbed, errorEmbed, warnEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("dmall")
  .setDescription("📢 Send a direct message to ALL members in the server")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("message")
      .setDescription("The message to send to everyone")
      .setRequired(true)
      .setMaxLength(2000)
  )
  .addBooleanOption((opt) =>
    opt
      .setName("bots")
      .setDescription("Include bots? (default: false)")
      .setRequired(false)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed("Error", "This command can only be used in a server.")],
      ephemeral: true,
    });
    return;
  }

  const message = interaction.options.getString("message", true);
  const includeBots = interaction.options.getBoolean("bots") ?? false;

  await interaction.deferReply({ ephemeral: true });

  try {
    await interaction.guild.members.fetch();
    const members = interaction.guild.members.cache.filter(
      (m: GuildMember) => !m.user.bot || includeBots
    );

    let sent = 0;
    let failed = 0;

    for (const [, member] of members) {
      try {
        await member.user.send({
          embeds: [
            {
              color: 0x5865f2,
              title: `📢 Announcement from ${interaction.guild.name}`,
              description: message,
              footer: {
                text: `Sent by ${interaction.user.tag} • Server Announcement`,
              },
              timestamp: new Date().toISOString(),
            },
          ],
        });
        sent++;
      } catch {
        failed++;
      }
    }

    await interaction.editReply({
      embeds: [
        {
          color: 0x57f287,
          title: "📢 Mass DM Complete",
          fields: [
            { name: "✅ Sent", value: String(sent), inline: true },
            { name: "❌ Failed", value: String(failed), inline: true },
            {
              name: "👥 Total Attempted",
              value: String(sent + failed),
              inline: true,
            },
          ],
          description: `Message delivered to **${sent}** members.`,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    await interaction.editReply({
      embeds: [
        errorEmbed("Mass DM Failed", `An error occurred: ${String(err)}`),
      ],
    });
  }
}
