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
// DATABASE (JSON)
// =====================
function load() {
  if (!fs.existsSync('./db.json')) return [];
  return JSON.parse(fs.readFileSync('./db.json'));
}

function save(data) {
  fs.writeFileSync('./db.json', JSON.stringify(data, null, 2));
}

// =====================
// BLOCK ENGINE (CORE)
// =====================
async function runBlocks(ctx, blocks) {
  for (const b of blocks) {

    switch (b.type) {

      case 'reply':
        if (ctx.reply) await ctx.reply(b.text);
        break;

      case 'sendMessage': {
        const ch = await client.channels.fetch(b.channel);
        await ch.send(b.text);
        break;
      }

      case 'dmUser': {
        const user = await client.users.fetch(b.userId);
        await user.send(b.text);
        break;
      }

      case 'delay':
        await new Promise(r => setTimeout(r, b.ms || 1000));
        break;

      case 'log':
        console.log('[LOG]', b.text);
        break;

      case 'embed':
        if (ctx.reply) {
          await ctx.reply({
            embeds: [{
              title: b.title,
              description: b.description,
              color: 0x3b82f6
            }]
          });
        }
        break;

      case 'random': {
        const pick = b.options[Math.floor(Math.random() * b.options.length)];
        if (ctx.reply) await ctx.reply(pick);
        break;
      }

    }
  }
}

// =====================
// DASHBOARD EXECUTOR
// =====================
async function runDashboardEvent(name) {
  const db = load();
  const cmd = db.find(x => x.name === name);

  if (!cmd) return;

  await runBlocks(
    {
      reply: async (msg) => console.log('[DASHBOARD]', msg)
    },
    cmd.blocks || []
  );
}

// =====================
// DASHBOARD UI (PROFESSIONAL)
// =====================
app.get('/', (req, res) => {
  const db = load();

  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Control Panel</title>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">

<style>
body {
  margin:0;
  font-family: Inter;
  background:#0b0f19;
  color:white;
  display:flex;
}

.sidebar {
  width:260px;
  background:#111827;
  padding:20px;
}

.sidebar h2 {
  font-size:14px;
  color:#94a3b8;
}

.btn {
  width:100%;
  margin-top:10px;
  padding:10px;
  background:#1f2937;
  border:none;
  color:white;
  border-radius:8px;
  cursor:pointer;
}

.btn:hover { background:#374151; }

.main {
  flex:1;
  padding:25px;
}

.card {
  background:#111827;
  padding:20px;
  border-radius:12px;
  margin-bottom:15px;
}

input, select {
  width:100%;
  padding:10px;
  margin:6px 0;
  border-radius:8px;
  border:none;
  background:#0f172a;
  color:white;
}

.block {
  background:#0f172a;
  padding:10px;
  margin:5px 0;
  border-radius:8px;
}

small { color:#94a3b8; }
</style>

</head>

<body>

<div class="sidebar">
  <h2>CONTROL PANEL</h2>

  <button class="btn" onclick="show('builder')">🧱 Block Builder</button>
  <button class="btn" onclick="show('events')">📜 Events</button>
  <button class="btn" onclick="show('run')">⚡ Run Event</button>
</div>

<div class="main">

<!-- BUILDER -->
<div id="builder" class="card">
  <h2>Create Block Command</h2>

  <input id="name" placeholder="command name" />

  <select id="trigger">
    <option value="dashboard">Dashboard</option>
    <option value="slash">Slash</option>
  </select>

  <h3>Block</h3>

  <select id="type">
    <option value="reply">Reply</option>
    <option value="sendMessage">Send Message</option>
    <option value="dmUser">DM User</option>
    <option value="delay">Delay</option>
    <option value="log">Log</option>
  </select>

  <input id="text" placeholder="text" />
  <input id="channel" placeholder="channel id" />
  <input id="userId" placeholder="user id" />
  <input id="ms" placeholder="delay ms" />

  <button onclick="create()">Create Event</button>
</div>

<!-- EVENTS -->
<div id="events" class="card" style="display:none">
  <h2>All Events</h2>

  ${db.map(c => `
    <div class="block">
      <b>${c.name}</b><br>
      <small>${c.trigger}</small>
    </div>
  `).join('')}
</div>

<!-- RUN -->
<div id="run" class="card" style="display:none">
  <h2>Run Dashboard Event</h2>

  <select id="eventList">
    ${db.filter(x => x.trigger === 'dashboard').map(c =>
      `<option value="${c.name}">${c.name}</option>`
    ).join('')}
  </select>

  <button onclick="run()">Run</button>
</div>

</div>

<script>
function show(id) {
  builder.style.display = 'none';
  events.style.display = 'none';
  run.style.display = 'none';
  document.getElementById(id).style.display = 'block';
}

async function create() {
  await fetch('/create', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      name: name.value,
      trigger: trigger.value,
      blocks: [
        {
          type: type.value,
          text: text.value,
          channel: channel.value,
          userId: userId.value,
          ms: Number(ms.value)
        }
      ]
    })
  });

  location.reload();
}

async function run() {
  await fetch('/run/' + eventList.value, { method:'POST' });
  alert('Executed');
}
</script>

</body>
</html>
  `);
});

// =====================
// CREATE
// =====================
app.post('/create', (req, res) => {
  const db = load();
  db.push(req.body);
  save(db);
  res.json({ ok: true });
});

// =====================
// RUN DASHBOARD EVENT
// =====================
app.post('/run/:name', async (req, res) => {
  await runDashboardEvent(req.params.name);
  res.json({ ok: true });
});

// =====================
// SLASH COMMANDS
// =====================
client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  const cmd = load().find(x => x.name === i.commandName && x.trigger === 'slash');
  if (!cmd) return;

  await runBlocks(i, cmd.blocks || []);
});

// =====================
client.login(TOKEN);

app.listen(3000, () => console.log('Dashboard running'));
