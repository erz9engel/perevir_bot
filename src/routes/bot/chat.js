const {getReplyOptions, onReplyWithComment} = require("./message-handlers");
const {safeErrorLog, getUserName} = require("./utils");
const {getText} = require("./localisation");
const mongoose = require("mongoose");
const {isReplyWithCommentRequest} = require("./validation");
const TelegramUser = mongoose.model('TelegramUser');
const Request = mongoose.model('Request');


async function processChatMessage(message, userStatus, bot) {
    const statusData = userStatus.split('_')
    const recipient = statusData[1]
    const isPaused = statusData[2]
    if (message.text && (message.text === "/close_chat" || message.text === "📵 Завершити діалог")) {
        await closeChat(message.from.id, recipient, bot)
    } else if (message.text && (message.text === "/pause_chat" || message.text === "⏯️ Призупинити діалог")) {
        await pauseChat(message.from.id, recipient, bot)
    } else if (isReplyWithCommentRequest(message)) {
        await onReplyWithComment(message, bot);
    } else {
        if (isPaused) {
            await unpauseRequest(message, recipient, bot)
        } else {
            try {
                await bot.copyMessage(recipient, message.chat.id, message.message_id)
            } catch (e) {
                safeErrorLog(e)
            }
        }
    }
}

async function pauseChat(moderator, recipient, bot) {
    await TelegramUser.findOneAndUpdate({telegramID: recipient}, {status: 'chat_' + moderator + '_paused'});
    await TelegramUser.findOneAndUpdate({telegramID: moderator}, {status: ''});
    const replyOptions = await getReplyOptions('ua');
    try {
        await bot.sendMessage(
            moderator,
            'Діалог з ініціатором запиту призупинено. ' +
            'Його буде відновлено, коли ініціатор відповість на попередні повідомлення',
            replyOptions,
        )
    } catch (e) { safeErrorLog(e) }
}

async function unpauseRequest(message, recipient, bot) {
    let inline_keyboard = [[
        { text: '📱️ Відновити діалог', callback_data: 'UNPAUSE_' + message.from.id + '_' + message.message_id},
    ]];
    try {
        await bot.sendMessage(
            recipient,
            'Користувач ' + getUserName(message.from) + ' прислав вам повідомлення в призупиненому діалозі.\nВідновити цей діалог?',
            {reply_markup: JSON.stringify({inline_keyboard})},
        )
    } catch (e) { safeErrorLog(e) }
}

async function unpauseCallback(callbackQuery, bot) {
    const data = callbackQuery.data.split('_');
    const message = callbackQuery.message
    const recipient = data[1];
    const moderator = callbackQuery.from.id;
    const messageId = data[2];
    await TelegramUser.findOneAndUpdate({telegramID: recipient}, {status: 'chat_' + moderator});
    await TelegramUser.findOneAndUpdate({telegramID: moderator}, {status: 'chat_' + recipient});
    try {
        await bot.editMessageReplyMarkup({}, {
            chat_id: message.chat.id,
            message_id: message.message_id
        })
        await bot.sendMessage(
            moderator,
            "Режим діалогу відновлено.",
            {
                reply_markup: {
                    resize_keyboard: true,
                    one_time_keyboard: false,
                    keyboard: [
                        [{ text: '📵 Завершити діалог'}],
                        [{ text: '⏯️ Призупинити діалог'}]
                    ]
                }
            }
        )
        await bot.copyMessage(moderator, recipient, messageId)
    } catch (e){ safeErrorLog(e) }
}

async function closeChat(user, recipient, bot) {
    await TelegramUser.findOneAndUpdate({telegramID: user}, {status: ''});
    const {language} = await TelegramUser.findOneAndUpdate({telegramID: recipient}, {status: ''});
    const replyOptions = await getReplyOptions('ua');
    try {
        await bot.sendMessage(user, 'Діалог з ініціатором запиту завершено', replyOptions)
    } catch (e) { safeErrorLog(e) }

    try {
        await getText('close_chat', language, async function(err, text){
            if (err) return safeErrorLog(err);
            await bot.sendMessage(recipient, text)
        });
    } catch (e) { safeErrorLog(e) }
}

async function onChatModeQuery(callbackQuery, bot) {
    const {data, message} = callbackQuery;
    const requestId = data.split('_')[1];
    const request = await Request.findById(requestId);
    if (!request) return
    const moderatorId = callbackQuery.from.id;
    const requesterId = request.requesterTG;
    let requester = await TelegramUser.findOne({telegramID: requesterId});
    let moderator = await TelegramUser.findOne({telegramID: moderatorId});
    if(!moderator || !requester) {
        let text = 'Щось пішло не так...';
        try {
            return await bot.answerCallbackQuery(
                callbackQuery.id,
                {text: text, show_alert: true}
            );
        } catch (e) { return safeErrorLog(e) }
    }
    if (requester.status && requester.status.startsWith('chat_')) {
        let text = 'Чат вже зайнятий іншим модератором';
        if (requester.status.split('_')[1] === moderatorId.toString()) {
            text = 'Ви вже відкрили чат з цим користувачем. Для його закриття напишіть боту /close_chat'
        }
        try {
            await bot.answerCallbackQuery(
                callbackQuery.id,
                {text: text, show_alert: true}
            );
        } catch (e) { safeErrorLog(e) }
    } else if (moderator.status && moderator.status.startsWith('chat_')) {
        let text = 'Ви вже відкрили чат з іншим користувачем. Для його закриття напишіть боту /close_chat';
        try {
            await bot.answerCallbackQuery(
                callbackQuery.id,
                {text: text, show_alert: true}
            );
        } catch (e) { safeErrorLog(e) }
    } else {
        let text = 'Діалог ініціалізовано, для спілкування перейдіть у бот @perevir_bot';
        try {
            await bot.answerCallbackQuery(
                callbackQuery.id,
                {text: text, show_alert: true}
            );
        } catch (e) { safeErrorLog(e) }
        moderator.status = 'chat_' + requesterId;
        requester.status = 'chat_' + moderatorId;
        await moderator.save()
        await requester.save()
        try {
            await bot.forwardMessage(moderatorId, message.chat.id, request.moderatorMsgID);
        } catch (e) { safeErrorLog(e) }
        let moderatorText = 'За цим запитом розпочато діалог з ініціатором запиту.\n'
            + 'Надалі текст всіх повідомлень, надісланих сюди, буде направлений користувачу від імені бота\n'
            + 'Для того, щоб вийти з режиму діалогу напишіть /close_chat або\n'
            + '/pause_chat або скористайтеся кнопками внизу'
        try {
            await bot.sendMessage(
                moderatorId,
                moderatorText,
                {
                    reply_markup: {
                        resize_keyboard: true,
                        one_time_keyboard: false,
                        keyboard: [
                            [{ text: '📵 Завершити діалог'}],
                            [{ text: '⏯️ Призупинити діалог'}]
                        ]
                    }
                }
            )
        } catch (e) { safeErrorLog(e) }

        try {
            await getText('open_chat', requester.language, async function(err, text){
                if (err) return safeErrorLog(err);
                try {
                    await bot.sendMessage(requesterId, text);
                } catch (e) { safeErrorLog(e) }
            });
        } catch (e) { safeErrorLog(e) }

    }
}

module.exports = {
    processChatMessage,
    onChatModeQuery,
    unpauseCallback,
}
