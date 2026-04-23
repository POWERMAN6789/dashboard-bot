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
// INIT
// =====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
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
// ACTION ENGINE (CORE)
// =====================
async function runActions(interaction, actions) {
  const vars = {
    user: interaction.user,
    guild: interaction.guild
  };

  for (const action of actions) {

    switch (action.type) {

      // =====================
      // 💬 MESSAGING ACTIONS
      // =====================
      case 'reply':
        await interaction.reply(replaceVars(action.text, vars));
        break;

      case 'followUp':
        await interaction.followUp(replaceVars(action.text, vars));
        break;

      case 'sendMessage': {
        const ch = await client.channels.fetch(action.channel);
        await ch.send(replaceVars(action.text, vars));
        break;
      }

      case 'dmUser':
        await interaction.user.send(replaceVars(action.text, vars));
        break;

      case 'editReply':
        await interaction.editReply(replaceVars(action.text, vars));
        break;

      // =====================
      // ⏱ TIMING
      // =====================
      case 'delay':
        await new Promise(r => setTimeout(r, action.ms || 1000));
        break;

      // =====================
      // 🎲 RANDOM
      // =====================
      case 'randomMessage': {
        const msg = action.options[Math.floor(Math.random() * action.options.length)];
        await interaction.reply(replaceVars(msg, vars));
        break;
      }

      // =====================
      // 📊 EMBEDS (simple)
      // =====================
      case 'embed':
        await interaction.reply({
          embeds: [{
            title: replaceVars(action.title, vars),
            description: replaceVars(action.description, vars),
            color: action.color || 0x00ff00
          }]
        });
        break;

      // =====================
      // 🧠 USER INFO
      // =====================
      case 'getUsername':
        await interaction.reply(interaction.user.username);
        break;

      case 'getServerName':
        await interaction.reply(interaction.guild.name);
        break;

      case 'getUserId':
        await interaction.reply(interaction.user.id);
        break;

      // =====================
      // 🔢 COUNTERS
      // =====================
      case 'counterAdd':
        action.value = (action.value || 0) + 1;
        break;

      case 'counterSet':
        action.value = action.number;
        break;

      // =====================
      // 📢 LOGGING
      // =====================
      case 'log':
        console.log(replaceVars(action.text, vars));
        break;

      // =====================
      // 🔄 REACTION
      // =====================
      case 'react':
        await interaction.reply('Reacting...');
        const msg = await interaction.fetchReply();
        await msg.react(action.emoji);
        break;

      // =====================
      // 🎯 CONDITIONALS
      // =====================
      case 'ifContains':
        if (interaction.commandName.includes(action.contains)) {
          await runActions(interaction, action.then || []);
        } else {
          await runActions(interaction, action.else || []);
        }
        break;

      // =====================
      // 🔀 LOOP
      // =====================
      case 'repeat':
        for (let i = 0; i < (action.times || 1); i++) {
          await runActions(interaction, action.actions || []);
        }
        break;

      // =====================
      // ⚠ UNKNOWN
      // =====================
      default:
        console.log('Unknown action:', action.type);
        break;
    }
  }
}

// =====================
// VARIABLE REPLACER
// =====================
function replaceVars(text, vars) {
  if (!text) return '';
  return text
    .replaceAll('{user}', vars.user.username)
    .replaceAll('{userid}', vars.user.id)
    .replaceAll('{server}', vars.guild?.name || 'DM');
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
<title>Bot Builder</title>
<style>
body { font-family: Arial; background:#111; color:white; padding:20px; }
input, select { margin:5px; padding:6px; }
button { padding:8px; cursor:pointer; }
table { width:100%; margin-top:20px; }
td, th { border:1px solid #444; padding:8px; }
</style>
</head>
<body>

<h1>🤖 Block Bot Dashboard</h1>

<h3>Create Command</h3>

<input id="name" placeholder="command name" />

<select id="type">
  <option value="reply">reply</option>
  <option value="dmUser">dmUser</option>
  <option value="embed">embed</option>
  <option value="randomMessage">randomMessage</option>
  <option value="sendMessage">sendMessage</option>
</select>

<input id="text" placeholder="text / message" />

<button onclick="add()">Add</button>

<hr>

<table>
<tr><th>Name</th><th>Type</th></tr>

${cmds.map(c => `
<tr>
<td>${c.name}</td>
<td>${c.actions?.[0]?.type || 'unknown'}</td>
</tr>
`).join('')}

</table>

<script>
async function add() {
  await fetch('/commands', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      name: document.getElementById('name').value,
      actions: [
        { type: document.getElementById('type').value, text: document.getElementById('text').value }
      ]
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
// API
// =====================
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
      .setDescription(cmd.description || 'block command')
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
  } catch (e) {
    console.error(e);
  }
}

// =====================
// EXECUTION
// =====================
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = loadCommands().find(c => c.name === interaction.commandName);
  if (!cmd) return;

  await runActions(interaction, cmd.actions || []);
});

// =====================
client.login(TOKEN);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Dashboard running on', PORT));
