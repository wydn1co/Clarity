import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
} from "discord.js";
import { loadConfig, saveConfig } from "../utils/serverConfig.js";
import { errorEmbed, successEmbed, modLogEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("lock")
  .setDescription("🔐 Lock or unlock a channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("channel")
      .setDescription("Lock a channel so members can't send messages")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel to lock (default: current)")
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for locking").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("unlock")
      .setDescription("Unlock a previously locked channel")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel to unlock (default: current)")
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for unlocking").setRequired(false)
      )
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed("Error", "Server only.")], ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const targetChannel =
    (interaction.options.getChannel("channel") as TextChannel) ??
    (interaction.channel as TextChannel);
  const reason = interaction.options.getString("reason") ?? "No reason provided";

  if (!targetChannel) {
    await interaction.reply({ embeds: [errorEmbed("Error", "Invalid channel.")], ephemeral: true });
    return;
  }

  const config = loadConfig(interaction.guildId);
  const everyoneRole = interaction.guild.roles.everyone;

  if (sub === "channel") {
    // Lock
    try {
      await targetChannel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
        AddReactions: false,
      });
    } catch {
      await interaction.reply({
        embeds: [errorEmbed("Error", "I don't have permission to lock this channel.")],
        ephemeral: true,
      });
      return;
    }

    if (!config.lockedChannels.includes(targetChannel.id)) {
      config.lockedChannels.push(targetChannel.id);
      saveConfig(interaction.guildId, config);
    }

    await targetChannel.send({
      embeds: [
        {
          color: 0xed4245,
          title: "🔐 Channel Locked",
          description: `This channel has been locked by <@${interaction.user.id}>.\n📋 **Reason:** ${reason}`,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    if (config.logChannelId) {
      const logChannel = interaction.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
      if (logChannel) {
        await logChannel.send({
          embeds: [
            modLogEmbed("Channel Locked", [
              { name: "📺 Channel", value: `<#${targetChannel.id}>`, inline: true },
              { name: "👮 Moderator", value: `<@${interaction.user.id}>`, inline: true },
              { name: "📋 Reason", value: reason, inline: false },
            ], 0xed4245),
          ],
        });
      }
    }

    await interaction.reply({
      embeds: [successEmbed("Channel Locked", `🔐 <#${targetChannel.id}> has been locked.\n📋 **Reason:** ${reason}`)],
      ephemeral: true,
    });
  } else if (sub === "unlock") {
    // Unlock
    try {
      await targetChannel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: null,
        AddReactions: null,
      });
    } catch {
      await interaction.reply({
        embeds: [errorEmbed("Error", "I don't have permission to unlock this channel.")],
        ephemeral: true,
      });
      return;
    }

    config.lockedChannels = config.lockedChannels.filter(
      (id) => id !== targetChannel.id
    );
    saveConfig(interaction.guildId, config);

    await targetChannel.send({
      embeds: [
        {
          color: 0x57f287,
          title: "🔓 Channel Unlocked",
          description: `This channel has been unlocked by <@${interaction.user.id}>.\n📋 **Reason:** ${reason}`,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    if (config.logChannelId) {
      const logChannel = interaction.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
      if (logChannel) {
        await logChannel.send({
          embeds: [
            modLogEmbed("Channel Unlocked", [
              { name: "📺 Channel", value: `<#${targetChannel.id}>`, inline: true },
              { name: "👮 Moderator", value: `<@${interaction.user.id}>`, inline: true },
              { name: "📋 Reason", value: reason, inline: false },
            ], 0x57f287),
          ],
        });
      }
    }

    await interaction.reply({
      embeds: [successEmbed("Channel Unlocked", `🔓 <#${targetChannel.id}> has been unlocked.\n📋 **Reason:** ${reason}`)],
      ephemeral: true,
    });
  }
}
