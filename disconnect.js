const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const store = require('../utils/store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Fully disconnect your server from the network')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    const guildId = interaction.guild.id;
    const network = store.getNetworkByGuild(guildId);

    if (!network) {
      return interaction.reply({ content: '❌ Your server is not connected to any network.', ephemeral: true });
    }

    // Announce to others
    for (const [gId, entry] of Object.entries(network.servers)) {
      if (gId === guildId) continue;
      try {
        const guild = await client.guilds.fetch(gId);
        const channel = await guild.channels.fetch(entry.channelId);
        if (channel) {
          await channel.send(`🔴 **${interaction.guild.name}** has disconnected from the network.`);
        }
      } catch (err) {
        console.error(err.message);
      }
    }

    store.removeGuildFromNetwork(guildId);

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🔌 Disconnected')
        .setDescription('Your server has been fully disconnected from the network.')
      ],
      ephemeral: true
    });
  }
};
