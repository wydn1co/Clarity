import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
} from "discord.js";
import { errorEmbed } from "../utils/embeds.js";
import { loadConfig } from "../utils/serverConfig.js";

export const data = new SlashCommandBuilder()
  .setName("nuke")
  .setDescription("Clear all messages in a channel by cloning and deleting it")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Channel to nuke (defaults to current channel)")
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [errorEmbed("Error", "Server only.")], ephemeral: true });
    return;
  }

  const target =
    (interaction.options.getChannel("channel") as TextChannel) ??
    (interaction.channel as TextChannel);

  if (!target || target.type !== ChannelType.GuildText) {
    await interaction.reply({ embeds: [errorEmbed("Error", "Invalid channel.")], ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const position = target.position;
    const newChannel = await target.clone({ reason: `Nuked by ${interaction.user.tag}` });
    await newChannel.setPosition(position);
    await target.delete(`Nuked by ${interaction.user.tag}`);

    await newChannel.send({
      embeds: [
        {
          color: 0xed4245,
          title: "Channel Nuked",
          description: `This channel was nuked by **${interaction.user.tag}**.\nAll previous messages have been erased.`,
          footer: { text: "Channel Nuke" },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    const config = loadConfig(interaction.guildId!);
    if (config.logChannelId) {
      const logChannel = interaction.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
      if (logChannel) {
        await logChannel.send({
          embeds: [
            {
              color: 0xed4245,
              title: "Moderation — Channel Nuked",
              fields: [
                { name: "Moderator", value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                { name: "Channel", value: `<#${newChannel.id}> (#${newChannel.name})`, inline: true },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        });
      }
    }

    await interaction.editReply({
      embeds: [
        {
          color: 0x57f287,
          title: "Channel Nuked",
          description: `<#${newChannel.id}> has been nuked by **${interaction.user.tag}**.`,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed("Nuke Failed", String(err))] });
  }
}
