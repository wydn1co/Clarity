import {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  REST,
  Routes,
  ActivityType,
} from "discord.js";
import { loadConfig, saveConfig } from "./utils/serverConfig.js";
import { startTime, formatUptime } from "./utils/uptime.js";
import { handlePrefixMessage } from "./handlers/prefixCommands.js";

// Commands
import * as setup from "./commands/setup.js";
import * as servercount from "./commands/servercount.js";
import * as serverinfo from "./commands/serverinfo.js";
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
import * as help from "./commands/help.js";
import * as timeout from "./commands/timeout.js";
import * as untimeout from "./commands/untimeout.js";
import * as warn from "./commands/warn.js";
import * as warns from "./commands/warns.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN environment variable is required.");
}

const commandModules = [
  setup,
  servercount,
  serverinfo,
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
  help,
  timeout,
  untimeout,
  warn,
  warns,
];

const commands = new Collection<
  string,
  { data: SlashCommandBuilder; execute: (i: ChatInputCommandInteraction) => Promise<void> }
>();

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

function updateStatus(readyClient: Client): void {
  const uptime = formatUptime(Date.now() - startTime);
  readyClient.user?.setActivity(`claritydevs | Up ${uptime}`, {
    type: ActivityType.Streaming,
    url: "https://www.twitch.tv/claritydevs",
  });
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  console.log(`Serving ${readyClient.guilds.cache.size} servers`);

  updateStatus(readyClient);

  const rest = new REST().setToken(TOKEN!);
  const commandData = commandModules.map((m) => m.data.toJSON());

  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(readyClient.user.id), {
      body: commandData,
    });
    console.log(`Registered ${commandData.length} slash commands`);
  } catch (err) {
    console.error("Failed to register slash commands:", err);
  }

  setInterval(() => updateStatus(readyClient), 30_000);

  setInterval(async () => {
    for (const [guildId, guild] of readyClient.guilds.cache) {
      const config = loadConfig(guildId);
      let changed = false;

      for (const [userId, ban] of Object.entries(config.tempBans)) {
        if (ban.expiresAt <= Date.now()) {
          try {
            await guild.members.unban(userId, "Temp ban expired");
            console.log(`Unbanned ${userId} from ${guildId}`);
          } catch {
            // already unbanned
          }
          delete config.tempBans[userId];
          changed = true;
        }
      }

      for (const [userId, jailEntry] of Object.entries(config.jails)) {
        if (jailEntry.expiresAt && jailEntry.expiresAt <= Date.now()) {
          try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
              for (const [, ch] of guild.channels.cache) {
                if (ch.isTextBased()) {
                  try {
                    await (ch as any).permissionOverwrites.delete(userId);
                  } catch {
                    // ignore
                  }
                }
              }
              if (jailEntry.originalRoles.length > 0) {
                const validRoles = jailEntry.originalRoles.filter((id) =>
                  guild.roles.cache.has(id)
                );
                await member.roles.set(validRoles, "Jail expired").catch(() => {});
              }
              console.log(`Unjailed ${userId} from ${guildId}`);
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

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    await interaction.reply({ content: "Unknown command.", ephemeral: true });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error executing /${interaction.commandName}:`, err);
    const msg = { content: "An error occurred while running this command.", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

// Handle prefix commands
client.on(Events.MessageCreate, async (message) => {
  await handlePrefixMessage(message, client);
});

client.on(Events.GuildCreate, (guild) => {
  console.log(`Joined server: ${guild.name} (${guild.id})`);
  loadConfig(guild.id);
});

client.login(TOKEN);
