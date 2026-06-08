// networks.json structure:
// {
//   "NETWORK_ID": {
//     "id": "NETWORK_ID",
//     "createdBy": "guildId",
//     "servers": {
//       "guildId": { "guildId": "...", "channelId": "...", "guildName": "..." }
//     },
//     "privateChats": [{ "a": "guildId", "b": "guildId" }],
//     "pendingInvites": { "token": { "fromGuild": "...", "expires": timestamp } }
//   }
// }

const fs = require('fs');
const DATA_FILE = './data/networks.json';

function load() {
  if (!fs.existsSync('./data')) fs.mkdirSync('./data');
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getAll() {
  return load();
}

function getNetwork(networkId) {
  const data = load();
  return data[networkId] || null;
}

function getNetworkByGuild(guildId) {
  const data = load();
  for (const net of Object.values(data)) {
    if (net.servers[guildId]) return net;
  }
  return null;
}

function saveNetwork(network) {
  const data = load();
  data[network.id] = network;
  save(data);
}

function deleteNetwork(networkId) {
  const data = load();
  delete data[networkId];
  save(data);
}

function removeGuildFromNetwork(guildId) {
  const data = load();
  for (const net of Object.values(data)) {
    if (net.servers[guildId]) {
      delete net.servers[guildId];
      // Clean up private chats involving this guild
      net.privateChats = (net.privateChats || []).filter(
        p => p.a !== guildId && p.b !== guildId
      );
      // If no servers left, delete network
      if (Object.keys(net.servers).length === 0) {
        delete data[net.id];
      } else {
        data[net.id] = net;
      }
      save(data);
      return net;
    }
  }
  return null;
}

function generateId(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

module.exports = {
  getAll,
  getNetwork,
  getNetworkByGuild,
  saveNetwork,
  deleteNetwork,
  removeGuildFromNetwork,
  generateId
};
