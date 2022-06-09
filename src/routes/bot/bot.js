const mongoose = require('mongoose');
require('dotenv').config();
const {
    onStart,
    onCheckContent,
    onSubscription,
    onChangeLanguage,
    onSetFakesRequest,
    onSetSource,
    onSetFakes,
    onSendFakes,
    onRequestStatus,
    onReplyWithComment,
    onCheckGroupRequest,
    onCheckRequest,
    onUnsupportedContent,
    onCloseOldRequests,
    saveCommentToDB,
    confirmComment,
    closeChat
} = require('./message-handlers');

const {
    onFakeStatusQuery,
    onChangeStatusQuery,
    onCommentQuery,
    onSubscriptionQuery,
    onSendFakesQuery,
    onConfirmCommentQuery,
    onEscalateQuery,
    onUpdateCommentQuery,
    onChatModeQuery
} = require('./query-callbacks')

const {answerInlineQuery} = require("./inline-query")

//TELEGRAM BOT
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TGTOKEN;
const bot = new TelegramBot(token, { polling: true });
const admins = String(process.env.ADMINS).split(',');
const commentGroup = process.env.TGCOMMENTSGROUP;
const escalationGroup = process.env.TGESCALATIONGROUP;

const {
    CheckContentText,
    SubscribtionText,
    ChangeLanguage,
    SetFakesRequestText
} = require('./contstants');
const {safeErrorLog} = require("./utils");
const {
    isValidCheckRequest,
    isReplyWithCommentRequest,
    isUnsupportedContent,
    isTextFromDict,
} = require("./validation");
const {checkUserStatus} = require("./authorization");

setTimeout(function () {
    try {
        bot.sendMessage(admins[0], 'Bot reloaded');
    } catch (e) {
        safeErrorLog(e);
    }
}, 10000); //Notify about reloading

bot.on('message', async (msg) => {
    const text = msg.text;

    const userStatus = await checkUserStatus(msg.from.id);
    if (userStatus && userStatus.startsWith('chat_') && msg.chat.id === msg.from.id) {
        const recipient = userStatus.split('_')[1]
        if (msg.text && (msg.text === "/close_chat" || msg.text === "📵 Завершити діалог")) {
            await closeChat(msg.from.id, recipient, bot)
        } else {
            await bot.copyMessage(recipient, msg.chat.id, msg.message_id)
        }
    } else if (msg.chat.id.toString() === escalationGroup) {
        //ignore messages in escalation group
    } else if (msg.chat.id.toString() === commentGroup && msg.text){
        await saveCommentToDB(msg, bot)
    } else if (msg.via_bot && msg.via_bot.id.toString() === token.split(':')[0]) {
        await confirmComment(msg, bot)
    } else if (text === '/start') {
        await onStart(msg, bot);
    } else if (isTextFromDict(text, CheckContentText)) {
        await onCheckContent(msg, bot)
    } else if (isTextFromDict(text, SubscribtionText)) {
        await onSubscription(msg, bot)
    } else if (isTextFromDict(text, ChangeLanguage)) {
        await onChangeLanguage(msg, bot)
    } else if (text === '/setfakes') {
        await onSetFakesRequest(msg, bot);
    } else if (text && text.startsWith('/setblacksource')) { 
        await onSetSource(msg, bot, true);
    } else if (text && text.startsWith('/setwhitesource')) { 
        await onSetSource(msg, bot, false);
    } else if (text === '/allowrequests') {
        await onRequestStatus(msg, bot, true);
    } else if (text === '/forbidrequests') {
        await onRequestStatus(msg, bot, false);
    }  else if (msg.reply_to_message && msg.reply_to_message.text === SetFakesRequestText) {
        await onSetFakes(msg, bot);
    } else if (text === '/sendfakes') {
        await onSendFakes(msg, bot);
    } else if (text === '/closepending') {
        await onCloseOldRequests(msg, bot)
    } else if (isReplyWithCommentRequest(msg)) {
        await onReplyWithComment(msg, bot);
    } else if (isValidCheckRequest(msg)) {
        if (msg.media_group_id) await onCheckGroupRequest(msg, bot);
        else await onCheckRequest(msg, bot);
    } else if (isUnsupportedContent(msg)) {
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
    } else if (data.startsWith('REASON_')) {
        console.log("old reason message") 
    } else if (data.startsWith('CONFIRM_')) {
        await onConfirmCommentQuery(callbackQuery, bot)
    } else if (data.startsWith('ESCALATE_')) {
        await onEscalateQuery(callbackQuery, bot)
    } else if (data.startsWith('UPDATECOMMENT_')) {
        await onUpdateCommentQuery(callbackQuery, bot)
    } else if (data.startsWith('CHAT_')) {
        await onChatModeQuery(callbackQuery, bot)
    }
});

bot.on("inline_query", async function onCallbackQuery(inlineQuery) {
    const {query} = inlineQuery;
    if (query.length > 3) {
        await answerInlineQuery(inlineQuery, bot)
    }
});

bot.on("polling_error", (err) => safeErrorLog(err));

module.exports = {
    message: async function (msg, pin, options) {
        try {
            const sentMsg = await bot.sendMessage(process.env.TGMAINCHAT, msg, options);
            if (pin) await bot.pinChatMessage(process.env.TGMAINCHAT, sentMsg.message_id);
        } catch (e){ safeErrorLog(e) }
    },
    messageId: async function (id, msg, pin, options) {
        try {
            const sentMsg = await bot.sendMessage(id, msg, options);
            if (pin) await bot.pinChatMessage(id, sentMsg.message_id);
        } catch (e){ safeErrorLog(e) }
    }
};
