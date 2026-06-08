const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const store = require('../utils/store');

// Active game sessions
if (!global.gameSessions) global.gameSessions = {};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('game')
    .setDescription('Play games across all connected servers')
    .addSubcommand(sub =>
      sub.setName('trivia').setDescription('Start a trivia game across all servers'))
    .addSubcommand(sub =>
      sub.setName('wordchain').setDescription('Start a word chain game'))
    .addSubcommand(sub =>
      sub.setName('hangman').setDescription('Start a hangman game'))
    .addSubcommand(sub =>
      sub.setName('wouldyourather').setDescription('Start a Would You Rather poll'))
    .addSubcommand(sub =>
      sub.setName('truthordare').setDescription('Truth or dare across servers'))
    .addSubcommand(sub =>
      sub.setName('pollwars').setDescription('Start a poll war between servers'))
    .addSubcommand(sub =>
      sub.setName('counting').setDescription('Start the counting game'))
    .addSubcommand(sub =>
      sub.setName('emojistory').setDescription('Build a story with emojis'))
    .addSubcommand(sub =>
      sub.setName('roastbattle').setDescription('Roast battle between servers'))
    .addSubcommand(sub =>
      sub.setName('stop').setDescription('Stop the current game')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const network = store.getNetworkByGuild(guildId);

    if (!network) {
      return interaction.reply({ content: '❌ Your server is not in any network.', ephemeral: true });
    }

    const networkId = network.id;

    if (sub === 'stop') {
      if (global.gameSessions[networkId]) {
        delete global.gameSessions[networkId];
        await broadcastToNetwork(network, client, '🛑 Game stopped!');
        return interaction.reply({ content: '✅ Game stopped.', ephemeral: true });
      }
      return interaction.reply({ content: '❌ No active game.', ephemeral: true });
    }

    if (global.gameSessions[networkId]) {
      return interaction.reply({ content: '❌ A game is already running. Use `/game stop` first.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    if (sub === 'trivia') {
      await startTrivia(network, networkId, client, interaction);
    } else if (sub === 'wordchain') {
      await startWordChain(network, networkId, client, interaction);
    } else if (sub === 'hangman') {
      await startHangman(network, networkId, client, interaction);
    } else if (sub === 'wouldyourather') {
      await startWouldYouRather(network, networkId, client, interaction);
    } else if (sub === 'truthordare') {
      await startTruthOrDare(network, networkId, client, interaction);
    } else if (sub === 'pollwars') {
      await startPollWars(network, networkId, client, interaction);
    } else if (sub === 'counting') {
      await startCounting(network, networkId, client, interaction);
    } else if (sub === 'emojistory') {
      await startEmojiStory(network, networkId, client, interaction);
    } else if (sub === 'roastbattle') {
      await startRoastBattle(network, networkId, client, interaction);
    }
  }
};

async function broadcastToNetwork(network, client, message) {
  for (const entry of Object.values(network.servers)) {
    try {
      const guild = await client.guilds.fetch(entry.guildId);
      const channel = await guild.channels.fetch(entry.channelId);
      if (channel) await channel.send(message);
    } catch (err) {
      console.error(err.message);
    }
  }
}

async function broadcastEmbedToNetwork(network, client, embed) {
  for (const entry of Object.values(network.servers)) {
    try {
      const guild = await client.guilds.fetch(entry.guildId);
      const channel = await guild.channels.fetch(entry.channelId);
      if (channel) await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err.message);
    }
  }
}

// ── TRIVIA ──────────────────────────────────────────────────────────────────
const triviaQuestions = [
  { q: 'What is the capital of Japan?', a: 'tokyo', hint: 'Starts with T' },
  { q: 'How many sides does a hexagon have?', a: '6', hint: 'Less than 10' },
  { q: 'What planet is known as the Red Planet?', a: 'mars', hint: 'Starts with M' },
  { q: 'Who painted the Mona Lisa?', a: 'leonardo da vinci', hint: 'Italian artist' },
  { q: 'What is the fastest land animal?', a: 'cheetah', hint: 'Big cat' },
  { q: 'How many colors are in a rainbow?', a: '7', hint: 'Single digit' },
  { q: 'What gas do plants absorb?', a: 'carbon dioxide', hint: 'CO2' },
  { q: 'What is the largest ocean?', a: 'pacific', hint: 'Starts with P' },
  { q: 'How many continents are there?', a: '7', hint: 'Same as rainbow colors' },
  { q: 'What is the square root of 144?', a: '12', hint: 'A dozen' },
];

