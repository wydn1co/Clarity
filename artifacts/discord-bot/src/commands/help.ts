import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { startTime, formatUptime } from "../utils/uptime.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("View all available commands and bot information");

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const uptime = formatUptime(Date.now() - startTime);

  await interaction.reply({
    embeds: [
      {
        color: 0x2b2d31,
        title: "Command Reference",
        description: "All moderation commands require **Administrator** permission.",
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
              "`/nuke [channel]` — Clear all messages in a channel",
              "`/jail <user> <reason> [duration]` — Restrict user to jail channel",
              "`/unjail <user> [reason]` — Release a jailed user",
              "`/tempkick <user> <reason> <duration>` — Kick a user temporarily",
              "`/tempban <user> <reason> <duration>` — Ban a user temporarily",
              "`/lock channel [channel] [reason]` — Lock a channel",
              "`/lock unlock [channel] [reason]` — Unlock a channel",
            ].join("\n"),
            inline: false,
          },
          {
            name: "Duration Format",
            value: "`10s` = 10 seconds  `5m` = 5 minutes  `2h` = 2 hours  `1d` = 1 day",
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
