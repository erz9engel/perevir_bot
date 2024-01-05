var express = require("express");
var router = express.Router();
require('dotenv').config();
const mongoose = require('mongoose');
const Request = mongoose.model('Request');
const { getText } = require('../bot/localisation');
const { safeErrorLog, getLabeledSource } = require('../bot/utils');
const { messageId, sendMediaGroup } = require('../bot/bot');
const { statusesKeyboard } = require('../keyboard');
const { sendTextMessageMessenger, registerUser, reportStatusMessenger, reportAutoStatusMessenger } = require('./functions');

//Messenger
router.get('/messenger', async (req, res) => {
    //webhook setup
    if (req.query['hub.verify_token'] == process.env.WHATSAPP_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    } else {
        res.sendStatus(400);
    }
});

router.post('/messenger', async (req, res) => {
    const { body } = req;
    // Handle incoming messages
    if (body.object === 'page') {
        const { messaging } = body.entry[0];

        messaging.forEach((event) => {
            const { sender, message } = event;
            
            registerUser(sender.id);

            if (message.text || ( message.attachments && (message.attachments[0].type == 'image' || message.attachments[0].type == 'video'))) {
                onMessage(event);
            } else {
                onUnsupportedContent(event);
                console.log(message);
            }
        });
    }

    res.sendStatus(200);
});

async function onMessage(event) {

    const { sender, message } = event;
    if (message.text) {

        const labeledSource = await getLabeledSource(message.text);
        const foundText = await Request.findOne({text: message.text}, '_id fakeStatus commentChatId commentMsgId');
        if (foundText && foundText.fakeStatus != 0) {
            return reportStatusMessenger(foundText, sender, labeledSource); //Yes, no waiting list here
        } else if (labeledSource) {
            await reportAutoStatusMessenger(labeledSource, sender);
        }  else {
            await createNewRequest(sender, message.text);
        }

    } else if (message.attachments && (message.attachments[0].type == 'image' || message.attachments[0].type == 'video')) {
        if (message.attachments[0].payload.sticker_id) return console.log('sent sticket in messenger');
        await createNewRequest(sender, null, message.attachments);
    }
}

async function onUnsupportedContent(event) {
    const { sender } = event;

    await getText('unsupported_request', null, async function(err, text){
        if (err) return safeErrorLog(err);
        try {
            var answer = "🇺🇦 UA: (ENG below)\nПоки що ми не знайшли достатньої кількості доказів щодо цієї інформації. Ми нічого не знайшли або не бачили такої інформації у нашій базі перевірених новин.\nФактчекери почали опрацьовувати цей запит, це може зайняти до доби.\n\n📝Переходь до Telegram-боту Перевірки та проходь освітні тести для того, щоб навчитися самостійно боротися з фейками: https://t.me/perevir_bot?start=quiz\n\n🌍 ENG:\nWe didn't find or see anything like that in our database. This request should be processed by journalists within 24 hours/nSupport our work via https://buymeacoffee.com/gwaramedia"
            await sendTextMessageMessenger(sender.id, answer);
        } catch (e) { safeErrorLog(e) }
    });
}

async function createNewRequest(sender, text, attachments) {
    const from = sender.id;
    const requestId = new mongoose.Types.ObjectId();
    const reqsCount = await Request.countDocuments({});
    var request = new Request({
        _id: requestId,
        text: text,
        messengerReq: true, 
        messengerRequester: from, 
        requestId: reqsCount + 1,
        createdAt: new Date(),
        lastUpdate: new Date()
    });
    //Send to moderation
    const moderatorsChanel = process.env.TGMAINCHAT;
    var options = {
        parse_mode: "HTML"
    };
    var sentMsgId, sentActionMsg;
    if (text) {
        try {
            const sentMsg = await messageId(moderatorsChanel, text, false, options);
            sentMsgId = sentMsg.message_id;
        } catch (e) { return safeErrorLog(e) }
    } else {
        var mediaFiles = [];
            for (var i in attachments) {
                const atURL = attachments[i].payload.url;
                var type = "photo";
                if (attachments[i].type == 'video') type = 'video';
                mediaFiles.push({type: type, media: atURL})
            }
        try {
            const sentMsg = await sendMediaGroup(moderatorsChanel, mediaFiles, options); 
            sentMsgId = sentMsg[0].message_id;
        } catch (e) { return safeErrorLog(e) }
    }
    const inline_keyboard = await statusesKeyboard(requestId, true);
    const optionsMod = {
        reply_to_message_id: sentMsgId,
        reply_markup: JSON.stringify({
            inline_keyboard
        })
    };
    try {
        sentActionMsg = await messageId(moderatorsChanel, "№" + request.requestId + '\n#pending | #messenger', false, optionsMod);
    } catch (e) { return safeErrorLog(e) }
    request.moderatorMsgID = sentMsgId;
    request.moderatorActionMsgID = sentActionMsg.message_id;
    request.save();

    //Inform user
    await getText('new_requests', null, async function(err, text){
        if (err) return safeErrorLog(err);
        try {
            var answer = "🇺🇦 UA: (ENG below)\n" + text['ua'] + "\n\n🌍 ENG:\n" + text['en'];
            await sendTextMessageMessenger(sender.id, answer);
        } catch (e) { safeErrorLog(e) }
    });
}

module.exports = router;