async function startTrivia(network, networkId, client, interaction) {
  const scores = {};
  let round = 0;
  const totalRounds = 5;

  global.gameSessions[networkId] = { type: 'trivia', scores, active: true };

  await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle('🎮 Trivia Game Starting!')
    .setDescription(`${totalRounds} rounds across all servers!\nFirst correct answer in each server wins the point!\nGame starts in 5 seconds...`)
  );

  await delay(5000);

  const askQuestion = async () => {
    if (round >= totalRounds || !global.gameSessions[networkId]) {
      // End game
      const scoreBoard = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .map(([name, pts], i) => `${i + 1}. **${name}**: ${pts} pts`)
        .join('\n') || 'No scores yet';

      await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🏆 Trivia Finished!')
        .setDescription(`**Final Scores:**\n${scoreBoard}`)
      );
      delete global.gameSessions[networkId];
      return;
    }

    const q = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
    global.gameSessions[networkId].currentAnswer = q.a;
    global.gameSessions[networkId].answeredServers = new Set();
    round++;

    await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle(`❓ Round ${round}/${totalRounds}`)
      .setDescription(`**${q.q}**\n\n💡 Hint: ${q.hint}\nYou have 20 seconds!`)
    );

    // Listen for answers
    const collector = setupMessageCollector(network, client, networkId, async (msg) => {
      const session = global.gameSessions[networkId];
      if (!session) return;
      if (msg.content.toLowerCase().trim() === session.currentAnswer) {
        const key = `${msg.author.username} (${msg.guild.name})`;
        scores[key] = (scores[key] || 0) + 1;
        session.answeredServers = session.answeredServers || new Set();
        await broadcastToNetwork(network, client,
          `✅ **${msg.author.username}** from **${msg.guild.name}** got it right! Answer: **${q.a}**`);
        collector.stop();
      }
    });

    setTimeout(async () => {
      collector.stop();
      if (global.gameSessions[networkId]?.currentAnswer) {
        await broadcastToNetwork(network, client, `⏰ Time's up! The answer was: **${q.a}**`);
      }
      await delay(2000);
      askQuestion();
    }, 20000);
  };

  askQuestion();
  await interaction.editReply({ content: '✅ Trivia started!' });
}

// ── WORD CHAIN ───────────────────────────────────────────────────────────────
async function startWordChain(network, networkId, client, interaction) {
  global.gameSessions[networkId] = { type: 'wordchain', lastWord: null, usedWords: new Set(), active: true };

  await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🔤 Word Chain!')
    .setDescription('Each player must say a word starting with the last letter of the previous word!\nNo repeats!\nI\'ll start: **Apple**')
  );

  global.gameSessions[networkId].lastWord = 'apple';
  global.gameSessions[networkId].usedWords.add('apple');

  setupMessageCollector(network, client, networkId, async (msg) => {
    const session = global.gameSessions[networkId];
    if (!session || session.type !== 'wordchain') return;
    const word = msg.content.toLowerCase().trim();
    if (!/^[a-z]+$/.test(word)) return;

    const lastLetter = session.lastWord.slice(-1);
    if (word[0] !== lastLetter) {
      await msg.reply(`❌ Must start with **${lastLetter.toUpperCase()}**!`);
      return;
    }
    if (session.usedWords.has(word)) {
      await msg.reply(`❌ **${word}** already used!`);
      return;
    }

    session.lastWord = word;
    session.usedWords.add(word);
    await msg.react('✅');
  });

  await interaction.editReply({ content: '✅ Word Chain started!' });
}

// ── HANGMAN ──────────────────────────────────────────────────────────────────
const hangmanWords = ['discord', 'network', 'bridge', 'server', 'channel', 'webhook', 'message', 'community'];
const hangmanStages = ['😵', '😨', '😰', '😟', '😐', '🙂', '😊'];

