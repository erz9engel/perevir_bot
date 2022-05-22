const mongoose = require("mongoose");
const { getText } = require('./localisation');
const Request = mongoose.model('Request');
const TelegramUser = mongoose.model('TelegramUser');
const Moderator = mongoose.model('Moderator');
const SourceTelegram = mongoose.model('SourceTelegram');
const SourceDomain = mongoose.model('SourceDomain');

function getSubscriptionBtn(status, user_id) {
    var inline_keyboard = [];
    if (status) inline_keyboard.push([{ text: '🔴 Відмовитися від підбірок', callback_data: 'SUB_0_' + user_id }]);
    else inline_keyboard.push([{ text: '✨ Отримувати підбірки', callback_data: 'SUB_1_' + user_id }]);
    return inline_keyboard;
}

function getMailBtn () {
    const inline_keyboard = [[{text: '🔎 Дізнатися більше', url: 'https://t.me/gwaramedia'}]];
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

    var textArg;
    if (fakeStatus == "1") textArg = 'true_status';
    else if (fakeStatus == "-1") textArg = 'fake_status';
    else if (fakeStatus == "-2") textArg = 'reject_status';
    else if (fakeStatus == "-3") textArg = 'manipulation_status';
    else if (fakeStatus == "-4") textArg = 'noproof_status';
    else if (fakeStatus == "-5") textArg = 'timeout_request';

    await getText(textArg, 'ua', async function(err, text){
        if (err) return console.log(err);
        let options = {
            reply_to_message_id: foundRequest.requesterMsgID
        };
    
        try {
            await bot.sendMessage(foundRequest.requesterTG, text, options);
        } catch (e){ console.log(e) }
    
        for (let i in foundRequest.otherUsetsTG) {
            const optionsR = {
                reply_to_message_id: foundRequest.otherUsetsTG[i].requesterMsgID
            };
            try {
                await bot.sendMessage(foundRequest.otherUsetsTG[i].requesterTG, text, optionsR);
            } catch (e){ console.log(e) }
        }
    });
}

