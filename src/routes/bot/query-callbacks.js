const {getSubscriptionBtn, notifyUsers} = require("./utils");
const mongoose = require("mongoose");

const Request = mongoose.model('Request');
const TelegramUser = mongoose.model('TelegramUser');

const onFakeStatusQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    const requestId = data.split('_')[2], fakeStatus = data.split('_')[1];
    try {
        const request = await Request.findByIdAndUpdate(requestId, {fakeStatus: fakeStatus});
        if (!request) return console.log('No request ' + requestId);

        let inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + requestId }]];
        if (!request.commentChatId) inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }]);

        let status;
        if (fakeStatus === '1') status = "#true | Правда"
        else if (fakeStatus === '-1') status = "#false | Фейк"

        await bot.editMessageText("#resolved | " + status, {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        });

        await notifyUsers(request, fakeStatus, bot);

    } catch (err) {
        console.error(err);
    }
}

const onChangeStatusQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    //Change status back to pending
    const requestId = data.split('_')[1];
    const request = await Request.findByIdAndUpdate(requestId, {fakeStatus: 0});
    if (!request) return console.log('No request ' + requestId);
    let inline_keyboard = [[{ text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId }, { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }]];
    if (!request.commentChatId) inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }]);

    try {
        await bot.editMessageText("#pending", {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        });
    } catch (e) {
        console.error(e)
    }
}

const onCommentQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery

    const requestId = data.split('_')[1];
    const moderator = callbackQuery.from.id;
    const request = await Request.findById(requestId);
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
        console.error(e)
    }

    try {
        await bot.sendMessage(moderator, '#comment_' + requestId , options);
    } catch (e){ console.error(e) }
    //Update moderators action message
    let inline_keyboard;
    if (request.fakeStatus === 0) {
        inline_keyboard = [[{ text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId }, { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }]];
    } else {
        inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + requestId }]];
    }

    await bot.editMessageReplyMarkup({
        inline_keyboard: inline_keyboard
    }, {
        chat_id: message.chat.id,
        message_id: message.message_id
    });
    //Set moderator for the comment
    await Request.findByIdAndUpdate(requestId, {commentChatId: message.chat.id });
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

    await bot.editMessageReplyMarkup({
        inline_keyboard: inline_keyboard
    }, {
        chat_id: message.chat.id,
        message_id: message.message_id
    });

}

module.exports = {
    onFakeStatusQuery,
    onChangeStatusQuery,
    onCommentQuery,
    onSubscriptionQuery
}