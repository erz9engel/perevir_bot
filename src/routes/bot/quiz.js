const mongoose = require('mongoose');
const TelegramUser = mongoose.model('TelegramUser');

const {
    safeErrorLog
} = require("./utils");

const onGetQuiz = async (msg, bot) => {
    
}

module.exports = {
    onGetQuiz
}
