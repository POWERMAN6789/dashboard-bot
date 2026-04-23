const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const app = express();
app.use(express.json());

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// =====================
// FILE STORAGE
// =====================
function loadCommands() {
  return JSON.parse(fs.readFileSync('./commands.json'));
}

function saveCommands(data) {
  fs.writeFileSync('./commands.json', JSON.stringify(data, null, 2));
}

// =====================
// DASHBOARD UI (REAL)
// =====================
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Bot Dashboard</title>
<style>
  body { font-family: Arial; background:#0f0f0f; color:white; margin:0; padding:20px; }
  .card { background:#1c1c1c; padding:15px; border-radius:10px; margin-bottom:15px; }
  button { padding:8px 12px; border:none; border-radius:6px; cursor:pointer; }
  input, select { padding:8px; margin:5px 0; width:100%; }
  table { width:100%; border-collapse:collapse; margin-top:10px; }
  td, th { padding:10px; border-bottom:1px solid #333; }
  .green { color:lime; }
  .red { color:red; }
</style>
</head>

<body>

<h1>🤖 Discord Bot Dashboard</h1>

<div class="card">
  <h2>Status: <span id="status">Loading...</span></h2>
  <button onclick="checkStatus()">Refresh Status</button>
</div>

<div class="card">
  <h2>Create Command</h2>

  <input id="name" placeholder="Command name (e.g. echo)" />

  <select id="type">
    <option value="echo">Echo</option>
    <option value="ping">Ping</option>
  </select>

  <button onclick="addCommand()">➕ Add Command</button>
</div>

<div class="card">
  <h2>Commands</h2>
  <button onclick="loadCommands()">🔄 Refresh</button>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Type</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody id="cmdTable"></tbody>
  </table>
</div>

<script>

async function checkStatus() {
  const res = await fetch('/status');
  const data = await res.json();
  document.getElementById('status').innerHTML =
    data.status === 'online'
      ? '<span class="green">ONLINE 🟢</span>'
      : '<span class="red">OFFLINE 🔴</span>';
}

async function addCommand() {
  const name = document.getElementById('name').value;
  const type = document.getElementById('type').value;

  await fetch('/commands', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name, description: name, type })
  });

  loadCommands();
}

async function deleteCommand(name) {
  await fetch('/commands/' + name, { method: 'DELETE' });
  loadCommands();
}

async function loadCommands() {
  const res = await fetch('/commands');
  const data = await res.json();

  const table = document.getElementById('cmdTable');
  table.innerHTML = '';

  data.forEach(cmd => {
    table.innerHTML += `
      <tr>
        <td>${cmd.name}</td>
        <td>${cmd.type}</td>
        <td><button onclick="deleteCommand('${cmd.name}')">Delete</button></td>
      </tr>
    `;
  });
}

checkStatus();
loadCommands();

</script>

</body>
</html>
  `);
});

// =====================
// API
// =====================
app.get('/status', (req, res) => {
  res.json({ status: 'online', uptime: process.uptime() });
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

app.delete('/commands/:name', (req, res) => {
  let cmds = loadCommands();
  cmds = cmds.filter(c => c.name !== req.params.name);
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
      .setDescription(cmd.description)
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
    console.log('Commands synced');
  } catch (err) {
    console.error(err);
  }
}

// =====================
// BOT
// =====================
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

// EXECUTE COMMANDS
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmds = loadCommands();
  const cmd = cmds.find(c => c.name === interaction.commandName);

  if (!cmd) return;

  if (cmd.type === 'echo') {
    const text = interaction.options.getString('text');
    await interaction.reply(text || 'No text');
  }

  if (cmd.type === 'ping') {
    await interaction.reply('Pong!');
  }
});

client.login(TOKEN);

// =====================
// SERVER START
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Dashboard running on', PORT));
