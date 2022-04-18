const {
    TrueMessageText,
    FakeMessageText,
    RejectMessageText,
    AutoResponseTextMap,
    TimeoutMessageText,
    NotifyUserTextMap
} = require('./contstants')

const mongoose = require("mongoose");
const Request = mongoose.model('Request');

function getSubscriptionBtn(status, user_id) {
    var inline_keyboard = [];
    if (status) inline_keyboard.push([{ text: '🔴 Відмовитися від підбірок', callback_data: 'SUB_0_' + user_id }]);
    else inline_keyboard.push([{ text: '✨ Отримувати підбірки', callback_data: 'SUB_1_' + user_id }]);
    return inline_keyboard;
}

function getUserName(user) {
    if (user.username) {
        return "@" + user.username
    }
    let fullname = user.first_name
    if (user.last_name) fullname = fullname + " " + user.last_name
    return fullname
}

async function notifyUsers(foundRequest, fakeStatus, bot) {
    let options = {
        reply_to_message_id: foundRequest.requesterMsgID
    };

    try {
        await bot.sendMessage(foundRequest.requesterTG, NotifyUserTextMap[fakeStatus], options);
    } catch (e){ console.log(e) }

    for (let i in foundRequest.otherUsetsTG) {
        const optionsR = {
            reply_to_message_id: foundRequest.otherUsetsTG[i].requesterMsgID
        };
        try {
            await bot.sendMessage(foundRequest.otherUsetsTG[i].requesterTG, NotifyUserTextMap[fakeStatus], optionsR);
        } catch (e){ console.log(e) }
    }
}

async function sendAutoResponse(foundRequest, autoReplyType, moderator, bot){
    let options = {
        reply_to_message_id: foundRequest.requesterMsgID
    };

    let replyText = AutoResponseTextMap[autoReplyType]

    try {
        await bot.sendMessage(foundRequest.requesterTG, replyText, options);
    } catch (e) {
        console.log(e)
    }
}

async function sendFakes(users, message_id, chat_id, bot) {
    const RPS = 10; //Requests per second

    for (var index = 0; index < users.length; index++) {
        try {
            const inline_keyboard = getSubscriptionBtn(users[index].subscribed, users[index]._id);
            var options = {
                reply_markup: JSON.stringify({
                    inline_keyboard
                })
            };
            await new Promise(resolve => setTimeout(resolve, 1000 / RPS));
            await bot.copyMessage(users[index].telegramID, chat_id, message_id, options);
        } catch (e) { console.log(e.response.body.description); }
    }
}

async function closeRequestByTimeout(request, bot) {
    let inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + request._id }]];
    if (!request.commentChatId) {
        inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + request._id }])
    }

    await bot.editMessageText("#timeout", {
        chat_id: process.env.TGMAINCHAT,
        message_id: request.moderatorActionMsgID,
        reply_markup: JSON.stringify({
            inline_keyboard
        })
    });
    await notifyUsers(request, "-3", bot)
    await Request.updateOne(request, {fakeStatus: "-3"});
}

async function sendFakesStatus (allUsers, subscribedUsers, chat_id, bot) {
    try {
        const replyMsg = "🚀 Розсилка запущена\n\nЗагалом користувачів: <b>" + allUsers + "</b>\nПідписаних на розсилку: <b>" + subscribedUsers + '</b> (' + (subscribedUsers/allUsers*100).toFixed(2) + '%)';
        const options = {
            parse_mode: "HTML"
        };
        await bot.sendMessage(chat_id, replyMsg, options);
    } catch (e) {
        console.log(e)
    }
}

module.exports = {
    getSubscriptionBtn,
    notifyUsers,
    sendFakes,
    sendAutoResponse,
    getUserName,
    closeRequestByTimeout,
    sendFakesStatus
}