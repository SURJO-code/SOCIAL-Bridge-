const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const store = require('../utils/store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('home')
    .setDescription('Set this channel as the bridge channel for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    const guildId = interaction.guild.id;
    const channelId = interaction.channel.id;
    const guildName = interaction.guild.name;

    // Check if already in a network
    const existing = store.getNetworkByGuild(guildId);
    if (existing) {
      // Update channel
      existing.servers[guildId].channelId = channelId;
      store.saveNetwork(existing);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x00b4d8)
          .setTitle('🏠 Bridge Channel Updated')
          .setDescription(`This channel is now your bridge channel.\nNetwork ID: \`${existing.id}\``)
        ],
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00b4d8)
      .setTitle('🏠 Bridge Channel Set!')
      .setDescription(
        `**${interaction.channel.name}** is now your bridge channel.\n\n` +
        `**Next steps:**\n` +
        `• Create a new network: \`/network create\`\n` +
        `• Join an existing network: \`/network join <ID>\`\n\n` +
        `⚠️ This channel will sync all messages to connected servers.`
      )
      .setFooter({ text: `Server: ${guildName}` });

    // Store temporarily — will be finalized when joining/creating a network
    // We store it in a pending map
    if (!global.pendingHomes) global.pendingHomes = {};
    global.pendingHomes[guildId] = { channelId, guildName };

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
