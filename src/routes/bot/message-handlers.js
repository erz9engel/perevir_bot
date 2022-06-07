const mongoose = require('mongoose');
const admins = String(process.env.ADMINS).split(',');

const Request = mongoose.model('Request');
const Image = mongoose.model('Image');
const Video = mongoose.model('Video');
const TelegramUser = mongoose.model('TelegramUser');
const Data = mongoose.model('Data');
const SourceTelegram = mongoose.model('SourceTelegram');
const SourceDomain = mongoose.model('SourceDomain');
const Comment = mongoose.model('Comment');

const {
    CheckContentText,
    SubscribtionText,
    ChangeLanguage,
    NoCurrentFakes,
    UnsupportedContentText,
    SetFakesRequestText,
    RequestTimeout
} = require('./contstants');
const { getText } = require('./localisation');
const {
    getSubscriptionBtn,
    closeRequestByTimeout,
    getDomainWithoutSubdomain,
    newFacebookSource,
    newTwitterSource,
    newYoutubeSource,
    getLabeledSource,
    safeErrorLog,
    getLanguage
} = require("./utils");
const {logger} = require("../config/logging");

const onStart = async (msg, bot) => {

    const replyOptions = await getReplyOptions('ua');

    try {
        await getText('welcome', 'ua', async function(err, text){
            if (err) return safeErrorLog(err);
            await bot.sendMessage(msg.chat.id, text, replyOptions);
        });
    } catch (e) { safeErrorLog(e) }
    //Check if user registered
    let newUser = new TelegramUser({
        _id: new mongoose.Types.ObjectId(),
        telegramID: msg.chat.id,
        createdAt: new Date()
    });
    await newUser.save().then(() => {}).catch((error) => {
        logger.error("MongoErr: " + error.code);
    });
}

const getReplyOptions = async (lang) => {

    var keyboard = [
        [{ text: CheckContentText[`${lang}`] }],
        [{ text: SubscribtionText[`${lang}`] }],
        [{ text: ChangeLanguage[`${lang}`] }]
    ];
    if (lang == 'en') keyboard.splice(1,1)

    return {
        reply_markup: {
            resize_keyboard: true,
            one_time_keyboard: false,
            keyboard: keyboard
        }
    };
}

const onCheckContent = async (msg, bot) => {
    const {language} = await getLanguage(msg.chat.id);
    try {
        await getText('check_content', language, async function(err, text){
            if (err) return safeErrorLog(err);
            await bot.sendMessage(msg.chat.id, text);
        });
    } catch (e) { safeErrorLog(e) }
}

const onSubscription = async (msg, bot) => {
    const user = await TelegramUser.findOne({telegramID: msg.chat.id});
    if (!user) return logger.warn("User not found 1.1")
    const inline_keyboard = getSubscriptionBtn(user.subscribed, user._id);
    var options = {
        reply_markup: JSON.stringify({
            inline_keyboard
        })
    };
    const fakeNews = await Data.findOne({name: 'fakeNews'});
    if (!fakeNews) { 
        try {
            return await bot.sendMessage(message.chat.id, NoCurrentFakes);
        } catch (e) { return safeErrorLog(e) }
    }
    const message_id = fakeNews.value.split('_')[0];
    const chat_id = fakeNews.value.split('_')[1];
    try {
        await bot.copyMessage(msg.chat.id, chat_id, message_id, options);
    } catch (e) { safeErrorLog(e) }
}

const onChangeLanguage = async (msg, bot) => {
    const user = await TelegramUser.findOne({telegramID: msg.chat.id});
    if (!user) return logger.warn("User not found 1.1");

    var lang = user.language;
    if (!lang) return logger.warn("User has no language");

    if (lang == 'en') lang = 'ua';
    else if (lang == 'ua') lang = 'en';
    
    await TelegramUser.findByIdAndUpdate(user._id, {language: lang});
    const replyOptions = await getReplyOptions(lang);
    
    try {
        await getText('change_lang', lang, async function(err, text){
            if (err) return safeErrorLog(err);
            await bot.sendMessage(msg.chat.id, text, replyOptions);
        });
    } catch (e) { safeErrorLog(e) }

}

