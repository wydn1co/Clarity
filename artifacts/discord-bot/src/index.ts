import {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  REST,
  Routes,
} from "discord.js";
import { loadConfig, saveConfig } from "./utils/serverConfig.js";
import { getAIResponse } from "./utils/ai.js";

// Import all commands
import * as setup from "./commands/setup.js";
import * as servercount from "./commands/servercount.js";
import * as dm from "./commands/dm.js";
import * as dmall from "./commands/dmall.js";
import * as nuke from "./commands/nuke.js";
import * as say from "./commands/say.js";
import * as embed from "./commands/embed.js";
import * as jail from "./commands/jail.js";
import * as unjail from "./commands/unjail.js";
import * as tempkick from "./commands/tempkick.js";
import * as tempban from "./commands/tempban.js";
import * as lock from "./commands/lock.js";
import * as ai from "./commands/ai.js";
import * as help from "./commands/help.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN environment variable is required.");
}

// Build command collection
const commands = new Collection<
  string,
  { data: SlashCommandBuilder; execute: (i: ChatInputCommandInteraction) => Promise<void> }
>();

const commandModules = [
  setup,
  servercount,
  dm,
  dmall,
  nuke,
  say,
  embed,
  jail,
  unjail,
  tempkick,
  tempban,
  lock,
  ai,
  help,
];

for (const mod of commandModules) {
  commands.set(mod.data.name, mod as any);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// Register slash commands when bot is ready
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
  console.log(`🌐 Serving ${readyClient.guilds.cache.size} servers`);

  // Register slash commands globally
  const rest = new REST().setToken(TOKEN!);
  const commandData = commandModules.map((m) => m.data.toJSON());

  try {
    console.log("⏳ Registering slash commands...");
    await rest.put(Routes.applicationCommands(readyClient.user.id), {
      body: commandData,
    });
    console.log(`✅ Registered ${commandData.length} slash commands globally`);
  } catch (err) {
    console.error("❌ Failed to register slash commands:", err);
  }

  // Check and auto-unban temp-banned users every minute
  setInterval(async () => {
    for (const [guildId, guild] of readyClient.guilds.cache) {
      const config = loadConfig(guildId);
      let changed = false;

      for (const [userId, ban] of Object.entries(config.tempBans)) {
        if (ban.expiresAt <= Date.now()) {
          try {
            await guild.members.unban(userId, "Temp ban expired");
            console.log(`✅ Unbanned ${userId} from ${guildId}`);
          } catch {
            // User may already be unbanned
          }
          delete config.tempBans[userId];
          changed = true;
        }
      }

      // Check and auto-unjail timed jails
      for (const [userId, jailEntry] of Object.entries(config.jails)) {
        if (jailEntry.expiresAt && jailEntry.expiresAt <= Date.now()) {
          try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
              // Restore access to all channels
              for (const [, ch] of guild.channels.cache) {
                if (ch.isTextBased()) {
                  try {
                    await (ch as any).permissionOverwrites.delete(userId);
                  } catch {
                    // ignore
                  }
                }
              }
              // Restore roles
              if (jailEntry.originalRoles.length > 0) {
                const validRoles = jailEntry.originalRoles.filter((id) =>
                  guild.roles.cache.has(id)
                );
                await member.roles.set(validRoles, "Jail expired").catch(() => {});
              }
              console.log(`✅ Unjailed ${userId} from ${guildId}`);
            }
          } catch {
            // ignore
          }
          delete config.jails[userId];
          changed = true;
        }
      }

      if (changed) {
        saveConfig(guildId, config);
      }
    }
  }, 60_000);
});

// Handle messages for AI prefix commands
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const config = loadConfig(message.guild.id);
  const prefix = config.prefix;

  if (!message.content.startsWith(prefix)) return;

  const content = message.content.slice(prefix.length).trim();
  if (!content) return;

  // Simple AI response for prefix-based queries
  if (content.toLowerCase().startsWith("ai ") || content.toLowerCase() === "ai") {
    const prompt = content.slice(2).trim();
    if (!prompt) {
      await message.reply("🤖 Please provide a question after the `ai` command!");
      return;
    }

    const typing = await message.channel.sendTyping();
    try {
      const response = await getAIResponse(
        prompt,
        "You are a helpful Discord bot named Nexus. Be concise, friendly, and use emojis."
      );
      await message.reply({
        embeds: [
          {
            color: 0x5865f2,
            title: "🤖 AI Response",
            description: response,
            footer: { text: `Responded to ${message.author.tag}` },
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch {
      await message.reply("❌ AI is unavailable right now. Try again later.");
    }
  }
});

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    await interaction.reply({
      content: "❌ Unknown command.",
      ephemeral: true,
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error executing /${interaction.commandName}:`, err);
    const errorMessage = {
      content: "❌ An error occurred while executing this command.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Handle guild join
client.on(Events.GuildCreate, (guild) => {
  console.log(`✅ Joined new server: ${guild.name} (${guild.id})`);
  loadConfig(guild.id); // Initialize config
});

client.login(TOKEN);
