import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { startTime, formatUptime } from "../utils/uptime.js";
import { loadConfig } from "../utils/serverConfig.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("View all available commands and bot information");

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const uptime = formatUptime(Date.now() - startTime);
  const prefix = interaction.guildId ? loadConfig(interaction.guildId).prefix : "!";

  await interaction.reply({
    embeds: [
      {
        color: 0x2b2d31,
        title: "Command Reference",
        description: `All moderation commands require **Administrator** or **Moderate Members** permission.\nSlash commands available via \`/\` — prefix commands available via \`${prefix}\``,
        fields: [
          {
            name: "Configuration",
            value: [
              "`/setup prefix` — Set the bot prefix",
              "`/setup logchannel` — Set the moderation log channel",
              "`/setup jailchannel` — Set the jail channel",
              "`/setup view` — View current server configuration",
            ].join("\n"),
            inline: false,
          },
          {
            name: "Information",
            value: [
              "`/serverinfo` — Detailed server information",
              "`/servercount` — Bot server and member statistics",
              "`/help` — Display this message",
            ].join("\n"),
            inline: false,
          },
          {
            name: "Messaging",
            value: [
              "`/say <message> [channel]` — Send a message as the bot",
              "`/dm <user> <message>` — Direct message a user",
              "`/dmall <message>` — Direct message all server members",
              "`/embed` — Build and send a custom embed",
            ].join("\n"),
            inline: false,
          },
          {
            name: "Moderation",
            value: [
              "`/warn <user> <reason>` — Issue a formal warning",
              "`/warns view <user>` — View a user's warning record",
              "`/warns remove <user> <id>` — Remove a specific warning",
              "`/warns clear <user>` — Clear all warnings for a user",
              "`/timeout <user> [duration] [reason]` — Timeout a user (max 28d)",
              "`/untimeout <user> [reason]` — Remove a user's timeout",
              "`/jail <user> <reason> [duration]` — Restrict user to jail channel",
              "`/unjail <user> [reason]` — Release a jailed user",
              "`/tempkick <user> <reason> <duration>` — Kick a user temporarily",
              "`/tempban <user> <reason> <duration>` — Ban a user temporarily",
              "`/nuke [channel]` — Clear all messages in a channel",
              "`/lock channel [channel] [reason]` — Lock a channel",
              "`/lock unlock [channel] [reason]` — Unlock a channel",
            ].join("\n"),
            inline: false,
          },
          {
            name: "Duration Format",
            value: "`10s` = 10 seconds  `5m` = 5 minutes  `2h` = 2 hours  `1d` = 1 day  `28d` = max timeout",
            inline: false,
          },
          {
            name: "Prefix Commands",
            value: `All commands above are also available using the server prefix \`${prefix}\`.\nExample: \`${prefix}warn @user spamming\` — \`${prefix}timeout @user 10m rule violation\``,
            inline: false,
          },
        ],
        footer: {
          text: `Clarity  •  Uptime: ${uptime}`,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
