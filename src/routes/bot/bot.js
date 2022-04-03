const mongoose = require('mongoose');
require('dotenv').config();
const {
    onStart,
    onCheckContent,
    onSubscription,
    onSetFakesRequest,
    onSetSource,
    onSetFakes,
    onSendFakes,
    onRequestStatus,
    onReplyWithComment,
    onCheckGroupRequest,
    onCheckRequest,
    onUnsupportedContent,
    onCloseOldRequests
} = require('./message-handlers');

const {
    onFakeStatusQuery,
    onChangeStatusQuery,
    onCommentQuery,
    onSubscriptionQuery,
    onSendFakesQuery,
    onAutoResponseQuery,
    onRequestQuery
} = require('./query-callbacks')

//TELEGRAM BOT
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TGTOKEN;
const bot = new TelegramBot(token, { polling: true });

const {
    CheckContentText,
    SubscribtionText,
    SetFakesRequestText
} = require('./contstants');

bot.on('message', async (msg) => {
    const text = msg.text;

    if (text === '/start') {
        await onStart(msg, bot);
    } else if (text === CheckContentText) {
        await onCheckContent(msg, bot)
    } else if (text === SubscribtionText) {
        await onSubscription(msg, bot)
    } else if (text == '/setfakes') { 
        await onSetFakesRequest(msg, bot);
    } else if (text && text.startsWith('/setblacksource')) { 
        await onSetSource(msg, bot, true);
    } else if (text && text.startsWith('/setwhitesource')) { 
        await onSetSource(msg, bot, false);
    } else if (text === '/allowrequests') {
        await onRequestStatus(msg, bot, true);
    } else if (text === '/forbidrequests') {
        await onRequestStatus(msg, bot, false);
    }  else if (msg.reply_to_message && msg.reply_to_message.text == SetFakesRequestText) { 
        await onSetFakes(msg, bot);
    } else if (text === '/sendfakes') {
        await onSendFakes(msg, bot);
    } else if (text === '/closepending') {
        await onCloseOldRequests(msg, bot)
    }else if (msg.reply_to_message && msg.reply_to_message.text && msg.reply_to_message.text.indexOf('#comment_') != -1){
        await onReplyWithComment(msg, bot);
    } else if ((msg.photo || msg.video || (msg.text && msg.text.length > 10)) && !msg.reply_to_message) { //Check if text > 10 in order to sort out short msgs
        if (msg.media_group_id) await onCheckGroupRequest(msg, bot);
        else await onCheckRequest(msg, bot);
    } else if (msg.audio || msg.document || msg.voice || msg.location) {
        await onUnsupportedContent(msg, bot);
    }
});

bot.on('callback_query', async function onCallbackQuery(callbackQuery) {
    const {data} = callbackQuery;
    if (!data) {
        return console.error('INVALID callback query, no action provided', callbackQuery)
    }

    if (data.startsWith('FS_')) {
        await onFakeStatusQuery(callbackQuery, bot)
    } else if (data.startsWith('CS_')) {
        await onChangeStatusQuery(callbackQuery, bot)
    } else if (data.startsWith('COMMENT_')) {
        await onCommentQuery(callbackQuery, bot)
    } else if (data.startsWith('SUB_')) {
        await onSubscriptionQuery(callbackQuery, bot)
    } else if (data.startsWith('SENDFAKES_')) {
        await onSendFakesQuery(callbackQuery, bot)
    } else if (data.startsWith('AR')) {
        await onAutoResponseQuery(callbackQuery, bot)
    } else if (data.startsWith('REASON_')) {
        await onRequestQuery(callbackQuery, bot)
    }
});

bot.on("polling_error", (err) => console.log(err.message));

module.exports = {
    message: async function (msg, pin, options) {
        try {
            const sentMsg = await bot.sendMessage(process.env.TGMAINCHAT, msg, options);
            if (pin) await bot.pinChatMessage(process.env.TGMAINCHAT, sentMsg.message_id);
        } catch (e){ console.log(e) }
    }
};
