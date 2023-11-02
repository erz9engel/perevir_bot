const {
    getSubscriptionBtn,
    notifyUsers,
    sendFakes,
    getUserName,
    involveModerator,
    changeInlineKeyboard,
    safeErrorLog,
    getLanguage,
    shiftOffsetEntities,
    getFakeText,
    closeRequestByTimeout,
} = require("./utils");

const {statusesKeyboard} = require("../keyboard");

const {
    NoCurrentFakes
} = require('./contstants')
const {informRequestersWithComment} = require("./message-handlers");
const { getText, getLanguageTGChat} = require('./localisation');
const mongoose = require("mongoose");
const {blockRequestInitiator} = require("./authorization");
require('dotenv').config();

const Request = mongoose.model('Request');
const TelegramUser = mongoose.model('TelegramUser');
const Data = mongoose.model('Data');
const Escalation = mongoose.model('Escalation');
const Comment = mongoose.model('Comment');
const {takeRequestKeyboard} = require("../keyboard");
const { sendTextMessage } = require("../whatsapp/functions");
const { sendTextMessageMessenger } = require("../messenger/functions");
const { automatedCheckGPT } = require("../chatGPT/gpt");
const admins = String(process.env.ADMINS).split(',');

const onReqTakeQuery = async (callbackQuery, bot) => {

    const {data, message} = callbackQuery;
    let requestId = data.split('_')[1];
    const inline_keyboard = await statusesKeyboard(requestId);

    try {
        await bot.editMessageReplyMarkup({
            inline_keyboard: inline_keyboard
        }, {
            chat_id: message.chat.id,
            message_id: message.message_id
        });
    } catch (e) {
        safeErrorLog(e);
    }

    const xx = await Request.findByIdAndUpdate(requestId, {takenModerator: callbackQuery.from.id, lastUpdate: new Date()});

}

const onFakeStatusQuery = async (callbackQuery, bot, silentMode) => {
    const {data, message} = callbackQuery;
    let requestId = data.split('_')[2], fakeStatus = data.split('_')[1];
    let messageChat = message.chat.id;
    let inline_keyboard = message.reply_markup.inline_keyboard
    let actionMsgText = message.text.split("\n#pending")[0]
    const moderator = getUserName(callbackQuery.from);
    let status = getFakeText(fakeStatus), sourceTxt;

    if (messageChat.toString() === process.env.TGESCALATIONGROUP) {
        const escalation = await Escalation.findByIdAndUpdate(requestId, {isResolved: true});
        requestId = escalation.request;

        var req = await Request.findById(requestId, 'requestId viberReq');
        if(!req) req = {requestId: ''};
        sourceTxt = req.viberReq ? "#viber | " : "";
        if (req.whatsappReq) sourceTxt = "#whatsapp | ";
        else if (req.messengerReq) sourceTxt = "#messenger | ";


        try {
            await bot.editMessageText(actionMsgText + "\n#resolved | " + sourceTxt + status + "\nРедактор: " + moderator, {
                chat_id: messageChat,
                message_id: message.message_id,
                reply_markup: JSON.stringify({
                    'inline_keyboard' : [[{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + escalation._id }]]
                })
            });
        } catch (e) { safeErrorLog(e) }
        inline_keyboard = [[{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }]]
        messageChat = getLanguageTGChat(req.language)
    }
    var request = await Request.findByIdAndUpdate(requestId, {fakeStatus: fakeStatus});
    if(!request) request = {requestId: ''};

    inline_keyboard = changeInlineKeyboard(
        inline_keyboard,
        'decision',
        [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + requestId }]]
    )
    sourceTxt = request.viberReq ? "#viber | " : "";
    if (request.whatsappReq) sourceTxt = "#whatsapp | ";
    else if (request.messengerReq) sourceTxt = "#messenger | ";

    try {
        await bot.editMessageText(actionMsgText + "\n#resolved | " + sourceTxt + status + "\nМодератор: " + moderator, {
            chat_id: messageChat,
            message_id: message.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        });
    } catch (e) { safeErrorLog(e) }

    await involveModerator(requestId, callbackQuery.from);

    if (!request._id) return console.log('No request ' + requestId);
    if (!silentMode) {
        await notifyUsers(request, fakeStatus, bot);
    }
}

