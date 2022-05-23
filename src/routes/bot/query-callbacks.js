const {getSubscriptionBtn, notifyUsers, sendFakes, getUserName, sendFakesStatus, involveModerator} = require("./utils");
const {
    NoCurrentFakes
} = require('./contstants')
const {informRequestersWithComment} = require("./message-handlers");
const mongoose = require("mongoose");
const { getText } = require("./localisation");
require('dotenv').config();

const Request = mongoose.model('Request');
const TelegramUser = mongoose.model('TelegramUser');
const Data = mongoose.model('Data');

const onFakeStatusQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    const requestId = data.split('_')[2], fakeStatus = data.split('_')[1];
    const moderator = getUserName(callbackQuery.from);
    try {
        const request = await Request.findByIdAndUpdate(requestId, {fakeStatus: fakeStatus});
        if (!request) return console.log('No request ' + requestId);

        let status;
        if (fakeStatus === '1') status = "#true | Правда"
        else if (fakeStatus === '-1') status = "#false | Фейк"
        else if (fakeStatus === '-2') status = "#reject | Відмова"
        
        let inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + requestId }]];
        if (!request.commentChatId) {
            inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }])
        }

        await bot.editMessageText("#resolved | " + status + "\nМодератор: " + moderator, {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        });

        await involveModerator(requestId, callbackQuery.from);

        await notifyUsers(request, fakeStatus, bot);

    } catch (e) {
        console.log(e);
    }
}

const onChangeStatusQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    //Change status back to pending
    const requestId = data.split('_')[1];
    const request = await Request.findByIdAndUpdate(requestId, {fakeStatus: 0});
    if (!request) return console.log('No request ' + requestId);
    let inline_keyboard = message.reply_markup.inline_keyboard
    inline_keyboard[0] = [{ text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId }, { text: '🟡 Відмова', callback_data: 'FS_-2_' + requestId }, { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }];

    try {
        await bot.editMessageText("#pending", {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        });
    } catch (e) {
        console.log(e);
    }
}

const onCommentQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery

    const requestId = data.split('_')[1];
    const moderator = callbackQuery.from.id;
    const request = await Request.findById(requestId);
    if (!request) return
    let options = {}
    //Send message to moderator (forwarded + action)
    try {
        let sentMsg = await bot.forwardMessage(moderator, message.chat.id, request.moderatorMsgID);
        options = {
            reply_to_message_id: sentMsg.message_id,
            reply_markup: JSON.stringify({
                force_reply: true
            })
        };
    } catch (e){
        await bot.sendMessage(message.chat.id, 'Необхідно стартанути бота @perevir_bot\n@' + callbackQuery.from.username + '\n\n' + "FYI @betabitter43 \n" );
        console.log(e);
    }

    try {
        await bot.sendMessage(moderator, '#comment_' + requestId , options);
    } catch (e){ console.log(e);}
    //Update moderators action message
    let inline_keyboard = message.reply_markup.inline_keyboard
    if (inline_keyboard[1][0].text === '✉️ Залишити коментар') {
        inline_keyboard[1] = [{text: '✉️ Залишити додатковий коментар', callback_data: 'COMMENT_' + requestId}];
        try {
            await bot.editMessageReplyMarkup({
                inline_keyboard: inline_keyboard
            }, {
                chat_id: message.chat.id,
                message_id: message.message_id
            });
            //Set moderator for the comment
            await Request.findByIdAndUpdate(requestId, {commentChatId: message.chat.id });
        } catch (e) {
            console.log(e);
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
    } catch (e) {
        console.log(e);
    }

}

const onSendFakesQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    
    try { 
        await bot.deleteMessage(message.chat.id, message.message_id);
        const send = Boolean(parseInt(data.split('_')[1]));
        if (send) {
            const fakeNews = await Data.findOne({name: 'fakeNews'});
            if (!fakeNews) return await bot.sendMessage(message.chat.id, NoCurrentFakes);
            const allUsers = await TelegramUser.countDocuments();
            const users = await TelegramUser.find({$and: [{subscribed: true}, {lastFakeNews: {$ne: fakeNews.value}}]});
            const message_id = fakeNews.value.split('_')[0];
            const chat_id = fakeNews.value.split('_')[1];
            await sendFakesStatus (allUsers, users.length, message.chat.id, bot);
            await sendFakes(users, message_id, chat_id, message.chat.id, bot);
        }
    } catch (e) { 
        console.log(e);
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


module.exports = {
    onFakeStatusQuery,
    onChangeStatusQuery,
    onCommentQuery,
    onSubscriptionQuery,
    onSendFakesQuery,onConfirmCommentQuery
}
