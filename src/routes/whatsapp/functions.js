var request = require('request');
var axios = require('axios');
const mongoose = require('mongoose');
const { getText } = require('../bot/localisation');
const User = mongoose.model('WhatsappUser');
const GRAPH_V = 'v16.0';

async function sendTextMessage(recipient, text, replyId) {
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
        "context": {
            "message_id": replyId
        },
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
        var config = {
            method: 'get',
            url: url,
            responseType: 'arraybuffer',
            headers: {
                'Authorization': 'Bearer ' + process.env.WHATSAPP_BEARER
            }
          };
          axios(config)
            .then(function (response) {
                resolve(response.data);
            })
            .catch(function (error) {
                reject(error);
            });
    });
    
}

async function registerUser (phone) {
    User.findOne({ 'whatsappId': phone }, function (err, user) {
        if (user == null || user == undefined) {
            const newUser = new User({
                _id: new mongoose.Types.ObjectId(),
                whatsappId: phone,
                createdAt: new Date()
            });
            newUser.save()
                .then(function () {
                    return
                });
        } else {
            return
        }
    });
}

async function reportStatusWhatsapp(foundRequest, messageData, bannedChat) {

    const from = messageData.from;
    const id = messageData.id;

    var textArg = '';
    if (bannedChat) {
        textArg = bannedChat.fake ? 'black_source' : 'white_source';
    } else {
        if (foundRequest.fakeStatus === 1) textArg = "true_status"
        else if (foundRequest.fakeStatus === -1) textArg = "fake_status"
        else if (foundRequest.fakeStatus === -2) textArg = "reject_status"
    }

    try {
        await getText(textArg, 'en', async function(err, text){
            if (err) return console.log(err);
            try {
                await sendTextMessage(from, text, id);
            } catch (e) { console.log(e) }
        });
        
    } catch (e){ console.log(e) }
}

async function reportAutoStatusWhatsapp(labeledSource, messageData) {

    const from = messageData.from;
    const id = messageData.id;

    const sourceText = labeledSource.fake ? 'black_source' : 'white_source';
    try {
        await getText(sourceText, 'en', async function(err, text){
            if (err) return safeErrorLog(err);
            try {
                await sendTextMessage(from, text, id);
            } catch (e) { safeErrorLog(e) }
        });
    } catch (e) {safeErrorLog(e)}
}

module.exports = {
    sendTextMessage,
    getImageObj,
    getImageUrl,
    registerUser,
    reportStatusWhatsapp,
    reportAutoStatusWhatsapp
};
