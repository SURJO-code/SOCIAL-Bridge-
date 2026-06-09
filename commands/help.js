const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all Bridge Bot commands and how to use them'),

  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor(0x00b4d8)
      .setTitle('🌉 Bridge Bot — Help')
      .setDescription('Connect your server with others and play games together!')
      .addFields(
        {
          name: '🏠 Setup',
          value: [
            '`/home` — Set this channel as your bridge channel',
            '`/network create` — Create a new network, get an invite token',
            '`/network join <token>` — Join a network using a token',
            '`/network invite` — Generate a new invite token',
            '`/network list` — See all connected servers',
            '`/network leave` — Leave the network',
            '`/disconnect` — Fully disconnect your server',
          ].join('\n')
        },
        {
          name: '💬 Chat',
          value: [
            '`/private start <server>` — Private chat with one server',
            '`/private end` — Return to full network chat',
            'Messages, images, gifs, stickers sync automatically!',
          ].join('\n')
        },
        {
          name: '🎙️ Voice',
          value: [
            '`/voice join` — Join voice bridge',
            '`/voice leave` — Leave the voice bridge',
            '⚠️ Voice bridge may have slight delay',
          ].join('\n')
        },
        {
          name: '🎮 Games',
          value: [
            '`/game trivia` — Cross-server trivia',
            '`/game wordchain` — Word chain game',
            '`/game hangman` — Hangman together',
            '`/game wouldyourather` — Would You Rather',
            '`/game truthordare` — Truth or Dare',
            '`/game pollwars` — Poll battle',
            '`/game counting` — Counting game',
            '`/game emojistory` — Emoji story',
            '`/game roastbattle` — Roast battle',
            '`/game stop` — Stop current game',
          ].join('\n')
        },
        {
          name: '📖 How to Connect',
          value: [
            '1. Both servers invite this bot',
            '2. Each admin runs `/home` in their bridge channel',
            '3. Server A runs `/network create` → gets a token',
            '4. Share token with Server B admin',
            '5. Server B runs `/network join <token>`',
            '6. Done! 🎉',
          ].join('\n')
        }
      )
      .setFooter({ text: 'Bridge Bot • Connect servers together' });

    await interaction.reply({ embeds: [embed] });
  }
};
