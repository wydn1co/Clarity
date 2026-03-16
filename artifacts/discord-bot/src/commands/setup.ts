import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
} from "discord.js";
import { updateConfig, loadConfig } from "../utils/serverConfig.js";
import { successEmbed, errorEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("⚙️ Configure bot settings for this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("prefix")
      .setDescription("Set the bot command prefix")
      .addStringOption((opt) =>
        opt
          .setName("prefix")
          .setDescription("The new prefix (e.g. !, ?, .)")
          .setRequired(true)
          .setMaxLength(5)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("logchannel")
      .setDescription("Set the moderation log channel")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The channel to send mod logs to")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("jailchannel")
      .setDescription("Set the jail channel (where jailed users are confined)")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The jail channel")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View current bot configuration")
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      embeds: [errorEmbed("Error", "This command can only be used in a server.")],
      ephemeral: true,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "prefix") {
    const prefix = interaction.options.getString("prefix", true);
    updateConfig(interaction.guildId, { prefix });
    await interaction.reply({
      embeds: [
        successEmbed(
          "Prefix Updated",
          `✅ Bot prefix has been set to \`${prefix}\``
        ),
      ],
    });
  } else if (sub === "logchannel") {
    const channel = interaction.options.getChannel("channel", true) as TextChannel;
    updateConfig(interaction.guildId, { logChannelId: channel.id });
    await interaction.reply({
      embeds: [
        successEmbed(
          "Log Channel Set",
          `📋 Moderation logs will now be sent to ${channel}`
        ),
      ],
    });
  } else if (sub === "jailchannel") {
    const channel = interaction.options.getChannel("channel", true) as TextChannel;
    updateConfig(interaction.guildId, { jailChannelId: channel.id });
    await interaction.reply({
      embeds: [
        successEmbed(
          "Jail Channel Set",
          `🔒 Jailed users will be confined to ${channel}`
        ),
      ],
    });
  } else if (sub === "view") {
    const config = loadConfig(interaction.guildId);
    const logCh = config.logChannelId ? `<#${config.logChannelId}>` : "Not set";
    const jailCh = config.jailChannelId ? `<#${config.jailChannelId}>` : "Not set";
    const jailCount = Object.keys(config.jails).length;
    const lockedCount = config.lockedChannels.length;

    await interaction.reply({
      embeds: [
        {
          color: 0x5865f2,
          title: "⚙️ Server Configuration",
          fields: [
            { name: "📌 Prefix", value: `\`${config.prefix}\``, inline: true },
            { name: "📋 Log Channel", value: logCh, inline: true },
            { name: "🔒 Jail Channel", value: jailCh, inline: true },
            { name: "⛓️ Active Jails", value: String(jailCount), inline: true },
            { name: "🔐 Locked Channels", value: String(lockedCount), inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }
}
