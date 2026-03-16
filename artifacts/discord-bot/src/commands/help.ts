import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("📖 View all available bot commands");

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.reply({
    embeds: [
      {
        color: 0x5865f2,
        title: "📖 Nexus Bot — Command List",
        description: "All commands require **Administrator** permission unless noted otherwise.",
        fields: [
          {
            name: "⚙️ Configuration",
            value: [
              "`/setup prefix` — Set the bot prefix",
              "`/setup logchannel` — Set mod log channel",
              "`/setup jailchannel` — Set jail channel",
              "`/setup view` — View current config",
            ].join("\n"),
            inline: false,
          },
          {
            name: "📊 Info",
            value: [
              "`/servercount` — View server count & stats",
              "`/help` — Show this message",
            ].join("\n"),
            inline: false,
          },
          {
            name: "💬 Messaging",
            value: [
              "`/say <message>` — Make the bot say something",
              "`/dm <user> <message>` — DM a specific user",
              "`/dmall <message>` — DM all server members",
              "`/embed` — Build a custom embed message",
            ].join("\n"),
            inline: false,
          },
          {
            name: "🤖 AI",
            value: [
              "`/ai <prompt>` — Ask the AI assistant anything (open to everyone)",
            ].join("\n"),
            inline: false,
          },
          {
            name: "🔨 Moderation",
            value: [
              "`/nuke [channel]` — Delete all messages in a channel",
              "`/jail <user> <reason> [duration]` — Jail a user",
              "`/unjail <user>` — Release a jailed user",
              "`/tempkick <user> <reason> <duration>` — Temporarily kick",
              "`/tempban <user> <reason> <duration>` — Temporarily ban",
              "`/lock channel [channel]` — Lock a channel",
              "`/lock unlock [channel]` — Unlock a channel",
            ].join("\n"),
            inline: false,
          },
          {
            name: "⏱️ Duration Format",
            value: "`10s` = 10 seconds, `5m` = 5 minutes, `2h` = 2 hours, `1d` = 1 day",
            inline: false,
          },
        ],
        footer: {
          text: "Nexus Bot • AI-Powered Discord Management",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
