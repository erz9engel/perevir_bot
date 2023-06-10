var express = require("express");
var router = express.Router();
require('dotenv').config();
const mongoose = require('mongoose');
const Request = mongoose.model('Request');
const { sendTextMessage, getImageObj, getImageUrl, registerUser } = require("./functions");
const { getText } = require("../bot/localisation");
const { safeErrorLog } = require("../bot/utils");
const { messageId, sendImage } = require("../bot/bot");
const { statusesKeyboard } = require("../keyboard");

//WhatsApp
router.get('/whatsapp', async (req, res) => {
    //webhook setup
    if (req.query['hub.verify_token'] == process.env.WHATSAPP_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    } else {
        res.sendStatus(400);
    }
});

router.post('/whatsapp', async (req, res) => {
    if (!req.body.entry || !req.body.entry[0] || !req.body.entry[0].changes[0] || !req.body.entry[0].changes[0].value || !req.body.entry[0].changes[0].value.messages || !req.body.entry[0].changes[0].value.messages[0]) {
        return res.sendStatus(200);
    } 
    const messageData = req.body.entry[0].changes[0].value.messages[0];

    await registerUser(messageData.from);
    
    if (messageData.text || messageData.image) {
        await onMessage(messageData);
    } else {
        await onUnsupportedContent(messageData);
        console.log(messageData);
    }

    return res.sendStatus(200);
});

async function onMessage(messageData) {
    console.log('NEW REQ WHATSAPP');

    var text;
    if (messageData.text) {
        text = messageData.text.body;
        await createNewRequest(messageData, text);
    } else if (messageData.image) {
        const imageData = messageData.image;
        if (imageData.caption) text = imageData.caption;
        //Get image obj
        try {
            const dataObj = await getImageObj(messageData.image.id);
            const imageObj = JSON.parse(dataObj);
            //Get image URL
            try {
                const imageURL = await getImageUrl(imageObj.url);
                await createNewRequest(messageData, text, imageURL);
            } catch (error) {
                return console.error(error);
            }
        } catch (error) {
            return console.error(error);
        }
    }
}

async function onUnsupportedContent(messageData) {
    const from = messageData.from;
    const id = messageData.id;

    await getText('unsupported_request', 'en', async function(err, text){
        if (err) return safeErrorLog(err);
        try {
            await sendTextMessage(from, text, id);
        } catch (e) { safeErrorLog(e) }
    });
}

async function createNewRequest(messageData, text, imageURL) {
    const from = messageData.from;
    const id = messageData.id;
    const requestId = new mongoose.Types.ObjectId();
    const reqsCount = await Request.countDocuments({});
    var request = new Request({
        _id: requestId,
        text: text,
        whatsappReq: true, 
        whatsappRequester: from, 
        whatsappMessageId: id,
        requestId: reqsCount + 1,
        createdAt: new Date(),
        lastUpdate: new Date()
    });
    var msgText = '';
    if(text) msgText += text + '\n\n';
    //Send to moderation
    const moderatorsChanel = process.env.TGMAINCHAT;
    var options = {
        parse_mode: "HTML"
    };
    var sentMsg;
    if (!imageURL) {
        sentMsg = await messageId(moderatorsChanel, msgText, false, options);
    } else {
        try {
            if (text) options.caption = text;
            sentMsg = await sendImage(moderatorsChanel, imageURL, options);
        } catch (e) {
            console.log(e);
        }
    }
    const inline_keyboard = await statusesKeyboard(requestId, true);
    const optionsMod = {
        reply_to_message_id: sentMsg.message_id,
        reply_markup: JSON.stringify({
            inline_keyboard
        })
    };
    const sentActionMsg = await messageId(moderatorsChanel, "№" + request.requestId + '\n#pending | #whatsapp', false, optionsMod);
    request.moderatorMsgID = sentMsg.message_id;
    request.moderatorActionMsgID = sentActionMsg.message_id;
    request.save();

    //Inform user
    await getText('new_requests', 'en', async function(err, text){
        if (err) return safeErrorLog(err);
        try {
            await sendTextMessage(from, text, id);
        } catch (e) { safeErrorLog(e) }
    });
}

module.exports = router;
