const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

const allowedNumbers = [
    "94740069359@s.whatsapp.net", 
    "94769704687@s.whatsapp.net",
    "94721145008@s.whatsapp.net"
];

const genAI = new GoogleGenerativeAI("AQ.Ab8RN6Kd6BIL9Gkp6X2j4WOzH92HPwT0nI5idSxMSyo61WtZTQ"); 
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "ඔබ 'Hasal's AI Assistant' වේ. හසල් වෙනුවෙන් මිත්‍රශීලීව සිංහලෙන් හෝ ඉංග්‍රීසියෙන් කෙටියෙන් පිළිතුරු දෙන්න."
});

const chatHistories = new Map();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) {
            console.log('\n--- ස්කෑන් කිරීම සඳහා QR කේතය පහත දැක්වේ ---\n');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') console.log('Bot සාර්ථකව WhatsApp සමඟ සම්බන්ධ විය!');
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages.object ? messages[0] : messages[0];
        const senderJid = msg.key.remoteJid;
        if (!msg.message || msg.key.fromMe || senderJid.includes('@g.us') || !allowedNumbers.includes(senderJid)) return; 
        const senderText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!senderText) return;
        try {
            let history = chatHistories.get(senderJid) || [];
            history.push({ role: "user", parts: [{ text: senderText }] });
            const chat = model.startChat({ history: history.slice(-6) });
            const result = await chat.sendMessage(senderText);
            const reply = result.response.text();
            history.push({ role: "model", parts: [{ text: reply }] });
            chatHistories.set(senderJid, history);
            await sock.sendMessage(senderJid, { text: reply });
        } qrcode_err => { console.error('Error:', qrcode_err); }
    });
}
startBot();
