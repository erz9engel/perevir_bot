const { MessengerClient } = require('messaging-api-messenger');
const mongoose = require('mongoose');
const User = mongoose.model('MessengerUser');

const client = new MessengerClient({
    accessToken: process.env.MESSENGER_TOKEN
});

async function sendTextMessageMessenger(sender_id, text) {
    return await client.sendText(sender_id, text, { messaging_type: "RESPONSE"});
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

module.exports = {
    sendTextMessageMessenger,
    registerUser
};
