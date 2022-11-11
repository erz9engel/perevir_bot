const mongoose = require("mongoose");
const TelegramUser = mongoose.model('TelegramUser');

async function checkUserStatus(userId) {
    const user = await TelegramUser.findOne({telegramID: userId});
    if (!user) return null
    return user.status
}

async function incrementBlockedMessagesCount(userId) {
    await TelegramUser.findOneAndUpdate({telegramID: userId}, {$inc: {blockedMessages: 1}});
}

module.exports = {
    checkUserStatus,
    incrementBlockedMessagesCount,
}
