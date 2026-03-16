import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
} from "discord.js";
import { loadConfig, saveConfig } from "../utils/serverConfig.js";
import { errorEmbed, successEmbed, modLogEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("unjail")
  .setDescription("🔓 Release a jailed user")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The user to release").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("reason")
      .setDescription("Reason for unjailing")
      .setRequired(false)
      .setMaxLength(1000)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed("Error", "Server only.")], ephemeral: true });
    return;
  }

  const target = interaction.options.getMember("user") as GuildMember;
  const reason = interaction.options.getString("reason") ?? "No reason provided";

  if (!target) {
    await interaction.reply({ embeds: [errorEmbed("Error", "User not found.")], ephemeral: true });
    return;
  }

  const config = loadConfig(interaction.guildId);
  const jailEntry = config.jails[target.id];

  if (!jailEntry) {
    await interaction.reply({
      embeds: [errorEmbed("Not Jailed", `<@${target.id}> is not currently jailed.`)],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  // Remove permission overrides from all channels
  const allChannels = interaction.guild.channels.cache.filter(
    (ch) => ch.type === 0 // GuildText
  );

  for (const [, ch] of allChannels) {
    try {
      await (ch as TextChannel).permissionOverwrites.delete(target.id);
    } catch {
      // ignore
    }
  }

  // Restore original roles
  if (jailEntry.originalRoles.length > 0) {
    try {
      const rolesToRestore = jailEntry.originalRoles.filter((id) =>
        interaction.guild!.roles.cache.has(id)
      );
      await target.roles.set(rolesToRestore, `Unjailed by ${interaction.user.tag}: ${reason}`);
    } catch {
      // ignore role errors
    }
  }

  // Remove from config
  delete config.jails[target.id];
  saveConfig(interaction.guildId, config);

  // Notify user
  try {
    await target.user.send({
      embeds: [
        {
          color: 0x57f287,
          title: `🔓 You have been released in **${interaction.guild.name}**`,
          fields: [
            { name: "📋 Reason", value: reason, inline: false },
            { name: "👮 Moderator", value: interaction.user.tag, inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch {
    // DMs disabled
  }

  // Log to log channel
  if (config.logChannelId) {
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logChannel) {
      await logChannel.send({
        embeds: [
          modLogEmbed("Member Unjailed", [
            { name: "👤 User", value: `<@${target.id}> (${target.user.tag})`, inline: true },
            { name: "👮 Moderator", value: `<@${interaction.user.id}>`, inline: true },
            { name: "📋 Reason", value: reason, inline: false },
          ], 0x57f287),
        ],
      });
    }
  }

  await interaction.editReply({
    embeds: [
      successEmbed(
        "User Released",
        `🔓 **${target.user.tag}** has been unjailed.\n📋 **Reason:** ${reason}`
      ),
    ],
  });
}
