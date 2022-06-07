const mongoose = require("mongoose");
const TelegramUser = mongoose.model('TelegramUser');

async function checkUserStatus(userId) {
    const user = await TelegramUser.findOne({telegramID: userId});
    return user.status
}

module.exports = {
    checkUserStatus
}