async function startHangman(network, networkId, client, interaction) {
  const word = hangmanWords[Math.floor(Math.random() * hangmanWords.length)];
  const guessed = new Set();
  let wrong = 0;
  const maxWrong = 6;

  global.gameSessions[networkId] = { type: 'hangman', word, guessed, wrong, active: true };

  const display = () => word.split('').map(l => guessed.has(l) ? l : '_').join(' ');

  await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('🪓 Hangman!')
    .setDescription(`Word: \`${display()}\`\nGuess one letter at a time!\n${hangmanStages[maxWrong - wrong]} Lives: ${maxWrong - wrong}`)
  );

  setupMessageCollector(network, client, networkId, async (msg) => {
    const session = global.gameSessions[networkId];
    if (!session || session.type !== 'hangman') return;
    const letter = msg.content.toLowerCase().trim();
    if (!/^[a-z]$/.test(letter)) return;
    if (session.guessed.has(letter)) { await msg.reply('Already guessed!'); return; }

    session.guessed.add(letter);
    if (!session.word.includes(letter)) session.wrong++;

    const disp = session.word.split('').map(l => session.guessed.has(l) ? l : '_').join(' ');
    const won = !disp.includes('_');
    const lost = session.wrong >= maxWrong;

    if (won) {
      await broadcastToNetwork(network, client,
        `🎉 **${msg.author.username}** from **${msg.guild.name}** completed the word: **${session.word}**!`);
      delete global.gameSessions[networkId];
    } else if (lost) {
      await broadcastToNetwork(network, client, `💀 Game over! The word was **${session.word}**!`);
      delete global.gameSessions[networkId];
    } else {
      await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🪓 Hangman')
        .setDescription(`Word: \`${disp}\`\nGuessed: ${[...session.guessed].join(', ')}\n${hangmanStages[maxWrong - session.wrong]} Lives: ${maxWrong - session.wrong}`)
      );
    }
  });

  await interaction.editReply({ content: '✅ Hangman started!' });
}

// ── WOULD YOU RATHER ─────────────────────────────────────────────────────────
const wyrQuestions = [
  ['Be able to fly', 'Be invisible'],
  ['Always be cold', 'Always be hot'],
  ['Have no internet', 'Have no music'],
  ['Be the funniest person', 'Be the smartest person'],
  ['Live in the past', 'Live in the future'],
];

async function startWouldYouRather(network, networkId, client, interaction) {
  const q = wyrQuestions[Math.floor(Math.random() * wyrQuestions.length)];
  const votes = { A: [], B: [] };
  global.gameSessions[networkId] = { type: 'wyr', votes, active: true };

  await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('🤔 Would You Rather?')
    .setDescription(`**A)** ${q[0]}\n**B)** ${q[1]}\n\nType \`A\` or \`B\` to vote! (30 seconds)`)
  );

  setupMessageCollector(network, client, networkId, async (msg) => {
    const session = global.gameSessions[networkId];
    if (!session || session.type !== 'wyr') return;
    const v = msg.content.toUpperCase().trim();
    if (v !== 'A' && v !== 'B') return;
    const name = `${msg.author.username} (${msg.guild.name})`;
    if (session.votes.A.includes(name) || session.votes.B.includes(name)) return;
    session.votes[v].push(name);
    await msg.react(v === 'A' ? '🅰️' : '🅱️');
  });

  setTimeout(async () => {
    const session = global.gameSessions[networkId];
    if (!session) return;
    delete global.gameSessions[networkId];
    await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('📊 Would You Rather Results')
      .setDescription(
        `**A) ${q[0]}**: ${session.votes.A.length} votes\n${session.votes.A.join(', ') || 'None'}\n\n` +
        `**B) ${q[1]}**: ${session.votes.B.length} votes\n${session.votes.B.join(', ') || 'None'}`
      )
    );
  }, 30000);

  await interaction.editReply({ content: '✅ Would You Rather started!' });
}

// ── TRUTH OR DARE ────────────────────────────────────────────────────────────
const truths = [
  'What is your most embarrassing Discord moment?',
  'What server do you spend the most time in?',
  'Have you ever been banned from a server?',
  'What emoji do you use the most?',
];
const dares = [
  'Change your nickname to "BridgeBot Fan" for 10 minutes',
  'Send the most recent meme in your phone',
  'Type a compliment to every server in this network',
  'Do a impression of your server owner',
];

