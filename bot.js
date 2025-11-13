require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const WHITELIST_FILE = path.join(__dirname, 'config', 'whitelist.json');

function loadWhitelist() {
  try {
    if (fs.existsSync(WHITELIST_FILE)) {
      const data = fs.readFileSync(WHITELIST_FILE, 'utf8');
      return JSON.parse(data);
    }
    return { ips: ['127.0.0.1'] };
  } catch (error) {
    console.error('Error loading whitelist:', error);
    return { ips: ['127.0.0.1'] };
  }
}

function saveWhitelist(data) {
  try {
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving whitelist:', error);
    return false;
  }
}

function isValidIPv4(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;
  
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

const GUILD_ID = process.env.DISCORD_GUILD_ID || '1361514717751017664';
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || '1438293793349828708';
const LOG_CHANNEL_ID = '1438549220310388847';

client.once('ready', async () => {
  console.log(`Discord bot logged in as ${client.user.tag}`);
  
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  
  const commands = [
    new SlashCommandBuilder()
      .setName('ipekle')
      .setDescription('IP adresini whitelist\'e ekler')
      .addStringOption(option =>
        option.setName('ip')
          .setDescription('Eklenecek IP adresi')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('ipcikar')
      .setDescription('IP adresini whitelist\'ten çıkarır')
      .addStringOption(option =>
        option.setName('ip')
          .setDescription('Çıkarılacak IP adresi')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('ipler')
      .setDescription('Whitelist\'teki tüm IP adreslerini listeler')
  ];
  
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_APP_ID || '1438295937859715177', GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered successfully');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  
  if (interaction.guildId !== GUILD_ID) {
    return interaction.reply({ content: 'Bu komut sadece belirli sunucuda kullanılabilir.', ephemeral: true });
  }
  
  if (interaction.channelId !== CHANNEL_ID && interaction.commandName !== 'ipler') {
    return interaction.reply({ content: 'Bu komut sadece belirli kanalda kullanılabilir.', ephemeral: true });
  }
  
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  
  if (interaction.commandName === 'ipekle') {
    const ip = interaction.options.getString('ip');
    
    if (!isValidIPv4(ip)) {
      return interaction.reply({ content: 'Geçersiz IP formatı.', ephemeral: true });
    }
    
    const whitelist = loadWhitelist();
    
    if (whitelist.ips.includes(ip)) {
      if (logChannel) {
        logChannel.send(`\`[${new Date().toISOString()}]\` **IP_EKLEME_DENEMESI**\nIP: \`${ip}\`\nDurum: Zaten whitelist'te\nKullanıcı: ${interaction.user.tag}`).catch(console.error);
      }
      return interaction.reply({ content: `IP ${ip} zaten whitelist'te.` });
    }
    
    whitelist.ips.push(ip);
    
    if (saveWhitelist(whitelist)) {
      if (logChannel) {
        logChannel.send(`\`[${new Date().toISOString()}]\` **IP_EKLEME**\nIP: \`${ip}\`\nDurum: Başarılı\nKullanıcı: ${interaction.user.tag}`).catch(console.error);
      }
      return interaction.reply({ content: `IP ${ip} whitelist'e eklendi.` });
    } else {
      return interaction.reply({ content: 'IP eklenirken bir hata oluştu.', ephemeral: true });
    }
  }
  
  if (interaction.commandName === 'ipcikar') {
    const ip = interaction.options.getString('ip');
    
    if (!isValidIPv4(ip)) {
      return interaction.reply({ content: 'Geçersiz IP formatı.', ephemeral: true });
    }
    
    const whitelist = loadWhitelist();
    
    if (!whitelist.ips.includes(ip)) {
      if (logChannel) {
        logChannel.send(`\`[${new Date().toISOString()}]\` **IP_CIKARMA_DENEMESI**\nIP: \`${ip}\`\nDurum: Whitelist'te değil\nKullanıcı: ${interaction.user.tag}`).catch(console.error);
      }
      return interaction.reply({ content: `IP ${ip} whitelist'te bulunamadı.` });
    }
    
    whitelist.ips = whitelist.ips.filter(i => i !== ip);
    
    if (saveWhitelist(whitelist)) {
      if (logChannel) {
        logChannel.send(`\`[${new Date().toISOString()}]\` **IP_CIKARMA**\nIP: \`${ip}\`\nDurum: Başarılı\nKullanıcı: ${interaction.user.tag}`).catch(console.error);
      }
      return interaction.reply({ content: `IP ${ip} whitelist'ten çıkarıldı.` });
    } else {
      return interaction.reply({ content: 'IP çıkarılırken bir hata oluştu.', ephemeral: true });
    }
  }
  
  if (interaction.commandName === 'ipler') {
    const whitelist = loadWhitelist();
    const ipList = whitelist.ips.length > 0 
      ? whitelist.ips.map((ip, index) => `${index + 1}. ${ip}`).join('\n')
      : 'Whitelist boş.';
    
    return interaction.reply({ 
      content: `**Whitelist IP'leri:**\n\`\`\`\n${ipList}\n\`\`\``,
      ephemeral: true 
    });
  }
});

if (process.env.DISCORD_BOT_TOKEN) {
  client.login(process.env.DISCORD_BOT_TOKEN).catch(console.error);
} else {
  console.error('DISCORD_BOT_TOKEN environment variable is not set');
}

module.exports = { client };