const onSetFakesRequest = async (msg, bot) => {
    
    if (admins.includes(String(msg.from.id))) {
        var options = {
            reply_markup: JSON.stringify({
                force_reply: true
            })
        };
        try {
            await bot.sendMessage(msg.chat.id, SetFakesRequestText, options);
        } catch (e) { safeErrorLog(e) }
    } else {logger.info('This action is not allowed for non-admin users')}
}

const onSetSource = async (msg, bot, fake) => {
    
    if (admins.includes(String(msg.from.id))) {
        const text = msg.text;
        const source = text.split(' ')[1];
        const description = text.split(' ').slice(2).join(' ');
        
        if (!source || source.length < 5) {
            try {
                return await bot.sendMessage(msg.chat.id, 'Введені дані некоректні');
            } catch (e) { safeErrorLog(e) }
        }
        //Check if telegram channel
        if (source.startsWith('https://t.me/')) {
            const username = '@' + source.split('https://t.me/')[1];
            var chatInfo;
            try {
                chatInfo = await bot.getChat(username);
            } catch (i) {
                try {
                    return await bot.sendMessage(msg.chat.id, "Такого ресурсу не знайдено");
                } catch (e) { safeErrorLog(e) }
            }
            var newSourceTelegram = new SourceTelegram({
                _id: new mongoose.Types.ObjectId(),
                telegramId: chatInfo.id,
                telegramUsername: chatInfo.username,
                fake: fake,
                description: description,
                createdAt: new Date()
            });
            await newSourceTelegram.save().then(async () => {
                try {
                    await bot.sendMessage(msg.chat.id, "Чат @" + chatInfo.username + " успішно додано. Опис:\n" + description);
                } catch (e) { safeErrorLog(e) }
            }).catch(async () => {
                await SourceTelegram.findOneAndUpdate({telegramId: chatInfo.id}, {fake: fake, description: description});
                try {
                    await bot.sendMessage(msg.chat.id, "Інформацію про чат оновлено");
                } catch (e) { safeErrorLog(e) }
            });
            
        } else {
            var hostname, username, params, url, host;
            try {
                url = new URL(source);
                host = getDomainWithoutSubdomain(url.hostname);
            } catch (e) {
                safeErrorLog(e)
                try {
                    await bot.sendMessage(msg.chat.id, 'Некоректний URL'); 
                    return false
                } catch (e) { safeErrorLog(e) }
            }

            if (host == 'facebook.com') params = await newFacebookSource(url);
            else if (host == 'twitter.com') params = await newTwitterSource(url);
            else if (host == 'youtube.com') params = await newYoutubeSource(url);
            else hostname = host;

            if (params) {
                hostname = params.hostname;
                username = params.username;
            }
            if (!hostname) {
                try {
                    await bot.sendMessage(msg.chat.id, 'На жаль такий формат поки не підтримується.'); 
                    return false
                } catch (e) { safeErrorLog(e) }
            }
            const domain = username ? hostname + '/' + username : hostname;
            var newSourceDomain = new SourceDomain({
                _id: new mongoose.Types.ObjectId(),
                domain: domain,
                hostname: hostname,
                username: username,
                fake: fake,
                description: description,
                createdAt: new Date()
            });
            await newSourceDomain.save().then(async () => {
                if (!username) await bot.sendMessage(msg.chat.id, "Ресурс " + hostname + " успішно додано. Опис:\n" + description);
                else bot.sendMessage(msg.chat.id, "Профіль " + username + " на ресурсі " + hostname + " успішно додано. Опис:\n" + description);
            }).catch(async () => {
                await SourceDomain.findOneAndUpdate({domain: domain}, {fake: fake, hostname: hostname, username: username, description: description});
                await bot.sendMessage(msg.chat.id, "Інформацію про ресурс оновлено");
            });

        }
    } else {logger.info('This action is not allowed for non-admin users')}
}

