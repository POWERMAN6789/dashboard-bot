const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');

// =====================
// CONFIG
// =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// =====================
// DISCORD BOT
// =====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// =====================
// DASHBOARD SERVER
// =====================
const app = express();
app.use(express.json());

// Home page
app.get('/', (req, res) => {
  res.send('Dashboard running');
});

// Get commands
app.get('/commands', (req, res) => {
  const data = JSON.parse(fs.readFileSync('./commands.json'));
  res.json(data);
});

// Add command
app.post('/commands', (req, res) => {
  const commands = JSON.parse(fs.readFileSync('./commands.json'));

  commands.push(req.body);

  fs.writeFileSync('./commands.json', JSON.stringify(commands, null, 2));

  res.json({ success: true });
});

// Render needs a port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Dashboard running on port', PORT);
});

// =====================
// LOAD COMMANDS
// =====================
function getCommands() {
  return JSON.parse(fs.readFileSync('./commands.json'));
}

// Convert to Discord format
function buildCommands() {
  const cmds = getCommands();

  return cmds.map(cmd =>
    new SlashCommandBuilder()
      .setName(cmd.name)
      .setDescription(cmd.description)
      .addStringOption(opt =>
        opt.setName('text')
          .setDescription('text')
          .setRequired(false)
      )
      .toJSON()
  );
}

// =====================
// REGISTER COMMANDS
// =====================
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log('Registering commands...');

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: buildCommands() }
    );

    console.log('Commands registered.');
  } catch (err) {
    console.error(err);
  }
}

// =====================
// BOT READY
// =====================
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await registerCommands();
});

// =====================
// HANDLE COMMANDS
// =====================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmds = getCommands();
  const cmd = cmds.find(c => c.name === interaction.commandName);

  if (!cmd) return;

  if (cmd.type === 'echo') {
    const text = interaction.options.getString('text');
    await interaction.reply(text || 'Nothing to echo');
  }

  if (cmd.type === 'ping') {
    await interaction.reply('Pong!');
  }
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
