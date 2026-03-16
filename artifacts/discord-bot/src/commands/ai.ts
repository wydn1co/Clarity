import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { getAIResponse } from "../utils/ai.js";
import { errorEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("ai")
  .setDescription("🤖 Ask the AI assistant anything")
  .addStringOption((opt) =>
    opt
      .setName("prompt")
      .setDescription("Your question or message for the AI")
      .setRequired(true)
      .setMaxLength(2000)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const prompt = interaction.options.getString("prompt", true);

  await interaction.deferReply();

  try {
    const response = await getAIResponse(
      prompt,
      `You are a helpful, smart Discord bot assistant named Nexus. You are witty, friendly, and concise. 
      You help server members with questions, tasks, and general conversation. 
      Keep responses under 1000 characters when possible. Use relevant emojis naturally.`
    );

    await interaction.editReply({
      embeds: [
        {
          color: 0x5865f2,
          title: "🤖 AI Response",
          description: response,
          footer: {
            text: `Asked by ${interaction.user.tag} • Powered by AI`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    await interaction.editReply({
      embeds: [
        errorEmbed("AI Error", "Failed to get an AI response. Please try again later."),
      ],
    });
  }
}