const onSetFakes = async (msg, bot) => {

    if (admins.includes(String(msg.from.id))) {
        const fakeNews = msg.message_id + '_' + msg.chat.id;
        Data.findOneAndUpdate({name: 'fakeNews'}, {value: fakeNews }, function(){});
        try {
            await bot.sendMessage(msg.chat.id, 'Зміни збережено');
            await bot.copyMessage(msg.chat.id, msg.chat.id, msg.message_id);
        } catch (e) { safeErrorLog(e) }
    } else {logger.info('This action is not allowed for non-admin users')}
}

const onSendFakes = async (msg, bot) => {
    if (admins.includes(String(msg.from.id))) {
        var inline_keyboard = [[{ text: 'Так', callback_data: 'SENDFAKES_1' }, { text: 'Ні', callback_data: 'SENDFAKES_0' }]];
        var options = {
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        };
        try {
            await bot.sendMessage(msg.chat.id, 'Надіслати актуальні фейки користувачам?', options);
        } catch (e) { safeErrorLog(e) }
    } else {logger.info('This action is not allowed for non-admin users')}
}

const onRequestStatus = async (msg, bot, status) => {
    if (admins.includes(String(msg.from.id))) {
        await Data.findOneAndUpdate({name: 'requestStatus'}, {value: status});
        const confirmMsg = status ? "Прийом запитів увімкнено" : "Прийом запитів вимкнено"
        try {
            await bot.sendMessage(msg.chat.id, confirmMsg);
        } catch (e) { safeErrorLog(e) }
    } else {logger.info('This action is not allowed for non-admin users')}
}

const onReplyWithComment = async (msg, bot) => {
    //Process moderator's comment
    const request_id = msg.reply_to_message.text.split('_')[1];
    const commentMsgId = msg.message_id;
    const request = await Request.findByIdAndUpdate(request_id, {commentMsgId: commentMsgId, commentChatId: msg.chat.id });
    await informRequestersWithComment(request, msg.chat.id, commentMsgId, bot);
}

const statusesKeyboard = async (requestId) => {

    return [
        [
            { text: '⛔ Фейк', callback_data: 'FS_-1_' + requestId },
            { text: '🟢 Правда', callback_data: 'FS_1_' + requestId }
        ],
        [
            { text: '🟠 Напівправда', callback_data: 'FS_-5_' + requestId },
            { text: '🔵 Немає доказів', callback_data: 'FS_-4_' + requestId },
        ],
        [
            { text: '🟡 Відмова', callback_data: 'FS_-2_' + requestId },
            { text: '⁉️ Ескалація', callback_data: 'ESCALATE_' + requestId },
        ],
        [   
            { text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }
        ]
    ];

};