async function startTruthOrDare(network, networkId, client, interaction) {
  global.gameSessions[networkId] = { type: 'tod', active: true };

  // Pick random player from network servers
  const servers = Object.values(network.servers);
  const randomServer = servers[Math.floor(Math.random() * servers.length)];
  const isTruth = Math.random() > 0.5;
  const question = isTruth
    ? truths[Math.floor(Math.random() * truths.length)]
    : dares[Math.floor(Math.random() * dares.length)];

  await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`${isTruth ? '💬 Truth' : '💥 Dare'} — Server: ${randomServer.guildName}`)
    .setDescription(`**${question}**\n\nSomeone from **${randomServer.guildName}** must answer!`)
  );

  delete global.gameSessions[networkId];
  await interaction.editReply({ content: '✅ Truth or Dare sent!' });
}

// ── POLL WARS ────────────────────────────────────────────────────────────────
const pollTopics = [
  ['Cats', 'Dogs'],
  ['Summer', 'Winter'],
  ['Pizza', 'Burgers'],
  ['Movies', 'Games'],
  ['Morning', 'Night'],
];

async function startPollWars(network, networkId, client, interaction) {
  const topic = pollTopics[Math.floor(Math.random() * pollTopics.length)];
  const votes = {};
  Object.values(network.servers).forEach(s => { votes[s.guildId] = { A: 0, B: 0 }; });
  global.gameSessions[networkId] = { type: 'pollwars', topic, votes, voted: new Set(), active: true };

  await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle('⚔️ Poll Wars!')
    .setDescription(`**${topic[0]}** vs **${topic[1]}**\nType \`A\` for ${topic[0]} or \`B\` for ${topic[1]}!\n30 seconds to vote!`)
  );

  setupMessageCollector(network, client, networkId, async (msg) => {
    const session = global.gameSessions[networkId];
    if (!session || session.type !== 'pollwars') return;
    const v = msg.content.toUpperCase().trim();
    if (v !== 'A' && v !== 'B') return;
    if (session.voted.has(msg.author.id)) return;
    session.voted.add(msg.author.id);
    session.votes[msg.guild.id][v]++;
    await msg.react('✅');
  });

  setTimeout(async () => {
    const session = global.gameSessions[networkId];
    if (!session) return;
    delete global.gameSessions[networkId];

    const results = Object.entries(session.votes).map(([gId, v]) => {
      const entry = network.servers[gId];
      const winner = v.A > v.B ? topic[0] : v.B > v.A ? topic[1] : 'Tie';
      return `**${entry?.guildName}**: ${topic[0]} ${v.A} — ${v.B} ${topic[1]} → ${winner}`;
    }).join('\n');

    await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
      .setColor(0x1abc9c)
      .setTitle('📊 Poll Wars Results')
      .setDescription(results)
    );
  }, 30000);

  await interaction.editReply({ content: '✅ Poll Wars started!' });
}

// ── COUNTING ─────────────────────────────────────────────────────────────────
async function startCounting(network, networkId, client, interaction) {
  global.gameSessions[networkId] = { type: 'counting', count: 0, lastUser: null, active: true };

  await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🔢 Counting Game!')
    .setDescription('Count up together! Type the next number.\nSame person can\'t count twice in a row.\nWrong number = reset!')
  );

  setupMessageCollector(network, client, networkId, async (msg) => {
    const session = global.gameSessions[networkId];
    if (!session || session.type !== 'counting') return;
    const num = parseInt(msg.content.trim());
    if (isNaN(num)) return;

    if (msg.author.id === session.lastUser) {
      await msg.reply('❌ You can\'t count twice in a row!');
      return;
    }

    if (num === session.count + 1) {
      session.count++;
      session.lastUser = msg.author.id;
      await msg.react('✅');
      if (session.count % 10 === 0) {
        await broadcastToNetwork(network, client, `🎉 You reached **${session.count}**! Keep going!`);
      }
    } else {
      const prev = session.count;
      session.count = 0;
      session.lastUser = null;
      await broadcastToNetwork(network, client,
        `💥 **${msg.author.username}** ruined it at **${prev}**! Back to 0!`);
    }
  });

  await interaction.editReply({ content: '✅ Counting game started!' });
}

