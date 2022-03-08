function getSubscriptionBtn(status, user_id) {
    var inline_keyboard = [];
    if (status) inline_keyboard.push([{ text: '🔴 Відмовитися від підбірок', callback_data: 'SUB_0_' + user_id }]);
    else inline_keyboard.push([{ text: '✨ Отримувати підбірки', callback_data: 'SUB_1_' + user_id }]);
    return inline_keyboard;
}

async function notifyUsers(foundRequest, fakeStatus, bot) {
    let options = {
        reply_to_message_id: foundRequest.requesterMsgID
    };

    if (fakeStatus === '1') {
        try {
            await bot.sendMessage(foundRequest.requesterTG, 'Ваше звернення визначено як правдиве', options);
        } catch (e){ console.log(e) }

        for (let i in foundRequest.otherUsetsTG) {
            const optionsR = {
                reply_to_message_id: foundRequest.otherUsetsTG[i].requesterMsgID
            };
            try {
                await bot.sendMessage(foundRequest.otherUsetsTG[i].requesterTG, 'Ваше звернення визначено як правдиве', optionsR);
            } catch (e){ console.log(e) }
        }

    } else if (fakeStatus === '-1') {
        try {
            await bot.sendMessage(foundRequest.requesterTG, 'Ваше звернення визначено як оманливе', options);
        } catch (e){ console.log(e) }

        for (let i in foundRequest.otherUsetsTG) {
            const optionsR = {
                reply_to_message_id: foundRequest.otherUsetsTG[i].requesterMsgID
            };
            try {
                await bot.sendMessage(foundRequest.otherUsetsTG[i].requesterTG, 'Ваше звернення визначено як оманливе', optionsR);
            } catch (e){ console.log(e) }
        }
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

module.exports = {
    getSubscriptionBtn,
    notifyUsers,
    sendFakes
}