import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { errorEmbed } from "../utils/embeds.js";
import { getUserWarns, clearWarns, removeWarn } from "../utils/warns.js";

export const data = new SlashCommandBuilder()
  .setName("warns")
  .setDescription("View or manage warnings for a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View all warnings for a user")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to check").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a specific warning by ID")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to remove a warning from").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("The warning ID to remove").setRequired(true).setMinValue(1)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("clear")
      .setDescription("Clear all warnings for a user")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to clear warnings for").setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed("Error", "This command can only be used in a server.")], ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const target = interaction.options.getMember("user") as GuildMember | null;

  if (!target) {
    await interaction.reply({ embeds: [errorEmbed("Error", "User not found in this server.")], ephemeral: true });
    return;
  }

  if (sub === "view") {
    const warns = getUserWarns(interaction.guildId, target.id);

    if (warns.length === 0) {
      await interaction.reply({
        embeds: [
          {
            color: 0x2b2d31,
            title: "Warning Record",
            description: `**${target.user.tag}** has no warnings on record.`,
            timestamp: new Date().toISOString(),
          },
        ],
      });
      return;
    }

    const warnList = warns
      .map((w) => {
        const date = new Date(w.timestamp).toLocaleDateString("en-GB");
        return `**[#${w.id}]** ${w.reason}\n— <@${w.moderatorId}> on ${date}`;
      })
      .join("\n\n");

    await interaction.reply({
      embeds: [
        {
          color: 0xfee75c,
          title: "Warning Record",
          description: `**${target.user.tag}** — ${warns.length} warning${warns.length !== 1 ? "s" : ""}\n\n${warnList}`,
          footer: { text: `User ID: ${target.id}` },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } else if (sub === "remove") {
    const warnId = interaction.options.getInteger("id", true);
    const removed = removeWarn(interaction.guildId, target.id, warnId);

    if (!removed) {
      await interaction.reply({ embeds: [errorEmbed("Not Found", `Warning #${warnId} was not found for **${target.user.tag}**.`)], ephemeral: true });
      return;
    }

    const remaining = getUserWarns(interaction.guildId, target.id).length;
    await interaction.reply({
      embeds: [
        {
          color: 0x57f287,
          title: "Warning Removed",
          description: `Warning **#${warnId}** has been removed from **${target.user.tag}**.\n\n**Remaining warnings:** ${remaining}`,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } else if (sub === "clear") {
    const count = clearWarns(interaction.guildId, target.id);

    await interaction.reply({
      embeds: [
        {
          color: 0x57f287,
          title: "Warnings Cleared",
          description: `All **${count}** warning${count !== 1 ? "s" : ""} have been cleared from **${target.user.tag}**'s record.`,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }
}
