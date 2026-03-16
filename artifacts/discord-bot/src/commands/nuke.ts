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
  .setDescription("💥 Clear ALL messages in a channel (nuke it)")
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
    await interaction.reply({
      embeds: [errorEmbed("Error", "This command can only be used in a server.")],
      ephemeral: true,
    });
    return;
  }

  const target =
    (interaction.options.getChannel("channel") as TextChannel) ??
    (interaction.channel as TextChannel);

  if (!target || target.type !== ChannelType.GuildText) {
    await interaction.reply({
      embeds: [errorEmbed("Error", "Invalid channel.")],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Clone the channel to effectively delete all messages
    const position = target.position;
    const newChannel = await target.clone({
      reason: `Nuked by ${interaction.user.tag}`,
    });
    await newChannel.setPosition(position);
    await target.delete(`Nuked by ${interaction.user.tag}`);

    // Send nuke announcement in the new channel
    await newChannel.send({
      embeds: [
        {
          color: 0xed4245,
          title: "💥 NUKED",
          description: `This channel was nuked by **${interaction.user.tag}**\n\n💣 All messages have been erased.`,
          image: {
            url: "https://media.giphy.com/media/HhTXt43pk1I1W/giphy.gif",
          },
          footer: { text: "Channel nuked • All previous messages are gone" },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    // Log it
    const config = loadConfig(interaction.guildId!);
    if (config.logChannelId) {
      const logChannel = interaction.guild.channels.cache.get(
        config.logChannelId
      ) as TextChannel | undefined;
      if (logChannel) {
        await logChannel.send({
          embeds: [
            {
              color: 0xed4245,
              title: "💥 Channel Nuked",
              fields: [
                { name: "🔫 Nuked By", value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                { name: "📺 Channel", value: `<#${newChannel.id}> (#${newChannel.name})`, inline: true },
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
          title: "💥 Nuke Successful",
          description: `Channel <#${newChannel.id}> has been nuked!`,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    await interaction.editReply({
      embeds: [errorEmbed("Nuke Failed", `Error: ${String(err)}`)],
    });
  }
}
