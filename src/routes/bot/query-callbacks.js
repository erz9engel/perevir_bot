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
} = require("./utils");

const {
    NoCurrentFakes
} = require('./contstants')
const {informRequestersWithComment} = require("./message-handlers");
const { getText } = require('./localisation');
const mongoose = require("mongoose");
require('dotenv').config();

const Request = mongoose.model('Request');
const TelegramUser = mongoose.model('TelegramUser');
const Data = mongoose.model('Data');
const Escalation = mongoose.model('Escalation');
const Comment = mongoose.model('Comment');

const onFakeStatusQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    let requestId = data.split('_')[2], fakeStatus = data.split('_')[1];
    let messageChat = message.chat.id
    let inline_keyboard = message.reply_markup.inline_keyboard
    let actionMsgText = message.text.split("\n#pending")[0]
    const moderator = getUserName(callbackQuery.from);
    let status, sourceTxt;
    if (fakeStatus === '1') status = "#true | Правда"
    else if (fakeStatus === '-1') status = "#false | Фейк"
    else if (fakeStatus === '-2') status = "#reject | Відмова"
    else if (fakeStatus === '-4') status = "#noproof | Немає доказів"
    else if (fakeStatus === '-5') status = "#manipulation | Напівправда"
    

    if (messageChat.toString() === process.env.TGESCALATIONGROUP) {
        const escalation = await Escalation.findByIdAndUpdate(requestId, {isResolved: true});
        requestId = escalation.request;

        var req = await Request.findById(requestId, 'requestId viberReq');
        if(!req) req = {requestId: ''};
        sourceTxt = req.viberReq ? "#viber | " : "";
        
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
        messageChat = process.env.TGMAINCHAT
    }
    var request = await Request.findByIdAndUpdate(requestId, {fakeStatus: fakeStatus});
    if(!request) request = {requestId: ''};
    
    inline_keyboard = changeInlineKeyboard(
        inline_keyboard,
        'decision',
        [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + requestId }]]
    )
    sourceTxt = request.viberReq ? "#viber | " : "";
        
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
    await notifyUsers(request, fakeStatus, bot);
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
                { text: '⁉️ Ескалація', callback_data: 'ESCALATE_' + requestId },
            ]
        ]
    )

    const sourceTxt = request.viberReq ? " | #viber " : "";

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
        messageChat = process.env.TGMAINCHAT
    }

    const request = await Request.findById(requestId);
    if (!request) return
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
    } catch (e) { safeErrorLog(e); }

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

        const {language,id} = await getLanguage(request.requesterTG);
        await getText('request_escalated', language, async function(err, text) {
            if (err) return safeErrorLog(err);
            let options = {
                reply_to_message_id: request.requesterMsgID
            };

            if (request.viberReq) {
                notifyViber(text, request.viberRequester);
            } else {
                try {
                    await bot.sendMessage(request.requesterTG, text, options);
                } catch (e) {
                    safeErrorLog(e)
                }
            }
        });

        const sentMsg = await bot.forwardMessage(
            process.env.TGESCALATIONGROUP,
            process.env.TGMAINCHAT,
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

const onChatModeQuery = async (callbackQuery, bot) => {
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
            + 'Для того, щоб вийти з режиму діалогу напишіть /close_chat '
            + 'або скористайтеся кнопкою внизу'
        try {
            await bot.sendMessage(
                moderatorId,
                moderatorText,
                {
                    reply_markup: {
                        resize_keyboard: true,
                        one_time_keyboard: false,
                        keyboard: [[{ text: '📵 Завершити діалог'}]]
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
    onFakeStatusQuery,
    onChangeStatusQuery,
    onCommentQuery,
    onSubscriptionQuery,
    onSendFakesQuery,
    onConfirmCommentQuery,
    onEscalateQuery,
    onUpdateCommentQuery,
    onChatModeQuery
}

async function notifyViber(text, viberRequester) {
    const {messageViber} = require('../viber/bot');
    messageViber(text, viberRequester);
}