async function sendFakes(users, message_id, chat_id, admin, bot) {
    const RPS = 5; //Requests per second

    for (var index = 0; index < users.length; index++) {
        try {
            const inline_keyboard = getMailBtn();
            var options = {
                reply_markup: JSON.stringify({
                    inline_keyboard
                })
            };
            await new Promise(resolve => setTimeout(resolve, 1000 / RPS));
            await bot.copyMessage(users[index].telegramID, chat_id, message_id, options);
            await TelegramUser.updateOne(users[index], {lastFakeNews: message_id + "_" + chat_id});
            console.log(index + " - " + users.length );
        } catch (e) { 
            if (e.response && e.response.body && e.response.body.description) console.log(e.response.body.description);
            else console.log(e);
        }
        if (index == users.length - 1) {
            //Notify admin about end result
            const receivedUsers = await TelegramUser.find({lastFakeNews: message_id + "_" + chat_id}, '');
            await bot.sendMessage(admin, "Результат розсилки\nДоставлено: " + receivedUsers.length);
            await bot.sendMessage(394717645, "Результат розсилки\nДоставлено: " + receivedUsers.length);
        }
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

async function involveModerator (requestId, moderatorTg) {

    const request = await Request.findById(requestId, 'moderator');
    if (!request) return console.log('There is no request to assign moderator');
    else if (request.moderator) return console.log('Second assignment of moderator to request');

    const moderatorTgId = moderatorTg.id;
    var moderator = await Moderator.findOneAndUpdate({telegramID: moderatorTgId}, {$push: {requests: requestId}, lastAction: new Date()});
    const now = new Date();
    if (!moderator) {
        const name = getUserName(moderatorTg);
        let newModerator = new Moderator({
            _id: new mongoose.Types.ObjectId(),
            telegramID: moderatorTgId,
            name: name,
            requests: [request._id],
            lastAction: now,
            createdAt: now
        });
        await newModerator.save().then((md) => {
            moderator = md;
        }).catch(() => {});
    }
    
    await Request.findByIdAndUpdate(requestId, {moderator: moderator._id, lastUpdate: now});

}

const getDomainWithoutSubdomain = hostname => {
    const urlParts = hostname.split('.');
  
    return urlParts
      .slice(urlParts.length - 2)
      .join('.')
}

async function newFacebookSource (url) {
    const { hostname, pathname, searchParams } = url;
    const host = getDomainWithoutSubdomain(hostname);
    const decoded = decodeURI(pathname);
    var username = decoded.split('/')[1];
    if (username == 'groups') return false
    else if (username == 'profile.php' && searchParams.get('id')) {
       username = searchParams.get('id');
    }
    if (username == '') return null;

    return { hostname: host, username: username }
}

async function newTwitterSource (url) {
    const { hostname, pathname } = url;
    const host = getDomainWithoutSubdomain(hostname);
    const decoded = decodeURI(pathname);
    const username = decoded.split('/')[1];
    if (username == '') return null;

    return { hostname: host, username: username }
}

async function newYoutubeSource (url) {
    const { hostname, pathname } = url;
    const host = getDomainWithoutSubdomain(hostname);
    const decoded = decodeURI(pathname);
    var username = decoded.split('/')[2];
    if (!username || username == '') {
        username = decoded.split('/')[1];
    }
    if (username == '') return null;

    return { hostname: host, username: username }
}

async function getLabeledSource (text){
    try {
        const { hostname, pathname, searchParams} = new URL(text);
        const host = getDomainWithoutSubdomain(hostname);
        const decoded = decodeURI(pathname);
        var username;
        
        if (host == 'facebook.com' || host == 'twitter.com') {
            username = decoded.split('/')[1];
            if (searchParams.get('id')) {
                username = searchParams.get('id');
            } else if (!username || username == '') return null
            return await SourceDomain.findOneAndUpdate({$and: [ {hostname: host}, {username: username} ]}, { $inc: { requestsAmount: 1 }});

        } else if (host == 'youtube.com') {
            username = decoded.split('/')[2];
            if (!username || username == '') {
                username = decoded.split('/')[1];
            }
            if (!username || username == '') return null
            return await SourceDomain.findOneAndUpdate({$and: [ {hostname: host}, {username: username} ]}, { $inc: { requestsAmount: 1 }});

        } else {
            return await SourceDomain.findOneAndUpdate({ domain: host }, { $inc: { requestsAmount: 1 }});
        }
        
    } catch(e) { return null }    
}
function getCallbackDataFromKeyboard(inlineKeyboard) {
    try {
        return inlineKeyboard[0][0].callback_data;
    } catch (e) {
        return '';
    }
}

function changeInlineKeyboard (inlineKeyboard, blockToChange, newBlock) {
    /*
    We have different logical blocks in inline keyboard: decision block, comment block,
    more might be added in the future. These blocks are pretty independent of one another
    and since they might take more than one row changing one of these blocks separately
    might be tricky. This method defines which lines relate to which block and allows
    making changes to one block and not affect others.
    */
    let newKeyboard = [];
    if (blockToChange === 'decision'){
        while (!getCallbackDataFromKeyboard(inlineKeyboard).startsWith('COMMENT_')) {
            inlineKeyboard.shift();
        }
        newKeyboard = newKeyboard.concat(newBlock);
    } else if (blockToChange === 'comment') {
        while (!getCallbackDataFromKeyboard(inlineKeyboard).startsWith('COMMENT_')) {
            newKeyboard.push(inlineKeyboard.shift());
        }
        while (getCallbackDataFromKeyboard(inlineKeyboard).startsWith('COMMENT_')) {
            inlineKeyboard.shift();
        }
        newKeyboard = newKeyboard.concat(newBlock);
    } else {
        console.error(blockToChange + ' inline keyboard block is unknown');
        newKeyboard = inlineKeyboard;
    }
    newKeyboard = newKeyboard.concat(inlineKeyboard)
    return newKeyboard;
}


module.exports = {
    getSubscriptionBtn,
    notifyUsers,
    sendFakes,
    getUserName,
    closeRequestByTimeout,
    sendFakesStatus,
    involveModerator,
    getDomainWithoutSubdomain,
    newFacebookSource,
    newTwitterSource,
    newYoutubeSource,
    getLabeledSource,
    changeInlineKeyboard,
}
