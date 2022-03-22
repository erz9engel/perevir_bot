const {getSubscriptionBtn, notifyUsers, sendFakes, sendAutoResponse} = require("./utils");
const {
    NoCurrentFakes, AutoResponseMap
} = require('./contstants')
const mongoose = require("mongoose");

const Request = mongoose.model('Request');
const TelegramUser = mongoose.model('TelegramUser');
const Data = mongoose.model('Data');

const onFakeStatusQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    const requestId = data.split('_')[2], fakeStatus = data.split('_')[1];
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
            if (fakeStatus === '-2') {
                inline_keyboard.push([
                    { text: 'Клікбейт', callback_data: 'AR1_' + requestId },
                    { text: '0 інфо', callback_data: 'AR2_' + requestId },
                    { text: 'Допомога', callback_data: 'AR3_' + requestId }
                ]);
            }
        }

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

const onAutoResponseQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    const moderator = callbackQuery.from.id;

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
        const requestId = data.split('_')[1];
        const autoResponseType = data[2]
        const request = await Request.findById(requestId);
        if (!request) return console.log('No request ' + requestId);

        let inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + requestId }]];

        await bot.editMessageText(message.text + "/n#autoresponse " + AutoResponseMap[autoResponseType], {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        });

        await sendAutoResponse(request, autoResponseType, moderator, bot);
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
    let inline_keyboard = [[{ text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId }, { text: '🟡 Відмова', callback_data: 'FS_-2_' + requestId }, { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }]];
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

const onSendFakesQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery

    try { 
        await bot.deleteMessage(message.chat.id, message.message_id);
        const send = Boolean(parseInt(data.split('_')[1]));
        if (send) {
            const users = await TelegramUser.find({subscribed: true});
            const fakeNews = await Data.findOne({name: 'fakeNews'});
            if (!fakeNews) return await bot.sendMessage(message.chat.id, NoCurrentFakes);
            const message_id = fakeNews.value.split('_')[0];
            const chat_id = fakeNews.value.split('_')[1];
            await sendFakes(users, message_id, chat_id, bot);
        }
    } catch (e) { console.log(e); }

}


module.exports = {
    onFakeStatusQuery,
    onChangeStatusQuery,
    onCommentQuery,
    onSubscriptionQuery,
    onSendFakesQuery,
    onAutoResponseQuery
}
