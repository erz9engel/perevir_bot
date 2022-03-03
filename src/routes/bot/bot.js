const mongoose = require('mongoose');
require('dotenv').config();
const {
    onStart,
    onCheckContent,
    onSubscription,
    onSetFakes,
    onReplyWithComment,
    onCheckRequest,
    onUnsupportedContent
} = require('./message-handlers');


//TELEGRAM BOT
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TGTOKEN;
const bot = new TelegramBot(token, { polling: true });

const Request = mongoose.model('Request');
const TelegramUser = mongoose.model('TelegramUser');

//BUTTONS TEXT
const CheckContentText = "Перевірити контент"
const SubscribtionText = "🔥 Актуальні фейки"

bot.on('message', async (msg) => {
    const text = msg.text;

    if (text === '/start') {
        await onStart(msg, bot);
    } else if (text === CheckContentText) {
        await onCheckContent(msg, bot)
    } else if (text === SubscribtionText) {
        await onSubscription(msg, bot)
    } else if (text.startsWith('/setfakes ')) { //todo check really ==-1, maybe startsWith?
        await onSetFakes(msg, bot);
    } else if (msg.reply_to_message && msg.reply_to_message.text && msg.reply_to_message.text.indexOf('#comment_') != -1){
        await onReplyWithComment(msg, bot);
    } else if ((msg.photo || msg.video || (msg.text && msg.text.length > 10)) && !msg.reply_to_message) { //Check if text > 10 in order to sort out short msgs
        await onCheckRequest(msg, bot);
    } else if (msg.audio || msg.document || msg.voice || msg.location) {
        await onUnsupportedContent(msg, bot);
    }
});

bot.on('callback_query', async function onCallbackQuery(callbackQuery) {

    const action = callbackQuery.data;
    const msg = callbackQuery.message;

    if (action.indexOf('FS_') == 0) {
        const requestId = action.split('_')[2], fakeStatus = action.split('_')[1];
        Request.findByIdAndUpdate(requestId, {fakeStatus: fakeStatus}, function(err, request){
            if (!request) return console.log('No request ' + requestId);
            var inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + requestId }]];
            if (!request.commentChatId) inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }]);
            var status;
            if (fakeStatus == 1) status = "#true | Правда"
            else if (fakeStatus == -1) status = "#false | Фейк"

            bot.editMessageText("#resolved | " + status, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                reply_markup: JSON.stringify({
                    inline_keyboard
                })
            });

            notifyUsers(request, fakeStatus);
                
        });

    } else if (action.indexOf('CS_') == 0) {
        //Change status back to pending
        const requestId = action.split('_')[1];
        const request = await Request.findByIdAndUpdate(requestId, {fakeStatus: 0});
        if (!request) return console.log('No request ' + requestId);
        var inline_keyboard = [[{ text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId }, { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }]];
        if (!request.commentChatId) inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }]);
        
        try {
            bot.editMessageText("#pending", {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                reply_markup: JSON.stringify({
                    inline_keyboard
                })
            });
        } catch (e){ console.log(e) }
    
    } else if (action.indexOf('COMMENT_') == 0) {
        const requestId = action.split('_')[1];
        const moderator = callbackQuery.from.id;
        const request = await Request.findById(requestId);
        //Send message to moderator (forwarded + action)
        try {
            var sentMsg = await bot.forwardMessage(moderator, msg.chat.id, request.moderatorMsgID);
            var options = {
                reply_to_message_id: sentMsg.message_id,
                reply_markup: JSON.stringify({
                    force_reply: true
                })
            };
        } catch (e){
            bot.sendMessage(msg.chat.id, 'Необхідно стартанути бота @perevir_bot\n@' + callbackQuery.from.username + '\n\n' + "FYI @betabitter43 \n" );
            console.error(e)
        }
        
        try {
            bot.sendMessage(moderator, '#comment_' + requestId , options);
        } catch (e){ console.log(e) }
        //Update moderators action message
        var inline_keyboard;
        if (request.fakeStatus == 0) {
            inline_keyboard = [[{ text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId }, { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }]];
        } else {
            inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + requestId }]];
        }
        bot.editMessageReplyMarkup({
            inline_keyboard: inline_keyboard
        }, {
                chat_id: msg.chat.id,
                message_id: msg.message_id
            });
        //Set moderator for the comment
        await Request.findByIdAndUpdate(requestId, {commentChatId: msg.chat.id });

    } else if (action.indexOf('SUB_') == 0) {
        //Change status back to pending
        const status = Boolean(parseInt(action.split('_')[1]));
        const userId = action.split('_')[2];
        //Update DB
        const user = await TelegramUser.findByIdAndUpdate(userId, {subscribed: status});
        //Update MSG
        const inline_keyboard = getSubscriptionBtn(status, user._id);
        bot.editMessageReplyMarkup({
            inline_keyboard: inline_keyboard
        }, {
                chat_id: msg.chat.id,
                message_id: msg.message_id
            });

    }
});

function getSubscriptionBtn(status, user_id) {
    var inline_keyboard = [];
    if (status) inline_keyboard.push([{ text: '🔴 Відмовитися від підбірок', callback_data: 'SUB_0_' + user_id }]);
    else inline_keyboard.push([{ text: '✨ Отримувати підбірки', callback_data: 'SUB_1_' + user_id }]);
    return inline_keyboard;
}

function notifyUsers(foundRequest, fakeStatus) {
    var options = {
        reply_to_message_id: foundRequest.requesterMsgID
    };

    if (fakeStatus == 1) {
        try {
            bot.sendMessage(foundRequest.requesterTG, 'Ваше звернення визначено як правдиве', options);
        } catch (e){ console.log(e) }

        for (var i in foundRequest.otherUsetsTG) {
            const optionsR = {
                reply_to_message_id: foundRequest.otherUsetsTG[i].requesterMsgID
            };
            try {
                bot.sendMessage(foundRequest.otherUsetsTG[i].requesterTG, 'Ваше звернення визначено як правдиве', optionsR);
            } catch (e){ console.log(e) }
        }

    } else if (fakeStatus == -1) {
        try {
            bot.sendMessage(foundRequest.requesterTG, 'Ваше звернення визначено як оманливе', options);
        } catch (e){ console.log(e) }

        for (var i in foundRequest.otherUsetsTG) {
            const optionsR = {
                reply_to_message_id: foundRequest.otherUsetsTG[i].requesterMsgID
            };
            try {
                bot.sendMessage(foundRequest.otherUsetsTG[i].requesterTG, 'Ваше звернення визначено як оманливе', optionsR);
            } catch (e){ console.log(e) }
        }
    }
}

bot.on("polling_error", (err) => console.log(err.message));

module.exports = {
    message: async function (msg, pin) {
        try {
            const sentMsg = await bot.sendMessage(process.env.TGMAINCHAT, msg);
            if (pin) await bot.pinChatMessage(process.env.TGMAINCHAT, sentMsg.message_id);
        } catch (e){ console.log(e) }
    }
};
