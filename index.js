const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const express = require('express');
const fs = require('fs');

// =====================
// CONFIG
// =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// =====================
// INIT
// =====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const app = express();
app.use(express.json());

// =====================
// STORAGE
// =====================
function loadCommands() {
  if (!fs.existsSync('./commands.json')) return [];
  return JSON.parse(fs.readFileSync('./commands.json'));
}

function saveCommands(data) {
  fs.writeFileSync('./commands.json', JSON.stringify(data, null, 2));
}

// =====================
// ACTION ENGINE
// =====================
async function runActions(context, actions) {
  for (const action of actions) {

    // 💬 reply
    if (action.type === 'reply') {
      if (context.reply) await context.reply(action.text);
    }

    // 📢 send message
    if (action.type === 'sendMessage') {
      const ch = await client.channels.fetch(action.channel);
      await ch.send(action.text);
    }

    // 👤 DM user
    if (action.type === 'dmUserById') {
      const user = await client.users.fetch(action.userId);
      await user.send(action.text);
    }

    // ⏱ delay
    if (action.type === 'delay') {
      await new Promise(r => setTimeout(r, action.ms || 1000));
    }

    // 📢 log
    if (action.type === 'log') {
      console.log(action.text);
    }
  }
}

// =====================
// DASHBOARD UI
// =====================
app.get('/', (req, res) => {
  const cmds = loadCommands();

  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Bot Dashboard</title>
<style>
body { font-family: Arial; background:#111; color:white; padding:20px; }
input, select { padding:8px; margin:5px; }
button { padding:8px; cursor:pointer; }
table { width:100%; margin-top:20px; }
td, th { border:1px solid #444; padding:8px; }
</style>
</head>
<body>

<h1>🤖 Bot Dashboard</h1>

<h2>Create Event</h2>

<input id="name" placeholder="event name" />

<select id="trigger">
  <option value="slash">Slash Command</option>
  <option value="dashboard">Dashboard Event</option>
</select>

<br>

<select id="action">
  <option value="reply">Reply</option>
  <option value="sendMessage">Send Message</option>
  <option value="dmUserById">DM User (by ID)</option>
  <option value="log">Log</option>
</select>

<br>

<input id="text" placeholder="text/message" />
<input id="channel" placeholder="channel ID (if needed)" />
<input id="userId" placeholder="user ID (DM only)" />

<br>

<button onclick="create()">Create</button>

<hr>

<h2>Dashboard Events</h2>
<select id="eventList">
  ${cmds.filter(c => c.trigger === 'dashboard').map(c =>
    `<option value="${c.name}">${c.name}</option>`
  ).join('')}
</select>

<button onclick="runEvent()">Run Event</button>

<hr>

<h2>All Events</h2>

<table>
<tr><th>Name</th><th>Trigger</th></tr>

${cmds.map(c => `
<tr>
<td>${c.name}</td>
<td>${c.trigger}</td>
</tr>
`).join('')}

</table>

<script>
async function create() {
  await fetch('/commands', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      name: document.getElementById('name').value,
      trigger: document.getElementById('trigger').value,
      actions: [
        {
          type: document.getElementById('action').value,
          text: document.getElementById('text').value,
          channel: document.getElementById('channel').value,
          userId: document.getElementById('userId').value
        }
      ]
    })
  });

  location.reload();
}

async function runEvent() {
  const name = document.getElementById('eventList').value;

  await fetch('/trigger/' + name, { method: 'POST' });

  alert('Event executed');
}
</script>

</body>
</html>
  `);
});

// =====================
// CREATE COMMAND
// =====================
app.post('/commands', (req, res) => {
  const cmds = loadCommands();
  cmds.push(req.body);
  saveCommands(cmds);
  res.json({ success: true });
});

// =====================
// DASHBOARD TRIGGER
// =====================
app.post('/trigger/:name', async (req, res) => {
  const cmd = loadCommands().find(c => c.name === req.params.name);

  if (!cmd) return res.json({ error: 'not found' });

  await runActions(
    {
      reply: async (msg) => console.log('[DASHBOARD]', msg)
    },
    cmd.actions
  );

  res.json({ success: true });
});

// =====================
// SLASH COMMANDS
// =====================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = loadCommands().find(c =>
    c.name === interaction.commandName && c.trigger === 'slash'
  );

  if (!cmd) return;

  await runActions(interaction, cmd.actions);
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Dashboard running on', PORT));
