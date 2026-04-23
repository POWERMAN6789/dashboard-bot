const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');

// =====================
// ENV
// =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// =====================
// INIT
// =====================
const app = express();
app.use(express.json());

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// =====================
// FILE HELPERS
// =====================
function loadCommands() {
  if (!fs.existsSync('./commands.json')) return [];
  return JSON.parse(fs.readFileSync('./commands.json'));
}

function saveCommands(data) {
  fs.writeFileSync('./commands.json', JSON.stringify(data, null, 2));
}

// =====================
// DASHBOARD ROUTE (FIXED SAFE HTML)
// =====================
app.get('/', (req, res) => {
  const cmds = loadCommands();

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Bot Dashboard</title>
  <style>
    body { font-family: Arial; padding: 20px; background:#111; color:white; }
    table { width:100%; border-collapse: collapse; margin-top:20px; }
    th, td { border:1px solid #444; padding:10px; }
    button { padding:8px; margin-top:10px; cursor:pointer; }
    input, select { padding:8px; margin:5px 0; width:200px; }
  </style>
</head>
<body>

<h1>🤖 Discord Bot Dashboard</h1>

<h3>Create Command</h3>

<input id="name" placeholder="Command name" />
<br>

<select id="type">
  <option value="echo">Echo</option>
  <option value="ping">Ping</option>
</select>

<br>

<button onclick="addCommand()">Add Command</button>

<h3>Commands</h3>

<table>
  <tr>
    <th>Name</th>
    <th>Type</th>
  </tr>

  ${cmds.map(cmd => `
    <tr>
      <td>${cmd.name}</td>
      <td>${cmd.type}</td>
    </tr>
  `).join('')}
</table>

<script>
async function addCommand() {
  const name = document.getElementById('name').value;
  const type = document.getElementById('type').value;

  await fetch('/commands', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      name,
      description: name,
      type
    })
  });

  location.reload();
}
</script>

</body>
</html>
  `);
});

// =====================
// API ROUTES
// =====================
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    uptime: process.uptime()
  });
});

app.get('/commands', (req, res) => {
  res.json(loadCommands());
});

app.post('/commands', (req, res) => {
  const cmds = loadCommands();
  cmds.push(req.body);
  saveCommands(cmds);

  registerCommands();
  res.json({ success: true });
});

// =====================
// SLASH COMMANDS
// =====================
function buildCommands() {
  return loadCommands().map(cmd =>
    new SlashCommandBuilder()
      .setName(cmd.name)
      .setDescription(cmd.description || 'No description')
      .addStringOption(opt =>
        opt.setName('text')
          .setDescription('text')
          .setRequired(false)
      )
      .toJSON()
  );
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: buildCommands() }
    );
    console.log('Slash commands synced');
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
// COMMAND HANDLER
// =====================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmds = loadCommands();
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
// START
// =====================
client.login(TOKEN);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Dashboard running on', PORT));
