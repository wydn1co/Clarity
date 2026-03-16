import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Guild,
  ChannelType,
} from "discord.js";
import { errorEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("View detailed information about this server");

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guild = interaction.guild as Guild;
  if (!guild) {
    await interaction.reply({ embeds: [errorEmbed("Error", "This command can only be used in a server.")], ephemeral: true });
    return;
  }

  await guild.members.fetch();

  const owner = await guild.fetchOwner().catch(() => null);
  const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
  const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
  const categoryChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size;
  const totalChannels = guild.channels.cache.size;
  const roles = guild.roles.cache.size - 1; // exclude @everyone
  const totalMembers = guild.memberCount;
  const bots = guild.members.cache.filter((m) => m.user.bot).size;
  const humans = totalMembers - bots;
  const emojis = guild.emojis.cache.size;
  const boostLevel = guild.premiumTier;
  const boostCount = guild.premiumSubscriptionCount ?? 0;
  const createdAt = Math.floor(guild.createdTimestamp / 1000);
  const verificationLevel = ["None", "Low", "Medium", "High", "Very High"][guild.verificationLevel] ?? "Unknown";

  await interaction.reply({
    embeds: [
      {
        color: 0x2b2d31,
        title: guild.name,
        thumbnail: guild.iconURL() ? { url: guild.iconURL()! } : undefined,
        fields: [
          { name: "Server ID", value: guild.id, inline: true },
          { name: "Owner", value: owner ? `${owner.user.tag}` : "Unknown", inline: true },
          { name: "Created", value: `<t:${createdAt}:D>`, inline: true },
          { name: "Members", value: `${totalMembers.toLocaleString()} total\n${humans.toLocaleString()} humans / ${bots} bots`, inline: true },
          { name: "Channels", value: `${totalChannels} total\n${textChannels} text / ${voiceChannels} voice / ${categoryChannels} categories`, inline: true },
          { name: "Roles", value: String(roles), inline: true },
          { name: "Emojis", value: String(emojis), inline: true },
          { name: "Verification", value: verificationLevel, inline: true },
          { name: "Boosts", value: `Level ${boostLevel} — ${boostCount} boosts`, inline: true },
        ],
        footer: { text: `Requested by ${interaction.user.tag}` },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
