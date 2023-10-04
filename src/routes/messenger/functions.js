const { MessengerClient } = require('messaging-api-messenger');
const mongoose = require('mongoose');
const { getText } = require('../bot/localisation');
const User = mongoose.model('MessengerUser');

const client = new MessengerClient({
    accessToken: process.env.MESSENGER_TOKEN
});

async function sendTextMessageMessenger(sender_id, text) {
    return await client.sendText(sender_id, text, { messaging_type: "RESPONSE"});
    //return await client.sendAttachment(sender_id, { type: 'image', payload: { url: 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png', }, });
}

async function registerUser (id) {
    User.findOne({ 'messengerId': id }, function (err, user) {
        if (user == null || user == undefined) {
            const newUser = new User({
                _id: new mongoose.Types.ObjectId(),
                messengerId: id,
                createdAt: new Date()
            });
            newUser.save()
                .then(function () {
                    return
                });
        } else return
    });
}

async function reportStatusMessenger(foundRequest, sender, bannedChat) {
    console.log('reportStatusMessenger')
    var textArg = '';
    if (bannedChat) {
        textArg = bannedChat.fake ? 'black_source' : 'white_source';
    } else {
        if (foundRequest.fakeStatus === 1) textArg = "true_status"
        else if (foundRequest.fakeStatus === -1) textArg = "fake_status"
        else if (foundRequest.fakeStatus === -2) textArg = "reject_status"
    }

    try {
        await getText(textArg, null, async function(err, text){
            if (err) return console.log(err);
            try {
                var answer = "🇺🇦 UA: (ENG below)\n" + text['ua'] + "\n\n🌍 ENG:\n" + text['en'];
                await sendTextMessageMessenger(sender.id, answer);
            } catch (e) { console.log(e) }
        });
        
    } catch (e){ console.log(e) }
}

async function reportAutoStatusMessenger(labeledSource, sender) {
    const sourceText = labeledSource.fake ? 'black_source' : 'white_source';
    try {
        await getText(sourceText, null, async function(err, text){
            if (err) return safeErrorLog(err);
            try {
                var answer = "🇺🇦 UA: (ENG below)\n" + text['ua'] + "\n\n🌍 ENG:\n" + text['en'];
                await sendTextMessageMessenger(sender.id, answer);
            } catch (e) { safeErrorLog(e) }
        });
    } catch (e) {safeErrorLog(e)}
}

module.exports = {
    sendTextMessageMessenger,
    registerUser,
    reportStatusMessenger,
    reportAutoStatusMessenger
};
