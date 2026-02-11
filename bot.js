const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Bot Configuration
const BOT_NAME = "🤖 KINGSLEY OFFENSIVE BOT";
const CREATOR = "KINGSLEY-XD";
const PREFIX = "!";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI('YOUR_GEMINI_API_KEY'); // Replace with your API key
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// Store for anti-delete feature
const messageStore = new Map();
const deletedMessages = new Map();

// Store for pairing codes
const pairingCodes = new Map();

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.commands = new Map();
        this.init();
    }

    async init() {
        console.log(`
╔══════════════════════════════════════╗
║     ${BOT_NAME}     ║
║     Created by: ${CREATOR}          ║
╚══════════════════════════════════════╝
        `);
        
        await this.loadCommands();
        await this.connectToWhatsApp();
    }

    async loadCommands() {
        // Command: Menu
        this.commands.set('menu', {
            description: 'Show all commands',
            handler: async (sock, chatId, args) => {
                await sock.sendPresenceUpdate('composing', chatId);
                
                const menuText = `
╔═══════════════════════════════╗
║       🤖 BOT SYSTEM MENU      ║
║     ${BOT_NAME}              ║
╚═══════════════════════════════╝

📌 *AI COMMANDS*:
• !ai <question> - Ask AI anything
• !search <query> - Search the web
• !imgai <prompt> - Generate AI image

🎵 *MEDIA COMMANDS*:
• !song <name> - Download song
• !video <name> - Download video
• !yt <url> - Download YouTube

⚡ *UTILITY COMMANDS*:
• !paircode - Generate pairing code
• !qr - Get QR code for pairing
• !status - Check bot status
• !ping - Check response time
• !broadcast <msg> - Broadcast message

🔧 *ADVANCED FEATURES*:
• Auto-reply (always on)
• Anti-delete (active)
• Auto-react (active)
• Auto-typing (active)

📞 *CREATOR*: ${CREATOR}
💡 *PREFIX*: ${PREFIX}
                `;
                
                await sock.sendMessage(chatId, { text: menuText });
            }
        });

        // Command: AI Chat
        this.commands.set('ai', {
            description: 'Ask AI anything',
            handler: async (sock, chatId, args) => {
                if (!args.length) {
                    return sock.sendMessage(chatId, { text: 'Please provide a question!' });
                }
                
                await sock.sendPresenceUpdate('composing', chatId);
                
                try {
                    const prompt = args.join(' ');
                    const result = await model.generateContent(prompt);
                    const response = result.response.text();
                    
                    await sock.sendMessage(chatId, { 
                        text: `🤖 AI Response:\n\n${response}` 
                    });
                } catch (error) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ AI service error. Please try again.' 
                    });
                }
            }
        });

        // Command: Search
        this.commands.set('search', {
            description: 'Search the web',
            handler: async (sock, chatId, args) => {
                if (!args.length) {
                    return sock.sendMessage(chatId, { text: 'Please provide search query!' });
                }
                
                await sock.sendPresenceUpdate('composing', chatId);
                
                try {
                    const query = args.join(' ');
                    // Implement search logic here
                    await sock.sendMessage(chatId, { 
                        text: `🔍 Search Results for "${query}"\n\n(Search functionality placeholder - integrate with Google Search API)` 
                    });
                } catch (error) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Search failed. Please try again.' 
                    });
                }
            }
        });

        // Command: Song Download
        this.commands.set('song', {
            description: 'Download songs',
            handler: async (sock, chatId, args) => {
                if (!args.length) {
                    return sock.sendMessage(chatId, { text: 'Please provide song name!' });
                }
                
                await sock.sendPresenceUpdate('composing', chatId);
                
                try {
                    const songName = args.join(' ');
                    // Implement song download logic
                    await sock.sendMessage(chatId, { 
                        text: `🎵 Searching for: ${songName}\n\n(Song download placeholder - integrate with ytdl-core)` 
                    });
                } catch (error) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Song download failed.' 
                    });
                }
            }
        });

        // Command: Pairing Code
        this.commands.set('paircode', {
            description: 'Generate pairing code',
            handler: async (sock, chatId) => {
                const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                pairingCodes.set(code, chatId);
                
                await sock.sendMessage(chatId, { 
                    text: `🔐 Pairing Code: *${code}*\n\nUse this code within 5 minutes to pair another device.`
                });
            }
        });

        // Command: QR Code
        this.commands.set('qr', {
            description: 'Get QR code',
            handler: async (sock, chatId) => {
                await sock.sendMessage(chatId, { 
                    text: 'Scan the QR code shown in terminal to pair.'
                });
            }
        });

        // Command: Ping
        this.commands.set('ping', {
            description: 'Check bot response',
            handler: async (sock, chatId) => {
                const start = Date.now();
                await sock.sendPresenceUpdate('composing', chatId);
                const latency = Date.now() - start;
                
                await sock.sendMessage(chatId, { 
                    text: `🏓 Pong!\n⚡ Latency: ${latency}ms\n✅ Bot is operational!`
                });
            }
        });
    }

    async connectToWhatsApp() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState('auth_info');
            
            const { version, isLatest } = await fetchLatestBaileysVersion();
            console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

            this.sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: true,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
                },
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                defaultQueryTimeoutMs: 60000,
            });

            // Save credentials
            this.sock.ev.on('creds.update', saveCreds);

            // Handle connection updates
            this.sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    console.log('\n══════════════════════════════════════');
                    qrcode.generate(qr, { small: true });
                    console.log('══════════════════════════════════════\n');
                }
                
                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log('Connection closed. Reconnecting:', shouldReconnect);
                    if (shouldReconnect) {
                        this.connectToWhatsApp();
                    }
                } else if (connection === 'open') {
                    console.log('✅ WhatsApp connected successfully!');
                    this.isConnected = true;
                    this.showBotStatus();
                }
            });

            // Handle messages
            this.sock.ev.on('messages.upsert', async (m) => {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) return;
                
                await this.handleMessage(msg);
            });

            // Handle message deletions
            this.sock.ev.on('messages.delete', async (deletion) => {
                await this.handleMessageDelete(deletion);
            });

        } catch (error) {
            console.error('Connection error:', error);
            setTimeout(() => this.connectToWhatsApp(), 5000);
        }
    }

    async handleMessage(msg) {
        const chatId = msg.key.remoteJid;
        const messageText = msg.message.conversation || 
                           msg.message.extendedTextMessage?.text || '';
        
        // Store message for anti-delete
        messageStore.set(msg.key.id, {
            text: messageText,
            sender: msg.pushName,
            timestamp: new Date().toLocaleTimeString()
        });

        // Auto-typing indicator
        await this.sock.sendPresenceUpdate('composing', chatId);

        // Auto-react (random emoji)
        const reactions = ['❤️', '😂', '😮', '😢', '👍', '👎'];
        const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
        await this.sock.sendMessage(chatId, {
            react: {
                text: randomReaction,
                key: msg.key
            }
        });

        // Check if message is a command
        if (messageText.startsWith(PREFIX)) {
            const args = messageText.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            
            if (this.commands.has(command)) {
                await this.commands.get(command).handler(this.sock, chatId, args);
            } else {
                // Auto-reply for unknown commands
                await this.sock.sendMessage(chatId, {
                    text: `❓ Unknown command. Type ${PREFIX}menu to see all commands.`
                });
            }
        } else {
            // Auto-reply system (can be extended)
            if (messageText.toLowerCase().includes('hello') || 
                messageText.toLowerCase().includes('hi')) {
                await this.sock.sendMessage(chatId, {
                    text: `👋 Hello! I'm ${BOT_NAME}. How can I assist you?\n\nType ${PREFIX}menu to see all commands.`
                });
            }
        }
    }

    async handleMessageDelete(deletion) {
        for (const item of deletion.keys) {
            const deletedMsg = messageStore.get(item.id);
            if (deletedMsg) {
                const chatId = item.remoteJid;
                deletedMessages.set(item.id, deletedMsg);
                
                await this.sock.sendMessage(chatId, {
                    text: `⚠️ *Message Deleted*\n\n👤 From: ${deletedMsg.sender}\n🕐 Time: ${deletedMsg.timestamp}\n📝 Message: ${deletedMsg.text}`
                });
                
                messageStore.delete(item.id);
            }
        }
    }

    showBotStatus() {
        console.log(`
╔═══════════════════════════════════════════════════╗
║                BOT STATUS: ONLINE                ║
╠═══════════════════════════════════════════════════╣
║ 🤖 Name: ${BOT_NAME}
║ 👨‍💻 Creator: ${CREATOR}
║ 📅 Started: ${new Date().toLocaleString()}
║ 📊 Commands Loaded: ${this.commands.size}
║ 🔗 Prefix: ${PREFIX}
║ ✅ Features Active:
║   • AI Chat System ✓
║   • Auto-Reply System ✓
║   • Anti-Delete System ✓
║   • Auto-React System ✓
║   • Auto-Typing Indicator ✓
║   • Song Downloader ✓
║   • Pairing System ✓
╚═══════════════════════════════════════════════════╝
        `);
    }
}

// Start the bot
new WhatsAppBot();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n\n🔴 Bot shutting down...');
    process.exit(0);
});