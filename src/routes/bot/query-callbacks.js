const {getSubscriptionBtn, notifyUsers, sendFakes, sendAutoResponse, getUserName, sendFakesStatus} = require("./utils");
const {
    NoCurrentFakes, AutoResponseTagMap, ByInterestRequestText
} = require('./contstants')
const mongoose = require("mongoose");
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
            if (fakeStatus === '-2') inline_keyboard.push([{ text: '🖨 Шаблонна відповідь', callback_data: 'AR_' + requestId }]);
        }

        await bot.editMessageText("#resolved | " + status + "\nМодератор: " + moderator, {
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
    const {data, message} = callbackQuery;
    const moderator = callbackQuery.from.id;

    try {
        const requestId = data.split('_')[1];
        const request = await Request.findById(requestId);
        if (!request) return console.log('No request ' + requestId);

        const autoResponseType = data[2];
        let inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + requestId }]];
        inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }])
        let messageText = message.text

        if (autoResponseType === '_') {
            inline_keyboard.push([{ text: 'Клікбейт', callback_data: 'AR1_' + requestId }]);
            inline_keyboard.push([{ text: 'Нема фактів для перевірки', callback_data: 'AR2_' + requestId }]);
            inline_keyboard.push([{ text: 'Прохання про допомогу', callback_data: 'AR3_' + requestId }]);
            inline_keyboard.push([{ text: 'Посилання недоступне', callback_data: 'AR4_' + requestId }]);
            inline_keyboard.push([{ text: 'Оціночні судження', callback_data: 'AR5_' + requestId }]);
        } else {
            messageText = messageText + "\n#autoresponse " + AutoResponseTagMap[autoResponseType]
            await sendAutoResponse(request, autoResponseType, moderator, bot);
        }

        await bot.editMessageText(messageText, {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: JSON.stringify({inline_keyboard})
        });

    } catch (err) {
        console.error(err);
    }
}

const onRequestQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery;
    const requestId = data.split('_')[2];
    const reason = parseInt(data.split('_')[1]);

    try {
        await bot.deleteMessage(message.chat.id, message.message_id);
    } catch (e) {console.log(e)};

    const request = await Request.findById(requestId);
    if (!request) return console.log('Request is not found');
    //If reason is interest
    var options = {
        reply_to_message_id: request.requesterMsgID
    };
    if (reason === 0) { //Interesting
        await Request.findByIdAndDelete(requestId);
        return bot.sendMessage(request.requesterTG, ByInterestRequestText, options)
    } else if (reason === 4) { //Cancel
        return Request.findByIdAndDelete(requestId);
    }
    
    const sentMsg = await bot.forwardMessage(process.env.TGMAINCHAT, request.requesterTG, request.requesterMsgID);
    
    var inline_keyboard = [[{ text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId }, { text: '🟡 Відмова', callback_data: 'FS_-2_' + requestId }, { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }]];
    inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }]);
    var options = {
        reply_to_message_id: sentMsg.message_id,
        reply_markup: JSON.stringify({
            inline_keyboard
        })
    };
    const sentActionMsg = await bot.sendMessage(process.env.TGMAINCHAT, '#pending', options);
    await Request.findByIdAndUpdate(requestId, {moderatorMsgID: sentMsg.message_id, moderatorActionMsgID: sentActionMsg.message_id, requestReason: reason});

    //Inform user
    var informOptions = {
        disable_web_page_preview: true
    };
    await bot.sendMessage(request.requesterTG, 'Ми нічого не знайшли або не бачили такого. Почали опрацьовувати цей запит\n\nЗ початком війни журналісти @gwaramedia запустила бот для перевірки новин на фейки — @perevir_bot\n\nНам надходить дуууже багато повідомлень. Тому відповіді можуть сильно затримуватись.\n\nМи дуже раді, що ви не вірите всьому, що гуляє в мережі, і надсилаєте інфо на перевірку, але нам потрібні додаткові руки. \n\nЯкщо хочеш стати бійцем інфо фронту — заповнюй анкету за лінком:\nhttps://bit.ly/3Cilv7a',informOptions);
    
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
        console.error(e)
    }

    try {
        await bot.sendMessage(moderator, '#comment_' + requestId , options);
    } catch (e){ console.error(e) }
    //Update moderators action message
    let inline_keyboard;
    if (request.fakeStatus === 0) {
        inline_keyboard = [[{ text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId }, { text: '🟡 Відмова', callback_data: 'FS_-2_' + requestId }, { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }]];
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

    try {
        await bot.editMessageReplyMarkup({
            inline_keyboard: inline_keyboard
        }, {
            chat_id: message.chat.id,
            message_id: message.message_id
        });
    } catch (e) {console.log(e)}

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
    } catch (e) { console.log(e); }

}

module.exports = {
    onFakeStatusQuery,
    onChangeStatusQuery,
    onRequestQuery,
    onCommentQuery,
    onSubscriptionQuery,
    onSendFakesQuery,
    onAutoResponseQuery
}
