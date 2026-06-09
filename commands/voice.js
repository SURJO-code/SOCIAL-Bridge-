const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioReceiveStream,
  EndBehaviorType,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} = require('@discordjs/voice');
const store = require('../utils/store');

// Active voice bridges per network
if (!global.voiceBridges) global.voiceBridges = {};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('Voice bridge between servers')
    .addSubcommand(sub =>
      sub.setName('join').setDescription('Join the voice bridge'))
    .addSubcommand(sub =>
      sub.setName('leave').setDescription('Leave the voice bridge')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const member = interaction.member;

    const network = store.getNetworkByGuild(guildId);
    if (!network) {
      return interaction.reply({ content: '❌ Your server is not in any network.', ephemeral: true });
    }

    if (sub === 'join') {
      // Check if member is in a voice channel
      const voiceChannel = member.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({ content: '❌ You need to be in a voice channel first!', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        // Join this server's voice channel
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: false,
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 10_000);

        // Store the connection
        if (!global.voiceBridges[network.id]) global.voiceBridges[network.id] = {};
        global.voiceBridges[network.id][guildId] = {
          connection,
          voiceChannelId: voiceChannel.id,
          guildId,
        };

        // Connect to other servers' voice channels
        const otherServers = Object.values(network.servers).filter(s => s.guildId !== guildId);
        let connectedCount = 0;

        for (const serverEntry of otherServers) {
          if (global.voiceBridges[network.id][serverEntry.guildId]) {
            // Already connected — set up bridge between them
            await setupAudioBridge(network.id, guildId, serverEntry.guildId, client);
            connectedCount++;
          }
        }

        // Announce in bridge channel
        try {
          const guild = await client.guilds.fetch(guildId);
          const bridgeChannel = await guild.channels.fetch(network.servers[guildId].channelId);
          if (bridgeChannel) {
            await bridgeChannel.send(`🎙️ **${member.user.username}** started a voice bridge in **${voiceChannel.name}**!`);
          }
        } catch {}

        // Announce to other servers
        for (const serverEntry of otherServers) {
          try {
            const otherGuild = await client.guilds.fetch(serverEntry.guildId);
            const otherChannel = await otherGuild.channels.fetch(serverEntry.channelId);
            if (otherChannel) {
              await otherChannel.send(
                `🎙️ **${interaction.guild.name}** joined the voice bridge! Use \`/voice join\` in a voice channel to connect!`
              );
            }
          } catch {}
        }

        await interaction.editReply({
          content: connectedCount > 0
            ? `✅ Voice bridge active! Connected to ${connectedCount} other server(s). ⚠️ May have slight delay.`
            : `✅ Joined voice bridge! Waiting for other servers to join with \`/voice join\`.`
        });

      } catch (err) {
        console.error('Voice bridge error:', err);
        await interaction.editReply({ content: `❌ Failed to join voice: ${err.message}` });
      }
    }

    if (sub === 'leave') {
      const bridge = global.voiceBridges[network.id]?.[guildId];
      if (!bridge) {
        return interaction.reply({ content: '❌ Not in a voice bridge.', ephemeral: true });
      }

      try {
        bridge.connection.destroy();
        delete global.voiceBridges[network.id][guildId];

        // Announce
        const otherServers = Object.values(network.servers).filter(s => s.guildId !== guildId);
        for (const serverEntry of otherServers) {
          try {
            const otherGuild = await client.guilds.fetch(serverEntry.guildId);
            const otherChannel = await otherGuild.channels.fetch(serverEntry.channelId);
            if (otherChannel) {
              await otherChannel.send(`🔇 **${interaction.guild.name}** left the voice bridge.`);
            }
          } catch {}
        }

        await interaction.reply({ content: '✅ Left the voice bridge.', ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
      }
    }
  }
};

async function setupAudioBridge(networkId, guildIdA, guildIdB, client) {
  const bridgeA = global.voiceBridges[networkId][guildIdA];
  const bridgeB = global.voiceBridges[networkId][guildIdB];
  if (!bridgeA || !bridgeB) return;

  const { PassThrough } = require('stream');

  // Bridge A → B
  const receiverA = bridgeA.connection.receiver;
  const playerB = createAudioPlayer();
  bridgeB.connection.subscribe(playerB);

  receiverA.speaking.on('start', (userId) => {
    const audioStream = receiverA.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 100 }
    });
    const passthrough = new PassThrough();
    audioStream.pipe(passthrough);
    const resource = createAudioResource(passthrough);
    playerB.play(resource);
  });

  // Bridge B → A
  const receiverB = bridgeB.connection.receiver;
  const playerA = createAudioPlayer();
  bridgeA.connection.subscribe(playerA);

  receiverB.speaking.on('start', (userId) => {
    const audioStream = receiverB.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 100 }
    });
    const passthrough = new PassThrough();
    audioStream.pipe(passthrough);
    const resource = createAudioResource(passthrough);
    playerA.play(resource);
  });
}
