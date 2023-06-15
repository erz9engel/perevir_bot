require('dotenv').config();
//TELEGRAM BOT
const TelegramBot = require('node-telegram-bot-api');
const { safeErrorLog } = require('../bot/utils');
const token = process.env.TGTOKENPARSEBOT;
const bot = new TelegramBot(token, { polling: true });
const admins = String(process.env.ADMINS).split(',');
const notifyGroup = process.env.TGPARSEGROUP;

//Notify about reloading
try {
    bot.sendMessage(admins[0], 'Bot reloaded');
} catch (e) {
    safeErrorLog(e);
}

bot.on('channel_post', async (msg) => {
    console.log(msg);
});

bot.on('message', async (msg) => {
    const text = msg.text;
    const user = msg.from.id
    
    console.log(msg);
});

bot.on('callback_query', async function onCallbackQuery(callbackQuery) {
    const {data, message} = callbackQuery;
    if (!data) {
        return console.error('INVALID callback query, no action provided', callbackQuery)
    }
    
});

bot.on("polling_error", (err) => safeErrorLog(err));