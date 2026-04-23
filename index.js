const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');

// =====================
// ENV VARIABLES
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
// EXPRESS DASHBOARD
// =====================
const app = express();
app.use(express.json());

// Home dashboard UI
app.get('/', (req, res) => {
  res.send(`
    <h1>Discord Bot Dashboard</h1>
    <p>Status: Running</p>

    <button onclick="fetch('/status').then(r => r.json()).then(d => alert(JSON.stringify(d)))">
      Check Bot Status
    </button>
  `);
});

// Status route
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    uptime: process.uptime()
  });
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

// Render port fix
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Dashboard running on port ${PORT}`);
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
          .setDescription('Text input')
          .setRequired(false)
      )
      .toJSON()
  );
}

// =====================
// REGISTER SLASH COMMANDS
// =====================
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log('Registering slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: buildCommands() }
    );

    console.log('Slash commands registered.');
  } catch (err) {
    console.error('Command registration error:', err);
  }
}

// =====================
// BOT READY
// =====================
client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  await registerCommands();

  client.user.setPresence({
    status: 'online',
    activities: [
      {
        name: 'Dashboard system running',
        type: 0
      }
    ]
  });
});

// =====================
// HANDLE SLASH COMMANDS
// =====================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmds = getCommands();
  const cmd = cmds.find(c => c.name === interaction.commandName);

  if (!cmd) return;

  if (cmd.type === 'echo') {
    const text = interaction.options.getString('text');
    await interaction.reply(text || 'No text provided');
  }

  if (cmd.type === 'ping') {
    await interaction.reply('Pong!');
  }
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
