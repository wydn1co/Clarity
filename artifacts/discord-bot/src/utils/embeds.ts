import { EmbedBuilder, ColorResolvable } from "discord.js";

export function successEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function errorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function infoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function warnEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function modLogEmbed(
  action: string,
  fields: { name: string; value: string; inline?: boolean }[],
  color: ColorResolvable = 0xeb459e
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`🔨 Moderation | ${action}`)
    .addFields(fields)
    .setTimestamp();
}