// ── EMOJI STORY ──────────────────────────────────────────────────────────────
async function startEmojiStory(network, networkId, client, interaction) {
  global.gameSessions[networkId] = { type: 'emojistory', story: [], active: true };

  await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('📖 Emoji Story!')
    .setDescription('Build a story one emoji at a time! Each person adds one emoji.\nAfter 20 emojis the story ends!\nStart now! 🌍')
  );

  global.gameSessions[networkId].story.push('🌍');

  setupMessageCollector(network, client, networkId, async (msg) => {
    const session = global.gameSessions[networkId];
    if (!session || session.type !== 'emojistory') return;
    // Simple emoji detection
    const emojiMatch = msg.content.trim().match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
    if (!emojiMatch) return;

    session.story.push(emojiMatch[0]);
    await msg.react('✅');

    if (session.story.length >= 20) {
      await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('📖 The Story is Complete!')
        .setDescription(session.story.join(' '))
      );
      delete global.gameSessions[networkId];
    }
  });

  await interaction.editReply({ content: '✅ Emoji Story started!' });
}

// ── ROAST BATTLE ─────────────────────────────────────────────────────────────
const roasts = [
  'Your server is so empty, even the bots left.',
  'Your ping is so high, you\'re basically time traveling.',
  'Your server icon looks like it was made in MS Paint.',
  'You\'ve been in voice chat so long your mic has separation anxiety.',
  'Your server rules are longer than your member list.',
];

async function startRoastBattle(network, networkId, client, interaction) {
  const servers = Object.values(network.servers);
  if (servers.length < 2) {
    return interaction.editReply({ content: '❌ Need at least 2 servers for a roast battle.' });
  }

  const [a, b] = servers.sort(() => 0.5 - Math.random()).slice(0, 2);
  const roastA = roasts[Math.floor(Math.random() * roasts.length)];
  const roastB = roasts[Math.floor(Math.random() * roasts.length)];

  await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('🔥 Roast Battle!')
    .setDescription(
      `**${a.guildName}** 🆚 **${b.guildName}**\n\n` +
      `🔥 **${a.guildName}** says to **${b.guildName}**:\n"${roastA}"\n\n` +
      `🔥 **${b.guildName}** fires back at **${a.guildName}**:\n"${roastB}"\n\n` +
      `Vote 🅰️ for ${a.guildName} or 🅱️ for ${b.guildName}! (30 sec)`
    )
  );

  const votes = { A: 0, B: 0 };
  const voted = new Set();
  global.gameSessions[networkId] = { type: 'roast', votes, voted, a, b, active: true };

  setupMessageCollector(network, client, networkId, async (msg) => {
    const session = global.gameSessions[networkId];
    if (!session || session.type !== 'roast') return;
    const v = msg.content.toUpperCase().trim();
    if (v !== 'A' && v !== 'B') return;
    if (session.voted.has(msg.author.id)) return;
    session.voted.add(msg.author.id);
    session.votes[v]++;
  });

  setTimeout(async () => {
    const session = global.gameSessions[networkId];
    if (!session) return;
    delete global.gameSessions[networkId];
    const winner = session.votes.A > session.votes.B ? a.guildName
      : session.votes.B > session.votes.A ? b.guildName : 'Nobody (tie!)';
    await broadcastEmbedToNetwork(network, client, new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🏆 Roast Battle Winner')
      .setDescription(`**${winner}** wins the roast battle!\n${a.guildName}: ${session.votes.A} | ${b.guildName}: ${session.votes.B}`)
    );
  }, 30000);

  await interaction.editReply({ content: '✅ Roast Battle started!' });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function setupMessageCollector(network, client, networkId, handler) {
  // We attach listeners on each channel
  const listeners = [];
  for (const entry of Object.values(network.servers)) {
    const listener = async (message) => {
      if (message.author.bot) return;
      const net = store.getNetworkByGuild(message.guild?.id);
      if (!net || net.id !== networkId) return;
      const serverEntry = net.servers[message.guild.id];
      if (!serverEntry || message.channel.id !== serverEntry.channelId) return;
      await handler(message);
    };
    client.on('messageCreate', listener);
    listeners.push(listener);
  }

  // Return a stopper
  return {
    stop: () => {
      for (const l of listeners) client.off('messageCreate', l);
    }
  };
}
