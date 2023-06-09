const { MessengerClient } = require('messaging-api-messenger');
var express = require("express");
var router = express.Router();
require('dotenv').config();
const mongoose = require('mongoose');
const Request = mongoose.model('Request');
const { getText } = require('../bot/localisation');
const { safeErrorLog } = require('../bot/utils');
const { messageId, sendMediaGroup } = require('../bot/bot');
const { statusesKeyboard } = require('../keyboard');

const client = new MessengerClient({
    accessToken: process.env.MESSENGER_TOKEN
});

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
            const { message } = event;

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
    console.log('NEW REQ MESSENGER');

    const { sender, message } = event;
    if (message.text) {
        await createNewRequest(sender, message.text);
    } else if (message.attachments && (message.attachments[0].type == 'image' || message.attachments[0].type == 'video')) {
        await createNewRequest(sender, null, message.attachments);
    }
}

async function onUnsupportedContent(event) {
    const { sender } = event;

    await getText('unsupported_request', 'en', async function(err, text){
        if (err) return safeErrorLog(err);
        try {
            await client.sendText(sender.id, text, { messaging_type: "RESPONSE"});
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
    var sentMsg, sentActionMsg;
    if (text) {
        try {
            sentMsg = await messageId(moderatorsChanel, text, false, options);
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
            sentMsg = await sendMediaGroup(moderatorsChanel, mediaFiles, options); 
        } catch (e) { return safeErrorLog(e) }
    }
    const inline_keyboard = await statusesKeyboard(requestId, true);
    const optionsMod = {
        reply_to_message_id: sentMsg.message_id,
        reply_markup: JSON.stringify({
            inline_keyboard
        })
    };
    try {
        sentActionMsg = await messageId(moderatorsChanel, "№" + request.requestId + '\n#pending | #messenger', false, optionsMod);
    } catch (e) { return safeErrorLog(e) }
    request.moderatorMsgID = sentMsg.message_id;
    request.moderatorActionMsgID = sentActionMsg.message_id;
    request.save();

    //Inform user
    await getText('new_requests', 'en', async function(err, text){
        if (err) return safeErrorLog(err);
        try {
            await client.sendText(sender.id, text, { messaging_type: "RESPONSE"});
        } catch (e) { safeErrorLog(e) }
    });
}

module.exports = router;
