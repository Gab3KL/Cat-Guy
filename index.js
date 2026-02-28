const { Client, GatewayIntentBits } = require('discord.js');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const play = require('play-dl');

require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- COLOQUE SUAS CHAVES AQUI (IGUAL ANTES) ---
const SPOTIFY_ID = process.env.SPOTIFY_ID;
const SPOTIFY_SECRET = process.env.SPOTIFY_SECRET;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
// ----------------------------------------------

play.setToken({
    spotify: {
        client_id: SPOTIFY_ID,
        client_secret: SPOTIFY_SECRET,
        market: 'BR'
    },
    youtube: {
        // O 'fs.readFileSync' vai ler o conteúdo do arquivo txt para o bot usar
        cookie: fs.readFileSync('./www.youtube.com_cookies.txt', 'utf8') 
    }
});

const player = new Player(client);
player.extractors.loadMulti(DefaultExtractors);

client.on('ready', () => {
    console.log(`✅ Cat-Guy Online! Logado como ${client.user.tag}`);
    console.log(`🚀 Pronto para enviar métricas ao Stoat.`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0].toLowerCase();
    const query = args.slice(1).join(' ');

    // COMANDO !PLAY
  if (command === '!play') {
        const query = args.slice(1).join(' '); // Corrigido para pegar o nome certo
        if (!query) return message.reply("Me diga o nome da música!");

        try {
            const { track } = await player.play(message.member.voice.channel, query, {
                nodeOptions: { 
                    metadata: message,
                    leaveOnEmpty: true,
                    leaveOnEnd: false
                }
            });

            // --- LOG DO STOAT ---
            const fs = require('fs');
            if (!fs.existsSync('./status-report')) fs.mkdirSync('./status-report');
            const logEntry = `[${new Date().toLocaleTimeString()}] Adicionado: ${track.title}\n`;
            fs.appendFileSync('./status-report/log.txt', logEntry);
            
            console.log("✅ Comando registrado para o Stoat!");

            return message.reply(`🎧 **${track.title}** foi adicionada à fila!`);
        } catch (e) {
            console.error(e);
            return message.reply("Não consegui tocar essa música.");
        }
    }

    // COMANDO !STOP (O QUE ESTAVA FALTANDO)
    if (command === '!stop') {
        const queue = player.nodes.get(message.guild.id);
        if (!queue) return message.reply("Não tem nada tocando!");
        
        queue.delete();
        return message.reply("🛑 Música parada. Sessão de foco encerrada no **Stoat**!");
    }

// Comando para buscar músicas parecidas
    if (command === '!similar') {
        const queue = player.nodes.get(message.guild.id);
        
        if (!queue || !queue.currentTrack) {
            return message.reply("Precisa estar tocando algo para eu buscar parecidas!");
        }

        // Limpa o nome da música para a busca ser melhor
        const cleanName = queue.currentTrack.title
            .replace(/\((.*?)\)/g, '') // Remove parênteses
            .replace(/\[(.*?)\]/g, '') // Remove colchetes
            .split('-')[0]             // Pega só o nome principal antes do traço
            .trim();

        message.reply(`🔍 Buscando algo parecido com **${cleanName}**...`);

        try {
            // Busca usando o nome "limpo"
            const results = await player.search(cleanName, {
                searchEngine: "youtubeSearch"
            });

            // Se encontrar, pula a música atual que ele mesmo achou e pega a próxima da lista
            if (!results.tracks.length || results.tracks.length < 2) {
                return message.reply("Não encontrei uma música diferente o suficiente agora. Tente em outra faixa!");
            }

            const nextTrack = results.tracks[1];
            await player.play(message.member.voice.channel, nextTrack.url);
            
            return message.reply(`✨ Similar encontrada: **${nextTrack.title}**`);
        } catch (e) {
            console.error(e);
            return message.reply("Erro ao buscar recomendações. O YouTube pode estar bloqueando a busca automática.");
        }
    }

    // COMANDO !SKIP
    if (command === '!skip') {
        const queue = player.nodes.get(message.guild.id);
        if (!queue || !queue.isPlaying()) return message.reply("Nada para pular!");
        queue.node.skip();
        return message.reply("⏭️ Pulada!");
    }

}); // <--- FECHA O client.on('messageCreate')

// --- CONFIGURAÇÃO DO STOAT E TRATAMENTO DE ERROS ---

// 1. Registro Automático no Stoat
player.events.on('playerStart', (queue, track) => {
    console.log(`🎵 Começou a tocar: ${track.title}`);
    
    const fs = require('fs');
    const logPath = './status-report';
    const logFile = `${logPath}/log.txt`;
    const data = `[${new Date().toLocaleTimeString()}] Tocando agora: ${track.title}\n`;

    if (!fs.existsSync(logPath)) fs.mkdirSync(logPath, { recursive: true });
    fs.appendFileSync(logFile, data);
    console.log("📝 Log enviado para a pasta do Stoat!");
});

// 2. Mata o erro "UnhandledEventsWarning" do seu terminal
player.events.on('error', (queue, error) => {
    console.log(`❌ Erro no player: ${error.message}`);
});

player.events.on('playerError', (queue, error) => {
    console.log(`❌ Erro na conexão: ${error.message}`);
});

client.login(DISCORD_TOKEN);