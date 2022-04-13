const {
    TrueMessageText,
    FakeMessageText,
    RejectMessageText,
    AutoResponseTextMap,
    TimeoutMessageText,
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

    if (fakeStatus === '1') {
        try {
            await bot.sendMessage(foundRequest.requesterTG, TrueMessageText, options);
        } catch (e){ console.log(e) }

        for (let i in foundRequest.otherUsetsTG) {
            const optionsR = {
                reply_to_message_id: foundRequest.otherUsetsTG[i].requesterMsgID
            };
            try {
                await bot.sendMessage(foundRequest.otherUsetsTG[i].requesterTG, TrueMessageText, optionsR);
            } catch (e){ console.log(e) }
        }

    } else if (fakeStatus === '-1') {
        try {
            await bot.sendMessage(foundRequest.requesterTG, FakeMessageText, options);
        } catch (e){ console.log(e) }

        for (let i in foundRequest.otherUsetsTG) {
            const optionsR = {
                reply_to_message_id: foundRequest.otherUsetsTG[i].requesterMsgID
            };
            try {
                await bot.sendMessage(foundRequest.otherUsetsTG[i].requesterTG, FakeMessageText, optionsR);
            } catch (e){ console.log(e) }
        }
    
    } else if (fakeStatus === '-2') {
        try {
            await bot.sendMessage(foundRequest.requesterTG, RejectMessageText, options);
        } catch (e){ console.log(e) }

        for (let i in foundRequest.otherUsetsTG) {
            const optionsR = {
                reply_to_message_id: foundRequest.otherUsetsTG[i].requesterMsgID
            };
            try {
                await bot.sendMessage(foundRequest.otherUsetsTG[i].requesterTG, RejectMessageText, optionsR);
            } catch (e){ console.log(e) }
        }
    } else if (fakeStatus === '-3') {
        try {
            await bot.sendMessage(foundRequest.requesterTG, TimeoutMessageText, options);
        } catch (e){ console.log(e) }

        for (let i in foundRequest.otherUsetsTG) {
            const optionsR = {
                reply_to_message_id: foundRequest.otherUsetsTG[i].requesterMsgID
            };
            try {
                await bot.sendMessage(foundRequest.otherUsetsTG[i].requesterTG, TimeoutMessageText, optionsR);
            } catch (e){ console.log(e) }
        }
    }
}

async function sendAutoResponse(foundRequest, autoReplyType, moderator, bot){
    let options = {
        reply_to_message_id: foundRequest.requesterMsgID
    };

    let replyText = AutoResponseTextMap[autoReplyType]

    try {
        await bot.sendMessage(foundRequest.requesterTG, replyText, options);
        await bot.sendMessage(moderator, replyText, options);
    } catch (e) {
        console.log(e)
    }
}

async function sendFakes(users, message_id, chat_id, bot) {

    users.forEach(async function (user) {
        try {
            const inline_keyboard = getSubscriptionBtn(user.subscribed, user._id);
            var options = {
                reply_markup: JSON.stringify({
                    inline_keyboard
                })
            };
            await bot.copyMessage(user.telegramID, chat_id, message_id, options);
        } catch (e) { console.log(e.response.body.description); }
    });

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