const onCheckRequest = async (msg, bot) => {
    logger.debug(msg);
    const requestStatus = await checkRequestStatus(msg, bot);
    if (!requestStatus) return
    //Check any input message
    const requestId = new mongoose.Types.ObjectId();
    var mediaId, newImage, newVideo, notified = false;
    const {language, id} = await getLanguage(msg.chat.id);
    var request = new Request({
        _id: requestId,
        requesterTG: msg.chat.id,
        requesterId: id,
        requesterMsgID: msg.message_id,
        requesterUsername: msg.from.username,
        createdAt: new Date(),
        lastUpdate: new Date()
    });

    if (msg.forward_from_chat) { //Check if message has forwarded data (chat)
        request.telegramForwardedChat = msg.forward_from_chat.id;
        request.telegramForwardedMsg = msg.forward_from_message_id;

        const bannedChat = await SourceTelegram.findOneAndUpdate({ telegramId: request.telegramForwardedChat }, { $inc: { requestsAmount: 1 }});

        const foundRequest = await Request.findOne({$and: [{telegramForwardedChat: request.telegramForwardedChat}, {telegramForwardedMsg: request.telegramForwardedMsg} ]}, '_id fakeStatus commentChatId commentMsgId');
        if (foundRequest) {
            if (foundRequest.fakeStatus === 0) return addToWaitlist(msg, foundRequest, bot);
            return reportStatus(msg, foundRequest, bot, foundRequest);
        } else if (bannedChat) {
            const sourceText = bannedChat.fake ? 'black_source' : 'white_source';
            request.fakeStatus = bannedChat.fake ? -3 : 2;
            try {
                const description = bannedChat.description ? bannedChat.description : '';
                await getText(sourceText, language, async function(err, text){
                    if (err) return safeErrorLog(err);
                    if (language == 'ua') await bot.sendMessage(msg.chat.id, text + '\n\n' + description);
                    else await bot.sendMessage(msg.chat.id, text);
                });
                notified = true;           
            } catch (e) {safeErrorLog(e)}

        }
        //If block redirect msgs
        //else { return unsupportedContent(msg, bot); }  
    } 

    if (msg.photo) {
        //Check if message has photo data
        mediaId = new mongoose.Types.ObjectId();
        var image = msg.photo[msg.photo.length - 1]; //Let's take the highest possible resolution
        const imageFile = await bot.getFile(image.file_id);
        //const fileUrl = 'https://api.telegram.org/file/bot' + token + '/' + imageFile.file_path;

        newImage = new Image({
            _id: mediaId,
            telegramFileId: image.file_id,
            telegramUniqueFileId: image.file_unique_id,
            telegramFilePath: imageFile.file_path,
            fileSize: image.file_size,
            width: image.width,
            height: image.height,
            request: requestId,
            createdAt: new Date()
        });
        request.image = mediaId;

    } else if (msg.video) { //Check if message has video data
        mediaId = new mongoose.Types.ObjectId();
        const video = msg.video;
        newVideo = new Video({
            _id: mediaId,
            telegramFileId: video.file_id,
            telegramUniqueFileId: video.file_unique_id,
            fileSize: video.file_size,
            width: video.width,
            height: video.height,
            duration: video.duration,
            request: requestId,
            createdAt: new Date()
        });
        request.video = mediaId;

    } 

    if (msg.text) { //Get text data
        const labeledSource = await getLabeledSource(msg.text);
        const foundText = await Request.findOne({text: msg.text}, '_id fakeStatus commentChatId commentMsgId');
        if (foundText) {
            if (foundText.fakeStatus === 0) return addToWaitlist(msg, foundText, bot);
            return reportStatus(msg, foundText, bot, labeledSource);
            
        } else if (labeledSource) {
            const sourceText = labeledSource.fake ? 'black_source' : 'white_source';
            request.fakeStatus = labeledSource.fake ? -3 : 2;
            try {
                const description = labeledSource.description ? labeledSource.description : '';
                await getText(sourceText, language, async function(err, text){
                    if (err) return safeErrorLog(err);
                    if (language == 'ua') await bot.sendMessage(msg.chat.id, text + '\n\n' + description);
                    else await bot.sendMessage(msg.chat.id, text);
                });
                notified = true;
            } catch (e) {safeErrorLog(e)}
        } 

        request.text = msg.text;
    } else if (msg.caption) {
        request.text = msg.caption;
    }
    
    //Send message to moderation
    var moderatorsChanel;
    if (language == 'en') moderatorsChanel = process.env.TGENGLISHCHAT;
    else moderatorsChanel = process.env.TGMAINCHAT;

    const sentMsg = await bot.forwardMessage(moderatorsChanel, msg.chat.id, msg.message_id);
    let inline_keyboard;
    if (!notified) {
    
        inline_keyboard = await statusesKeyboard(requestId);
        var options = {
            reply_to_message_id: sentMsg.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        };
        const sentActionMsg = await bot.sendMessage(moderatorsChanel, '#pending', options);
        request.moderatorMsgID = sentMsg.message_id;
        request.moderatorActionMsgID = sentActionMsg.message_id;
        //Inform user
        var informOptions = {
            disable_web_page_preview: true
        };
        await getText('new_requests', language, async function(err, text){
            if (err) return safeErrorLog(err);
            await bot.sendMessage(msg.chat.id, text, informOptions);
        });
    
    } else {

        inline_keyboard = [[{ text: '◀️ Змінити статус', callback_data: 'CS_' + requestId }]];
        inline_keyboard.push([{ text: '✉️ Залишити коментар', callback_data: 'COMMENT_' + requestId }]);
        var options = {
            reply_to_message_id: sentMsg.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        };
        var status = "#autoDecline"
        if (request.fakeStatus == 2) status = "#autoConfirm";

        const sentActionMsg = await bot.sendMessage(moderatorsChanel, status ,options);
        request.moderatorMsgID = sentMsg.message_id;
        request.moderatorActionMsgID = sentActionMsg.message_id;

    }

    //Save new request in DB
    if (newImage) await newImage.save();
    else if (newVideo) await newVideo.save();
    await request.save();

}

