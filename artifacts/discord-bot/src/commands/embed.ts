import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import { errorEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("embed")
  .setDescription("🎨 Build and send a custom embed message")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt.setName("title").setDescription("Embed title").setRequired(true).setMaxLength(256)
  )
  .addStringOption((opt) =>
    opt
      .setName("description")
      .setDescription("Embed description")
      .setRequired(true)
      .setMaxLength(4096)
  )
  .addStringOption((opt) =>
    opt
      .setName("color")
      .setDescription("Embed color as hex (e.g. #5865F2). Default: blurple")
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("footer").setDescription("Footer text").setRequired(false).setMaxLength(2048)
  )
  .addStringOption((opt) =>
    opt
      .setName("image")
      .setDescription("Image URL to attach to embed")
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt
      .setName("thumbnail")
      .setDescription("Thumbnail URL (small image on right)")
      .setRequired(false)
  )
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Channel to send embed in (default: current)")
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const title = interaction.options.getString("title", true);
  const description = interaction.options.getString("description", true);
  const colorInput = interaction.options.getString("color");
  const footer = interaction.options.getString("footer");
  const imageUrl = interaction.options.getString("image");
  const thumbnailUrl = interaction.options.getString("thumbnail");
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

  // Parse color
  let color: number = 0x5865f2;
  if (colorInput) {
    const cleaned = colorInput.replace("#", "");
    const parsed = parseInt(cleaned, 16);
    if (!isNaN(parsed)) color = parsed;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  if (footer) embed.setFooter({ text: footer });
  if (imageUrl) embed.setImage(imageUrl);
  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);

  try {
    await channel.send({ embeds: [embed] });
    await interaction.reply({
      content: `✅ Embed sent in ${channel}`,
      ephemeral: true,
    });
  } catch {
    await interaction.reply({
      embeds: [
        errorEmbed("Error", "Could not send embed. Check my permissions in that channel."),
      ],
      ephemeral: true,
    });
  }
}