const onNeedUpdate = async (request, bot) => {

    const fakeStatus = String(request.fakeStatus);
    const actionMsgText = "№" + request.requestId;
    let status = getFakeText(fakeStatus), sourceTxt;
    sourceTxt = request.viberReq ? "#viber | " : "";
    if (request.whatsappReq) sourceTxt = "#whatsapp | ";
    else if (request.messengerReq) sourceTxt = "#messenger | ";
    var moderator;
    if (request.takenModerator) moderator = await involveModerator(request._id, request.takenModerator);
    else moderator = 'невідомий';

    const inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + request._id }]]

    try {
        await bot.editMessageText(actionMsgText + "\n#resolved | " + sourceTxt + status + "\nМодератор: " + moderator, {
            chat_id: getLanguageTGChat(request.language),
            message_id: request.moderatorActionMsgID,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        });
    } catch (e) { safeErrorLog(e) }
    await notifyUsers(request, fakeStatus, bot);

}

const onTakenRequest = async (request, bot) => {
    try {
        await bot.editMessageReplyMarkup({}, {
            chat_id: getLanguageTGChat(request.language),
            message_id: request.moderatorActionMsgID
        });
    } catch (e) { safeErrorLog(e) }
}

const onBackRequest = async (request, bot) => {
    //Change status back to pending
    let inline_keyboard = await statusesKeyboard(request._id, request.viberReq);

    try {
        await bot.editMessageReplyMarkup({
            inline_keyboard: inline_keyboard
        }, {
            chat_id: getLanguageTGChat(request.language),
            message_id: request.moderatorActionMsgID
        });
    } catch (e) {
        safeErrorLog(e);
    }
}

const onChangeStatusQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    //Change status back to pending
    const requestId = data.split('_')[1];
    const request = await Request.findByIdAndUpdate(requestId, {fakeStatus: 0});
    if (!request) return console.log('No request ' + requestId);
    let inline_keyboard = changeInlineKeyboard(
        message.reply_markup.inline_keyboard,
        'decision',
        [
            [
                { text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId },
                { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }
            ],
            [
                { text: '🟠 Напівправда', callback_data: 'FS_-5_' + requestId },
                { text: '🔵 Немає доказів', callback_data: 'FS_-4_' + requestId },
            ],
            [
                { text: '🟡 Відмова', callback_data: 'FS_-2_' + requestId },
                { text: '-->', callback_data: 'MORESTATUSES_' + requestId },
            ]
        ]
    )

    var sourceTxt = request.viberReq ? " | #viber " : "";
    if (request.whatsappReq) sourceTxt = " | #whatsapp ";
    else if (request.messengerReq) sourceTxt = " | #messenger ";

    try {
        await bot.editMessageText("№" + request.requestId + "\n#pending" + sourceTxt, {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        });
    } catch (e) {
        safeErrorLog(e);
    }
}

const onMoreStatusesQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    const requestId = data.split('_')[1];
    let inline_keyboard = changeInlineKeyboard(
        message.reply_markup.inline_keyboard,
        'decision',
        [
            [
                { text: '⁉️ Ескалація', callback_data: 'ESCALATE_' + requestId },
                { text: '⏭️ Пропустити', callback_data: 'SKIP_-2_' + requestId },
            ],
            [
                { text: '🌍 Іншомовний запит', callback_data: 'LANG_XX_' + requestId },
                { text: '🚫 Заблокувати', callback_data: 'BLOCK_' + requestId },
            ],
            [{ text: '<--', callback_data: 'CS_' + requestId }],
        ]
    )
    try {
        await bot.editMessageReplyMarkup(
            {inline_keyboard},
            {chat_id: message.chat.id, message_id: message.message_id},
        )
    } catch (e) {
        safeErrorLog(e);
    }
}

const onChangeLanguageQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    const [key, lang, requestId] = data.split('_');
    if (lang === "XX") {
        let inline_keyboard = changeInlineKeyboard(
            message.reply_markup.inline_keyboard,
            'decision',
            [
                [
                    { text: '🇺🇦 ua', callback_data: 'LANG_ua_' + requestId },
                    { text: '🇬🇧 en', callback_data: 'LANG_en_' + requestId },
                ],
                [{ text: '<--', callback_data: 'MORESTATUSES_' + requestId }],
            ]
        )
        try {
            await bot.editMessageReplyMarkup(
                {inline_keyboard},
                {chat_id: message.chat.id, message_id: message.message_id},
            )
        } catch (e) {
            safeErrorLog(e);
        }
    } else {
        let request = await Request.findById(requestId);
        if (!request) {
            try {
                return await bot.answerCallbackQuery(
                    callbackQuery.id,
                    {
                        text: "Помилка! Із даним запитом щось не так",
                        show_alert: true,
                    }
                );
            } catch (e) { return safeErrorLog(e) }
        } else if (request.language === lang) {
            try {
                return await bot.answerCallbackQuery(
                    callbackQuery.id,
                    {
                        text: "Цей запит вже знаходиться у приймальні вибраною вами мовою",
                        show_alert: true,
                    }
                );
            } catch (e) { return safeErrorLog(e) }
        } else {
            await changeRequestLanguage(request, lang, bot)
        }
    }

}

const onCommentQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    let requestId = data.split('_')[1];
    const moderator = callbackQuery.from.id;
    let messageChat = message.chat.id
    if (messageChat.toString() === process.env.TGESCALATIONGROUP) {
        const escalation = await Escalation.findByIdAndUpdate(requestId, {isResolved: true});
        requestId = escalation.request;
        try {
            await bot.editMessageReplyMarkup({}, {
                chat_id: message.chat.id,
                message_id: message.message_id
            });
        } catch (e) { safeErrorLog(e) }
    }

    const request = await Request.findById(requestId);
    if (!request) return
    messageChat = getLanguageTGChat(request.language)
    let options = {}
    //Send message to moderator (forwarded + action)
    try {
        let sentMsg = await bot.forwardMessage(moderator, messageChat, request.moderatorMsgID);
        options = {
            reply_to_message_id: sentMsg.message_id,
            reply_markup: JSON.stringify({
                force_reply: true
            })
        };
    } catch (e){
        await bot.sendMessage(messageChat, 'Необхідно стартанути бота @perevir_bot\n@' + callbackQuery.from.username + '\n\n' + "FYI @betabitter43 \n" );
        safeErrorLog(e);
    }

    try {
        await bot.sendMessage(moderator, '#comment_' + requestId , options);
    } catch (e){ safeErrorLog(e); }

    //Update moderators action message
    let existing_inline_keyboard = JSON.stringify(message.reply_markup.inline_keyboard);
    //Handle no changes request
    var commentIteration, btnPartText = '✉️ Залишити додатковий коментар', addText = '';
    for (var i in message.reply_markup.inline_keyboard) {
        if (message.reply_markup.inline_keyboard[i][0].callback_data.startsWith('COMMENT_')) {
            const btnText = message.reply_markup.inline_keyboard[i][0].text;
            if (btnText.length == btnPartText.length) {
                addText = ' 2';
            } else if (btnText.length > btnPartText.length) {
                commentIteration = parseInt(btnText.split(' ').pop());
                addText = ' ' + (commentIteration + 1);
            }
            break;
        }
    }

    let updated_inline_keyboard = changeInlineKeyboard(
        message.reply_markup.inline_keyboard,
        'comment',
        [[{text: btnPartText + addText, callback_data: 'COMMENT_' + requestId}]]
    )
    if (existing_inline_keyboard!==JSON.stringify(updated_inline_keyboard)) {
        try {
            await bot.editMessageReplyMarkup({
                inline_keyboard: updated_inline_keyboard
            }, {
                chat_id: messageChat,
                message_id: request.moderatorActionMsgID
            });
            //Set moderator for the comment
            await Request.findByIdAndUpdate(requestId, {commentChatId: messageChat });
        } catch (e) {
            safeErrorLog(e);
        }
    }
}

const onSubscriptionQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    //Change status back to pending
    const status = Boolean(parseInt(data.split('_')[1]));
    const userId = data.split('_')[2];
    //Update DB
    const user = await TelegramUser.findByIdAndUpdate(userId, {subscribed: status});
    //Update MSG
    const inline_keyboard = getSubscriptionBtn(status, user._id);

    try {
        await bot.editMessageReplyMarkup({
            inline_keyboard: inline_keyboard
        }, {
            chat_id: message.chat.id,
            message_id: message.message_id
        });
    } catch (e) {safeErrorLog(e);}

}

const onSendFakesQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery

    try {
        await bot.deleteMessage(message.chat.id, message.message_id);
        const send = Boolean(parseInt(data.split('_')[1]));
        if (send) {
            const fakeNews = await Data.findOne({name: 'fakeNews'});
            if (!fakeNews) return await bot.sendMessage(message.chat.id, NoCurrentFakes);
            const users = await TelegramUser.find({$and: [{language: 'ua'}, {subscribed: true}, {lastFakeNews: {$ne: fakeNews.value}}]});
            const message_id = fakeNews.value.split('_')[0];
            const chat_id = fakeNews.value.split('_')[1];
            await bot.sendMessage(message.chat.id, "🚀 Розсилка запущена");
            await sendFakes(users, message_id, chat_id, message.chat.id, bot);
        }
    } catch (e) {
         safeErrorLog(e);
    }

}

const onConfirmCommentQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    if (data === 'CONFIRM_') {
        try {
            await bot.deleteMessage(message.chat.id, message.message_id);
        } catch (e) {
            console.log(e);
        }
    } else {
        try {
            await bot.editMessageReplyMarkup({}, {
                chat_id: message.chat.id,
                message_id: message.message_id
            })
        } catch (e) {
            return console.log(e);
        }
        const requestId = data.split('_')[1];
        const commentMsgId = message.message_id;
        const request = await Request.findByIdAndUpdate(
            requestId,
            {commentMsgId: commentMsgId, commentChatId: message.chat.id }
        );
        if (!request) return
        await informRequestersWithComment(request, message.chat.id, commentMsgId, bot);
    }
}

const onConfirmClosePending = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    if (data === 'CLOSETIMEOUT_') {
        try {
            await bot.deleteMessage(message.chat.id, message.message_id);
        } catch (e) {
            safeErrorLog(e)
        }
    } else {
        const timeoutDate = new Date(parseInt(data.split('_')[1]));
        const closeEscalations = data.text.split("_")[2] === "ESC"
        let oldRequests, oldEscalations;
        let index;
        if (closeEscalations) {
            oldEscalations = await Escalation.find({"isResolved": 0, "createdAt": {$lt: timeoutDate}})
                .populate('request');
            for (index = 0; index < oldEscalations.length; index++) {
                try {
                    await closeRequestByTimeout(oldEscalations[index], bot, true);
                } catch (e) { safeErrorLog(e); }
            }
        } else {
            oldRequests = await Request.find({"fakeStatus": 0, "lastUpdate": {$lt: timeoutDate}});
            for (index = 0; index < oldRequests.length; index++) {
                try {
                    await closeRequestByTimeout(oldRequests[index], bot, false);
                } catch (e) { safeErrorLog(e); }
                // Not sure about this, but in order not to be accused in spaming users added 1 second pause
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            try {
                await bot.sendMessage(callbackQuery.from.id, 'Закрито ' + index +
                    ' повідомлень, що створені до ' + timeoutDate.toLocaleDateString('uk-UA') +
                    ' року та досі були в статусі #pending');
            } catch (e) { safeErrorLog(e); }
        }
    }
}

const onEscalateQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    const requestId = data.split('_')[1];
    const moderator = getUserName(callbackQuery.from);
    try {
        const request = await Request.findById(requestId);
        if (!request) return console.log('No request ' + requestId);
        let escalationId = new mongoose.Types.ObjectId();
        var escalation = new Escalation({
            _id: escalationId,
            request: requestId,
            createdAt: new Date(),
        });


        var {language} = await getLanguage(request.requesterTG);
        if (request.viberReq) {
            language = 'ua';
        } else if (request.whatsappReq) {
            language = 'en';
        } else if (request.messengerReq) {
            language = null;
        }
        await getText('request_escalated', language, async function(err, text) {
            if (err) return safeErrorLog(err);
            let options = {
                reply_to_message_id: request.requesterMsgID
            };

            if (request.viberReq) {
                notifyViber(text, request.viberRequester);
            } else if (request.whatsappReq) {
                sendTextMessage(request.whatsappRequester, text, request.whatsappMessageId);
            } else if (request.messengerReq) {
                var answer = "🇺🇦 UA: (ENG below)\n" + text['ua'] + "\n\n🌍 ENG:\n" + text['en'];
                sendTextMessageMessenger(request.messengerRequester, answer);
            } else {
                try {
                    await bot.sendMessage(request.requesterTG, text, options);
                } catch (e) {
                    safeErrorLog(e)
                    //try again without reply_to_message_id
                    try {
                        await bot.sendMessage(request.requesterTG, text);
                    } catch (e){
                        safeErrorLog(e);
                    }
                }
            }
        });

        const sentMsg = await bot.forwardMessage(
            process.env.TGESCALATIONGROUP,
            getLanguageTGChat(request.language),
            request.moderatorMsgID,
        );
        let inline_keyboard = [
            [
                { text: '⛔ Фейк', callback_data: 'FS_-1_' + escalationId },
                { text: '🟢 Правда', callback_data: 'FS_1_' + escalationId }
            ],
            [
                { text: '🟠 Напівправда', callback_data: 'FS_-5_' + escalationId },
                { text: '🔵 Немає доказів', callback_data: 'FS_-4_' + escalationId },
            ],
        ];
        inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + escalationId }]);
        var options = {
            reply_to_message_id: sentMsg.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        };
        var actionMsg;
        try {
            actionMsg = await bot.sendMessage(
                process.env.TGESCALATIONGROUP,
                '№' + request.requestId + '\n#pending\nЕскалацію прислав ' + moderator,
                options,
            )
        } catch (e) { safeErrorLog(e) }
        escalation.actionMsgID = actionMsg.message_id
        await escalation.save()

        inline_keyboard = [[{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }]]
        try {
            await bot.editMessageText("№" + request.requestId + "\n#escalated | Запит направлено на ескалацію модератором: " + moderator, {
                chat_id: message.chat.id,
                message_id: message.message_id,
                reply_markup: JSON.stringify({
                    inline_keyboard
                })
            });
        } catch (e) { safeErrorLog(e) }

    } catch (err) {
        console.error(err);
    }
}

const onUpdateCommentQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    if (data === 'UPDATECOMMENT_') {
        try {
            await bot.deleteMessage(message.chat.id, message.message_id);
        } catch (e) {
            console.log(e);
        }
    } else {
        try {
            await bot.editMessageReplyMarkup({}, {
                chat_id: message.chat.id,
                message_id: message.message_id
            })
        } catch (e) {
            return console.log(e);
        }

        const commentId = data.split('_')[1];
        let tag = message.reply_to_message.text.split("\n", 1)[0].split(' ')[0];
        let text = message.reply_to_message.text.slice(tag.length).trim();
        let entities = shiftOffsetEntities(
            message.reply_to_message.entities,
            message.reply_to_message.text.indexOf(text),
        )
        await Comment.findByIdAndUpdate(
            commentId,
            {comment: text, entities: entities }
        );
        try {
            await bot.sendMessage(message.chat.id, 'Зміни до ' + tag + ' збережено до бази');
        } catch (e) { safeErrorLog(e) }
    }
}