var mediaGroups = [];
const onCheckGroupRequest = async (msg, bot) => {
    logger.debug(msg);

    var mediaFileId, mediaType;
    if (msg.photo) {
        const image = msg.photo[msg.photo.length - 1]; //Let's take the highest possible resolution
        mediaFileId = image.file_id;
        mediaType = 'photo';

    } else if (msg.video) {
        const video = msg.video;
        mediaFileId = video.file_id;
        mediaType = 'video';
    }

    //Handle group of media files
    const index = mediaGroups.findIndex(group => {
        return group.groupId === msg.media_group_id;
    });
    if (index < 0) {
        if (msg.caption) mediaGroups.push({ groupId: msg.media_group_id, text: msg.caption, mediaFiles: [{mediaFileId: mediaFileId, mediaType: mediaType}], sent: false});
        else mediaGroups.push({ groupId: msg.media_group_id, mediaFiles: [{mediaFileId: mediaFileId, mediaType: mediaType}], sent: false});
    } else {
        mediaGroups[index].mediaFiles.push({mediaFileId: mediaFileId, mediaType: mediaType});
        if (msg.caption) mediaGroups[index].text += msg.caption;
    }
    //Send interactive action
    try {
        bot.sendChatAction(msg.chat.id, 'typing');
    } catch (e) { safeErrorLog(e) }

    await sleep(2000).then(async () => { 
        const index = mediaGroups.findIndex(group => {
            return group.groupId === msg.media_group_id;
        });
        const {language, id} = await getLanguage(msg.chat.id);
        if (!mediaGroups[index].sent) {
            mediaGroups[index].sent = true; 
            const requestStatus = await checkRequestStatus(msg, bot);
            if (!requestStatus) return
            var mediaFiles = [];
            for (var i in mediaGroups[index].mediaFiles) {
                const mediaFile = mediaGroups[index].mediaFiles[i];
                mediaFiles.push({type: mediaFile.mediaType, media: mediaFile.mediaFileId})
            }
            var sentMsg, moderatorsChanel;
            if (language == 'en') moderatorsChanel = process.env.TGENGLISHCHAT;
            else moderatorsChanel = process.env.TGMAINCHAT;


            if (mediaGroups[index].text) {
                const textpart = await bot.sendMessage(moderatorsChanel, mediaGroups[index].text);
                const options = {
                    reply_to_message_id: textpart.message_id
                };
                sentMsg = await bot.sendMediaGroup(moderatorsChanel, mediaFiles, options);
            } else {
                sentMsg = await bot.sendMediaGroup(moderatorsChanel, mediaFiles);
            }
            const requestId = new mongoose.Types.ObjectId();

            //new
            var inline_keyboard = await statusesKeyboard(requestId);
            var options = {
                reply_to_message_id: sentMsg.message_id,
                reply_markup: JSON.stringify({
                    inline_keyboard
                })
            };
            const sentActionMsg = await bot.sendMessage(moderatorsChanel, '#pending', options);
            var request = new Request({
                _id: requestId,
                requesterTG: msg.chat.id,
                requesterId: id,
                requesterMsgID: msg.message_id,
                requesterUsername: msg.from.username,
                createdAt: new Date(),
                lastUpdate: new Date(),
                text: msg.caption,
                moderatorMsgID: sentMsg[0].message_id,
                moderatorActionMsgID: sentActionMsg.message_id
            });
            await request.save();
            //Inform user
            var options = {
                disable_web_page_preview: true
            };
            await getText('new_requests', language, async function(err, text){
                if (err) return safeErrorLog(err);
                await bot.sendMessage(msg.chat.id, text, options);
            });
            
        } else return
    });
}

