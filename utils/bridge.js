const { WebhookClient, EmbedBuilder } = require('discord.js');
const store = require('./store');

// Cache webhooks so we don't recreate them every message
const webhookCache = {};

async function getOrCreateWebhook(channel) {
  if (webhookCache[channel.id]) {
    try {
      return new WebhookClient({ url: webhookCache[channel.id] });
    } catch {}
  }

  const webhooks = await channel.fetchWebhooks();
  let webhook = webhooks.find(w => w.name === 'BridgeBot');
  if (!webhook) {
    webhook = await channel.createWebhook({ name: 'BridgeBot' });
  }
  webhookCache[channel.id] = webhook.url;
  return new WebhookClient({ url: webhook.url });
}

async function bridgeMessage(message, client) {
  const network = store.getNetworkByGuild(message.guild.id);
  if (!network) return;

  const senderEntry = network.servers[message.guild.id];
  if (!senderEntry) return;

  // Only bridge messages from the designated bridge channel
  if (message.channel.id !== senderEntry.channelId) return;

  // Check if this is a private chat message
  const privateChat = (network.privateChats || []).find(
    p => p.a === message.guild.id || p.b === message.guild.id
  );

  // Determine target guilds
  let targetGuildIds;
  if (privateChat) {
    // Only send to the other server in the private chat
    const otherId = privateChat.a === message.guild.id ? privateChat.b : privateChat.a;
    targetGuildIds = [otherId];
  } else {
    // Send to all servers in the network except sender
    targetGuildIds = Object.keys(network.servers).filter(id => id !== message.guild.id);
  }

  // Build attachments
  const attachments = message.attachments.map(a => a.url);

  // Build sticker content
  const stickerNames = message.stickers.map(s => `[Sticker: ${s.name}]`).join(' ');

  // Message content
  const content = [message.content, stickerNames].filter(Boolean).join(' ') || null;

  for (const targetGuildId of targetGuildIds) {
    const targetEntry = network.servers[targetGuildId];
    if (!targetEntry) continue;

    try {
      const targetGuild = await client.guilds.fetch(targetGuildId);
      const targetChannel = await targetGuild.channels.fetch(targetEntry.channelId);
      if (!targetChannel) continue;

      const webhook = await getOrCreateWebhook(targetChannel);

      // Use sender's avatar and name + server tag
      await webhook.send({
        content: content,
        username: `${message.author.username} • ${message.guild.name}`,
        avatarURL: message.author.displayAvatarURL(),
        files: attachments,
        allowedMentions: { parse: [] }
      });
    } catch (err) {
      console.error(`Failed to bridge to ${targetGuildId}:`, err.message);
    }
  }
}

module.exports = { bridgeMessage };
