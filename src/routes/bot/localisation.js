var fs = require('fs');
const {safeErrorLog, getUserName} = require("./utils");
const {takeRequestKeyboard} = require("../keyboard");
const mongoose = require("mongoose");
const Request = mongoose.model('Request');

async function changeRequestLanguage(request, newLanguage, bot) {
    let fromLanguageChat = getLanguageTGChat(request.language)
    let toLanguageChat = getLanguageTGChat(newLanguage)
    if (fromLanguageChat === toLanguageChat) return;
    let moderatorMsgId, moderatorActionMsgId;
    try {
        moderatorMsgId = await bot.forwardMessage(toLanguageChat, request.requesterTG, request.requesterMsgID);
    } catch (e) { safeErrorLog(e) }
    let inline_keyboard = await takeRequestKeyboard(request._id);
    let options = {
        reply_to_message_id: moderatorMsgId.message_id,
        reply_markup: JSON.stringify({
            inline_keyboard
        })
    };
    try {
        let initiator = getUserName(moderatorMsgId.forward_from);
        if (initiator.startsWith("@")) {
            initiator = initiator.substring(1)
        }
        moderatorActionMsgId = await bot.sendMessage(
            toLanguageChat,
            '№' + request.requestId + '\nініціатор: ' + initiator + '\n#pending',
            options,
        );
    } catch (e) {safeErrorLog(e)}

    try {
        await bot.deleteMessage(fromLanguageChat, request.moderatorMsgID)
        await bot.deleteMessage(fromLanguageChat, request.moderatorActionMsgID)
    } catch (e) {
        safeErrorLog(e)
    }
    await Request.updateOne(
        request,
        {
            language: newLanguage,
            moderatorActionMsgID: parseInt(moderatorActionMsgId.message_id),
            moderatorMsgID: parseInt(moderatorMsgId.message_id),
        },
    );
}

function getLanguageTGChat(language) {
    let moderatorChat = process.env.TGMAINCHAT;
    if (language === 'en' && process.env.TGENGLISHCHAT) {
        moderatorChat = process.env.TGENGLISHCHAT;
    }
    return moderatorChat;
}

module.exports = {
    getText: async function (name, lang, callback) {
        await fs.readFile('texts.json',
            function(err, texts) {       
                if (err) return callback(err);
                const textsObj = JSON.parse(texts);
                for (var i in textsObj) {
                    if (textsObj[i].name == name){
                        if (lang == null) return callback(null, textsObj[i]);
                        return callback(null, textsObj[i][lang]);
                    } 
                }
            });
    },
    getLanguageTGChat,
    changeRequestLanguage,
}