async function changeRequestLanguage(request, newLanguage, bot) {
    let fromLanguageChat = getLanguageTGChat(request.language)
    let toLanguageChat = getLanguageTGChat(newLanguage)
    if (fromLanguageChat === toLanguageChat) return;
    let moderatorMsgId, moderatorActionMsgId;
    try {
        moderatorMsgId = await bot.forwardMessage(toLanguageChat, request.requesterTG, request.requesterMsgID);
    } catch (e) {
        return safeErrorLog(e)
    }
    let inline_keyboard = await takeRequestKeyboard(request._id);
    let options = {
        reply_to_message_id: moderatorMsgId.message_id,
        reply_markup: JSON.stringify({
            inline_keyboard
        })
    };
    try {
        let initiator = getUserName(moderatorMsgId.forward_from);
        if (initiator.startsWith("@")) {
            initiator = initiator.substring(1)
        }
        moderatorActionMsgId = await bot.sendMessage(
            toLanguageChat,
            '№' + request.requestId + '\nініціатор: ' + initiator + '\n#pending',
            options,
        );
    } catch (e) {safeErrorLog(e)}

    try {
        await bot.deleteMessage(fromLanguageChat, request.moderatorMsgID)
        await bot.deleteMessage(fromLanguageChat, request.moderatorActionMsgID)
    } catch (e) {
        safeErrorLog(e)
    }
    await Request.updateOne(
        request,
        {
            language: newLanguage,
            moderatorActionMsgID: parseInt(moderatorActionMsgId.message_id),
            moderatorMsgID: parseInt(moderatorMsgId.message_id),
        },
    );
}

const onAutoAsnwerQuery  = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    const requestId = data.split('_')[1];
    const messageChat = message.chat.id;
    var msgText = message.text
    const request = await Request.findById(requestId);
    const inline_keyboard = await statusesKeyboard(requestId, false, true);

    if (request.text) {

        try {
            await bot.editMessageText(msgText + "\n\n🤖 AI відповідь завантажується...", {
                chat_id: messageChat,
                message_id: message.message_id,
                reply_markup: JSON.stringify({
                    inline_keyboard
                })

            });
        } catch (e) { safeErrorLog(e) }

        const autoReply = await automatedCheckGPT(request.text, 'ua');
        if (autoReply != false) {
            try {
                await bot.editMessageText(msgText + "\n\n🤖 AI відповідь:\n" + autoReply, {
                    chat_id: messageChat,
                    message_id: message.message_id,
                    disable_web_page_preview: true,
                    reply_markup: JSON.stringify({
                        inline_keyboard
                    })
                });
            } catch (e) { safeErrorLog(e) }
        } else {
            try {
                await bot.editMessageText(msgText + "\n\n🤖 AI відповідь відсутня.", {
                    chat_id: messageChat,
                    message_id: message.message_id,
                    reply_markup: JSON.stringify({
                        inline_keyboard
                    })

                });
            } catch (e) { safeErrorLog(e) }
        }
    } else {
        try {
            await bot.editMessageText(msgText + "\n\n🤖 AI відповідь відсутня", {
                chat_id: messageChat,
                message_id: message.message_id,
                reply_markup: JSON.stringify({
                    inline_keyboard
                })

            });
        } catch (e) { safeErrorLog(e) }
    }
}

const onBlockUserQuery = async (callbackQuery, bot) => {
    let text;
    if (!admins.includes(String(callbackQuery.from.id))) {
        text = "Блокувати користувачів можуть тільки адміністратори"
    } else {
        const requestId = callbackQuery.data.split('_')[1];
        const request = await Request.findById(requestId);
        if (request) {
            await blockRequestInitiator(request);
            text = "Користувача заблоковано"
        } else {
            text = "Проблема із запитом"
        }
    }
    return await bot.answerCallbackQuery(
        callbackQuery.id,
        {
            text: text,
            show_alert: true,
        }
    );
}

module.exports = {
    onFakeStatusQuery,
    onChangeStatusQuery,
    onCommentQuery,
    onSubscriptionQuery,
    onSendFakesQuery,
    onConfirmCommentQuery,
    onEscalateQuery,
    onUpdateCommentQuery,
    onNeedUpdate,
    onTakenRequest,
    onBackRequest,
    onReqTakeQuery,
    onMoreStatusesQuery,
    onConfirmClosePending,
    onChangeLanguageQuery,
    onAutoAsnwerQuery,
    onBlockUserQuery,
}

async function notifyViber(text, viberRequester) {
    const {messageViber} = require('../viber/bot');
    messageViber(text, viberRequester);
}