const onUnsupportedContent = async (msg, bot) => {
    const {language} = await getLanguage(msg.chat.id);
    await getText('unsupported_request', language, async function(err, text){
        if (err) return safeErrorLog(err);
        try {
            await bot.sendMessage(msg.chat.id, text);
        } catch (e) { safeErrorLog(e) }
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function unsupportedContent(msg, bot) {
    try {
        await bot.sendMessage(msg.chat.id, UnsupportedContentText);
    } catch (e) { safeErrorLog(e) }
}

async function checkRequestStatus(msg, bot) {
    const {value} = await Data.findOne({name: 'requestStatus'});
    var requestStatus = false;
    if (value === 'true') requestStatus = true;
    else {
        const {language} = await getLanguage(msg.chat.id);
        try {
            await getText('stopped_requests', language, async function(err, text){
                if (err) return safeErrorLog(err);
                bot.sendMessage(msg.chat.id, text);  
            });
        } catch (e) { safeErrorLog(e) }
    }

    return requestStatus;
}

async function addToWaitlist(msg, foundRequest, bot ) {
    const {language, id} = await getLanguage(msg.chat.id);
    try {
        await getText('waitlist', language, async function(err, text){
            if (err) return safeErrorLog(err);
            bot.sendMessage(msg.chat.id, text);  
        });
    } catch (e){ safeErrorLog(e) }

    await Request.findByIdAndUpdate(foundRequest._id, {$push: { "otherUsetsTG": {requesterTG: msg.chat.id, requesterId: id, requesterMsgID: msg.message_id }}});
}

async function reportStatus(msg, foundRequest, bot, bannedChat) {

    var description = '', textArg = '';
    if (bannedChat) {
        textArg = bannedChat.fake ? 'black_source' : 'white_source';
        description = bannedChat.description ? bannedChat.description : '';
    } else {
        if (foundRequest.fakeStatus === 1) textArg = "true_status"
        else if (foundRequest.fakeStatus === -1) textArg = "fake_status"
        else if (foundRequest.fakeStatus === -2) textArg = "reject_status"
    }

    try {
        const {language} = await getLanguage(msg.chat.id);
        await getText(textArg, language, async function(err, text){
            if (err) return safeErrorLog(err);
            if (foundRequest.fakeStatus === -3 || foundRequest.fakeStatus === 2) await bot.sendMessage(msg.chat.id, text + '\n\n' + description);
            else await bot.sendMessage(msg.chat.id, text);
        });
        
    } catch (e){ safeErrorLog(e) }
    try {
        if (foundRequest.commentMsgId) await bot.copyMessage(msg.chat.id, foundRequest.commentChatId, foundRequest.commentMsgId);
    } catch (e){ safeErrorLog(e) }
}

async function informRequestersWithComment(request, chatId, commentMsgId, bot) {
    if (!request) return
    var options = {
        reply_to_message_id: request.requesterMsgID
    };

    try {
        await bot.copyMessage(request.requesterTG, chatId , commentMsgId, options);
    } catch (e){ safeErrorLog(e) }

    for (var i in request.otherUsetsTG) {
        const optionsR = {
            reply_to_message_id: request.otherUsetsTG[i].requesterMsgID
        };
        try {
            await bot.copyMessage(request.otherUsetsTG[i].requesterTG, chatId , commentMsgId, optionsR);
        } catch (e){ safeErrorLog(e) }
    }
    //TASK: Need to handle comment sending for users who joined waiting after comment was send & before fakeStatus changed
}

const onCloseOldRequests = async (msg, bot) => {
    if (admins.includes(String(msg.from.id))) {
        var timeoutDate = new Date();
        timeoutDate.setDate(timeoutDate.getDate() - RequestTimeout);
        var oldRequests = await Request.find({"fakeStatus": 0, "lastUpdate": { $lt: timeoutDate }});
        for (var index = 0; index < oldRequests.length; index++) {
            await closeRequestByTimeout(oldRequests[index], bot);
            // Not sure about this, but in order not to be accused in spaming users added 1 second pause
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        try {
            await bot.sendMessage(msg.chat.id, 'Закрито ' + index +
                ' повідомлень, що створені до ' + timeoutDate.toLocaleDateString('uk-UA') +
                ' року та досі були в статусі #pending');
        } catch (e) { safeErrorLog(e); }

    } else {logger.info('This action is not allowed for non-admin users')}
}

async function saveCommentToDB(message, bot) {
    if (!message.text) return
    let tag = message.text.split("\n", 1)[0].split(' ')[0];
    let comment = await Comment.findOne({"tag": tag}, '');
    let text = message.text.slice(tag.length).trim();

    if (comment) {
        await bot.sendMessage(message.chat.id, 'Тег ' + tag + ' вже існує в базі, виберіть інший тег');
    } else {
        if (tag.startsWith('#')) {
            if (text.length < 10) {
                return await bot.sendMessage(message.chat.id, 'Коментар відсутній або надто короткий (<10)');
            } 
            
            let comment = new Comment({
                _id: new mongoose.Types.ObjectId(),
                tag: tag,
                comment: text,
                createdAt: new Date()
            });
            await comment.save()
            await bot.sendMessage(message.chat.id, 'Збережено до бази: ' + tag);
        }
    }
}

async function confirmComment(message, bot) {
    if (!message.reply_to_message) {
        return await bot.sendMessage(message.chat.id, 'Не зрозуміло до якого запиту цей коментар.\nНаправте комент через меню "Відповісти"');
    }

    let requestId = message.reply_to_message.text.split("_")[1];
    var request = await Request.findById(requestId, '');
    if (!request) return await bot.sendMessage(message.chat.id, 'Коментар до нерозпізнаного запиту');
    
    let comment = await Comment.findOne({"tag": message.text});
    let inline_keyboard = [[
        { text: '✅️ Відправити', callback_data: 'CONFIRM_' + requestId},
        { text: '❌️ Скасувати', callback_data: 'CONFIRM_'}
    ]];
    let options = {
        reply_to_message_id: message.message_id,
        reply_markup: JSON.stringify({inline_keyboard})
    };
    try {
        await bot.sendMessage(
            message.chat.id,
            comment.comment,
            options
        );
    } catch (e) {
        logger.error(e);
    }
}

module.exports = {
    onStart,
    onCheckContent,
    onSubscription,
    onChangeLanguage,
    onSetFakesRequest,
    onSetSource,
    onSetFakes,
    onSendFakes,
    onRequestStatus,
    onReplyWithComment,
    onCheckGroupRequest,
    onCheckRequest,
    onUnsupportedContent,
    onCloseOldRequests,
    saveCommentToDB,
    confirmComment,
    informRequestersWithComment
}
