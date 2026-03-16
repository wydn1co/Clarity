import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export async function getAIResponse(
  prompt: string,
  systemContext?: string
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (systemContext) {
    messages.push({
      role: "system",
      content: systemContext,
    });
  }

  messages.push({ role: "user", content: prompt });

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages,
    max_completion_tokens: 800,
  });

  return (
    response.choices[0]?.message?.content?.trim() ||
    "🤖 I couldn't generate a response right now."
  );
}
