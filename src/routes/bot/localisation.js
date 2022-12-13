var fs = require('fs');
const {safeErrorLog} = require("./utils");

async function changeRequestLanguage(request, newLanguage, bot) {
    let fromLanguageChat = getLanguageTGChat(request.language)
    let toLanguageChat = getLanguageTGChat(newLanguage)
    if (fromLanguageChat === toLanguageChat) return;
    let moderatorMsgId, moderatorActionMsgId;
    try {
        moderatorMsgId = await bot.copyMessage(toLanguageChat, fromLanguageChat, request.moderatorMsgID)
        moderatorActionMsgId = await bot.copyMessage(toLanguageChat, fromLanguageChat, request.moderatorActionMsgID)
        await bot.deleteMessage(fromLanguageChat, request.moderatorMsgID)
        await bot.deleteMessage(fromLanguageChat, request.moderatorActionMsgID)
    } catch (e) {
        safeErrorLog(e)
    }
    await Request.updateOne(
        request,
        {
            language: newLanguage,
            moderatorActionMsgID: moderatorActionMsgId,
            moderatorMsgID: moderatorMsgId,
        },
    );
}

function getLanguageTGChat(language) {
    if (language === 'en') return process.env.TGENGLISHCHAT;
    else return process.env.TGMAINCHAT;
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