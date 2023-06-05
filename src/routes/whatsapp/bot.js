var express = require("express");
var router = express.Router();
var request = require('request');
const mongoose = require('mongoose');
const Request = mongoose.model('Request');
const { getText } = require("../bot/localisation");
require('dotenv').config();
const {safeErrorLog} = require("../bot/utils");
const { messageId } = require("../bot/bot");
const { statusesKeyboard } = require("../keyboard");

const GRAPH_V = 'v16.0';

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
        return res.send('ok');
    } 
    const messageData = req.body.entry[0].changes[0].value.messages[0];
    
    if (messageData.text || messageData.image) {
        await onMessage(messageData);
    } else {
        await onUnsupportedContent(messageData);
        console.log(messageData);
    }

    return res.send('ok')
});

async function onMessage(messageData) {
    console.log('NEW REQ WHATSAPP');

    var text, media;
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
                console.log(imageObj.url);
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
    await sendTextMessage(from, 'I do not support this type of content');
}

async function createNewRequest(messageData, text, imageURL) {
    const from = messageData.from;
    const requestId = new mongoose.Types.ObjectId();
    const reqsCount = await Request.countDocuments({});
    var request = new Request({
        _id: requestId,
        text: text,
        viberReq: true, 
        viberRequester: from, 
        viberMediaUrl: imageURL,
        requestId: reqsCount + 1,
        createdAt: new Date(),
        lastUpdate: new Date()
    });
    var msgText = '';
    if(text) msgText += text + '\n\n';
    //Send to moderation
    const moderatorsChanel = process.env.TGMAINCHAT;
    const options = {
        parse_mode: "HTML"
    };
    const sentMsg = await messageId(moderatorsChanel, msgText, false, options);
    
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
            await sendTextMessage(from, text);
        } catch (e) { safeErrorLog(e) }
    });
}

async function sendTextMessage(recipient, text) {
    var options = {
      'method': 'POST',
      'url': 'https://graph.facebook.com/'+ GRAPH_V +'/' + process.env.WHATSAPP_PHONE_ID + '/messages',
      'headers': {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.WHATSAPP_BEARER
      },
      body: JSON.stringify({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": "text",
        "text": {
          "preview_url": false,
          "body": text
        }
      })
    
    };
    request(options, function (error, response) {
      if (error) throw new Error(error);
    });
}

async function getImageObj(id) {

    return new Promise(function (resolve, reject) {
        var options = {
            'method': 'GET',
            'url': 'https://graph.facebook.com/'+ GRAPH_V +'/' + id,
            'headers': {
                'Authorization': 'Bearer ' + process.env.WHATSAPP_BEARER
            }
          };
        request(options, function (error, res, body) {
            if (!error && res.statusCode === 200) {
                resolve(body);
            } else {
                reject(error);
            }
        });
    });
      
}

async function getImageUrl(url) {

    return new Promise(function (resolve, reject) {
        var options = {
            'method': 'GET',
            'url': url,
            'headers': {
                'Authorization': 'Bearer ' + process.env.WHATSAPP_BEARER
            }
        };
        request(options, function (error, res, body) {
            if (!error && res.statusCode === 200) {
                console.log(body);
                resolve(body);
            } else {
                reject(error);
            }
        });
    });
    
}

module.exports = router