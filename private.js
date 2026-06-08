const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const store = require('../utils/store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('private')
    .setDescription('Start or end a private chat with one server in your network')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start a private chat with a specific server')
        .addStringOption(opt =>
          opt.setName('server_name')
            .setDescription('Name of the server to private chat with')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('end').setDescription('End the current private chat')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const network = store.getNetworkByGuild(guildId);

    if (!network) {
      return interaction.reply({ content: '❌ Your server is not in any network.', ephemeral: true });
    }

    if (sub === 'start') {
      const serverName = interaction.options.getString('server_name').toLowerCase();

      // Find matching server
      const target = Object.values(network.servers).find(
        s => s.guildId !== guildId && s.guildName.toLowerCase().includes(serverName)
      );

      if (!target) {
        const list = Object.values(network.servers)
          .filter(s => s.guildId !== guildId)
          .map(s => `• ${s.guildName}`).join('\n');
        return interaction.reply({
          content: `❌ No server found matching "${serverName}".\n\nAvailable servers:\n${list}`,
          ephemeral: true
        });
      }

      // Check if private chat already exists
      const existing = (network.privateChats || []).find(
        p => (p.a === guildId && p.b === target.guildId) ||
             (p.a === target.guildId && p.b === guildId)
      );

      if (existing) {
        return interaction.reply({
          content: `❌ Already in a private chat with **${target.guildName}**.`,
          ephemeral: true
        });
      }

      network.privateChats = network.privateChats || [];
      network.privateChats.push({ a: guildId, b: target.guildId });
      store.saveNetwork(network);

      // Notify both servers
      try {
        const targetGuild = await client.guilds.fetch(target.guildId);
        const targetChannel = await targetGuild.channels.fetch(target.channelId);
        if (targetChannel) {
          await targetChannel.send(
            `🔒 **${interaction.guild.name}** has started a private chat with you. ` +
            `Messages here are only visible between your two servers.`
          );
        }
      } catch (err) {
        console.error(err.message);
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle('🔒 Private Chat Started')
          .setDescription(
            `Now in a private chat with **${target.guildName}**.\n` +
            `Other servers in the network won't see your messages.\n\n` +
            `Use \`/private end\` to return to the full network.`
          )
        ],
        ephemeral: true
      });
    }

    if (sub === 'end') {
      const chatIndex = (network.privateChats || []).findIndex(
        p => p.a === guildId || p.b === guildId
      );

      if (chatIndex === -1) {
        return interaction.reply({ content: '❌ You are not in a private chat.', ephemeral: true });
      }

      const chat = network.privateChats[chatIndex];
      const otherId = chat.a === guildId ? chat.b : chat.a;
      const otherEntry = network.servers[otherId];

      network.privateChats.splice(chatIndex, 1);
      store.saveNetwork(network);

      // Notify other server
      try {
        const otherGuild = await client.guilds.fetch(otherId);
        const otherChannel = await otherGuild.channels.fetch(otherEntry.channelId);
        if (otherChannel) {
          await otherChannel.send(`🔓 Private chat ended. Back to the full network.`);
        }
      } catch (err) {
        console.error(err.message);
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🔓 Private Chat Ended')
          .setDescription('You are now back in the full network chat.')
        ],
        ephemeral: true
      });
    }
  }
};
