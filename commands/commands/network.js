const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const store = require('../utils/store');
const crypto = require('crypto');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('network')
    .setDescription('Manage your server network')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('create').setDescription('Create a new network and get an invite link'))
    .addSubcommand(sub =>
      sub.setName('join')
        .setDescription('Join a network using an invite token')
        .addStringOption(opt =>
          opt.setName('token').setDescription('The invite token').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('leave').setDescription('Leave the current network'))
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List all servers in your network'))
    .addSubcommand(sub =>
      sub.setName('invite').setDescription('Generate a new invite token for your network')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const guildName = interaction.guild.name;

    if (sub === 'create') {
      // Must set /home first
      const homeData = (global.pendingHomes || {})[guildId];
      const existingNet = store.getNetworkByGuild(guildId);

      if (existingNet) {
        return interaction.reply({
          content: `❌ Your server is already in network \`${existingNet.id}\`. Use \`/network leave\` first.`,
          ephemeral: true
        });
      }

      if (!homeData) {
        return interaction.reply({
          content: '❌ Please set a bridge channel first using `/home`.',
          ephemeral: true
        });
      }

      const networkId = store.generateId(6);
      const inviteToken = crypto.randomBytes(16).toString('hex');
      const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      const network = {
        id: networkId,
        createdBy: guildId,
        servers: {
          [guildId]: { guildId, channelId: homeData.channelId, guildName }
        },
        privateChats: [],
        pendingInvites: {
          [inviteToken]: { fromGuild: guildId, expires }
        }
      };

      store.saveNetwork(network);
      delete global.pendingHomes[guildId];

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🌐 Network Created!')
        .setDescription(
          `**Network ID:** \`${networkId}\`\n\n` +
          `**Invite Token** (share this with other server admins):\n\`\`\`${inviteToken}\`\`\`\n` +
          `⏰ Token expires in **24 hours**.\n` +
          `Generate a new one anytime with \`/network invite\`.`
        )
        .setFooter({ text: 'Only admins can join using this token' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'join') {
      const token = interaction.options.getString('token');
      const homeData = (global.pendingHomes || {})[guildId];
      const existingNet = store.getNetworkByGuild(guildId);

      if (existingNet) {
        return interaction.reply({
          content: `❌ Already in network \`${existingNet.id}\`. Use \`/network leave\` first.`,
          ephemeral: true
        });
      }

      if (!homeData) {
        return interaction.reply({
          content: '❌ Please set a bridge channel first using `/home`.',
          ephemeral: true
        });
      }

      // Find network with this token
      const allNetworks = store.getAll();
      let foundNetwork = null;
      for (const net of Object.values(allNetworks)) {
        if (net.pendingInvites && net.pendingInvites[token]) {
          const invite = net.pendingInvites[token];
          if (Date.now() > invite.expires) {
            return interaction.reply({ content: '❌ This invite token has expired.', ephemeral: true });
          }
          foundNetwork = net;
          break;
        }
      }

      if (!foundNetwork) {
        return interaction.reply({ content: '❌ Invalid invite token.', ephemeral: true });
      }

      if (Object.keys(foundNetwork.servers).length >= 10) {
        return interaction.reply({ content: '❌ This network is full (max 10 servers).', ephemeral: true });
      }

      // Add this server
      foundNetwork.servers[guildId] = { guildId, channelId: homeData.channelId, guildName };
      // Remove used token
      delete foundNetwork.pendingInvites[token];
      store.saveNetwork(foundNetwork);
      delete global.pendingHomes[guildId];

      // Announce to all other servers
      await announceToNetwork(foundNetwork, guildId, client,
        `🟢 **${guildName}** has joined the network! Say hello!`);

      const serverList = Object.values(foundNetwork.servers)
        .map(s => `• ${s.guildName}`).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Joined Network!')
        .setDescription(
          `**Network ID:** \`${foundNetwork.id}\`\n\n` +
          `**Connected Servers:**\n${serverList}`
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'leave') {
      const network = store.getNetworkByGuild(guildId);
      if (!network) {
        return interaction.reply({ content: '❌ Your server is not in any network.', ephemeral: true });
      }

      await announceToNetwork(network, guildId, client,
        `🔴 **${guildName}** has left the network.`);

      store.removeGuildFromNetwork(guildId);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('👋 Left Network')
          .setDescription(`Your server has left network \`${network.id}\`.`)
        ],
        ephemeral: true
      });
    }

    if (sub === 'list') {
      const network = store.getNetworkByGuild(guildId);
      if (!network) {
        return interaction.reply({ content: '❌ Your server is not in any network.', ephemeral: true });
      }

      const serverList = Object.values(network.servers)
        .map(s => s.guildId === guildId ? `• **${s.guildName}** (you)` : `• ${s.guildName}`)
        .join('\n');

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle(`🌐 Network: ${network.id}`)
          .setDescription(`**Connected Servers (${Object.keys(network.servers).length}/10):**\n${serverList}`)
        ],
        ephemeral: true
      });
    }

    if (sub === 'invite') {
      const network = store.getNetworkByGuild(guildId);
      if (!network) {
        return interaction.reply({ content: '❌ Your server is not in any network.', ephemeral: true });
      }

      const token = crypto.randomBytes(16).toString('hex');
      const expires = Date.now() + 24 * 60 * 60 * 1000;
      network.pendingInvites = network.pendingInvites || {};
      network.pendingInvites[token] = { fromGuild: guildId, expires };
      store.saveNetwork(network);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xf39c12)
          .setTitle('🔑 New Invite Token')
          .setDescription(
            `Share this token with the other server's admin:\n\`\`\`${token}\`\`\`\n⏰ Expires in **24 hours**.`
          )
        ],
        ephemeral: true
      });
    }
  }
};

async function announceToNetwork(network, excludeGuildId, client, message) {
  for (const [gId, entry] of Object.entries(network.servers)) {
    if (gId === excludeGuildId) continue;
    try {
      const guild = await client.guilds.fetch(gId);
      const channel = await guild.channels.fetch(entry.channelId);
      if (channel) await channel.send(message);
    } catch (err) {
      console.error(`Announce failed for ${gId}:`, err.message);
    }
  }
    }
