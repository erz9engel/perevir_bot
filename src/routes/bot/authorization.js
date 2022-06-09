const mongoose = require("mongoose");
const TelegramUser = mongoose.model('TelegramUser');

async function checkUserStatus(userId) {
    const user = await TelegramUser.findOne({telegramID: userId});
    if (!user) return null
    return user.status
}

module.exports = {
    checkUserStatus
}
