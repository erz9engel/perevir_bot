const mongoose = require('mongoose');
const fs = require('fs');

const TelegramUser = mongoose.model('TelegramUser');

const {
    safeErrorLog
} = require("./utils");

const onGetQuiz = async (msg, bot) => {
    var inline_keyboard = [[{ text: 'Розпочати', callback_data: 'QUIZ_START' }]];
    var options = {
        reply_markup: JSON.stringify({
            inline_keyboard
        })
    };
    try {
        await bot.sendMessage(msg.chat.id, 'Тест для перевірки медіаграмотності від команди боту Перевірка', options);
    } catch (e) { safeErrorLog(e) }
    
}

const onQuizStartQuery = async (callbackQuery, bot) => {
    const {message} = callbackQuery
    
    try { 
        await bot.deleteMessage(message.chat.id, message.message_id);
        const question = await getQuestion(0);
        
        var inline_keyboard = [], questions = '';
        for (var i in question.answers) {
            const q = question.answers[i];
            const n = parseInt(i) + 1;
            inline_keyboard.push([{text: n, callback_data: 'QUIZ_CHECK_0_' + i}]);
            questions += n + ') ' + q.text + '\n';
        }
        
        var msgText = question.question + '\n\n' + questions;

        var options = {
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        };
        try {
            await bot.sendMessage(message.chat.id, msgText, options);
        } catch (e) { safeErrorLog(e) }
    
        await TelegramUser.findOneAndUpdate({telegramID: message.chat.id}, {quizPoints: 0});
    } catch (e) { safeErrorLog(e); }

}

const onQuizСheckQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    const questionId = parseInt(data.split('_')[2]);
    const nextQuestionId = questionId + 1;
    const answerId = parseInt(data.split('_')[3]);
    
    const question = await getQuestion(questionId);
        
    var inline_keyboard = [];
    for (var i in question.answers) {
        const q = question.answers[i];
        var pre = '';
        if (q.correct == true || q.correct == 'true') pre = '✅ ';
        else if (i == answerId) pre = '❌ ';
        const n = parseInt(i) + 1;
        inline_keyboard.push([{text: pre + n, callback_data: 'QUIZ_NEXT_' + nextQuestionId}]);
    }
    inline_keyboard.push([{text: '➡️ Продовжити', callback_data: 'QUIZ_NEXT_' + nextQuestionId}]);

    try {
        await bot.editMessageReplyMarkup({
            inline_keyboard: inline_keyboard
        }, {
            chat_id: message.chat.id,
            message_id: message.message_id
        });
    } catch (e) { safeErrorLog(e) }

    //Add points
    const points = parseInt(question.answers[answerId].points);
    await TelegramUser.findOneAndUpdate({telegramID: message.chat.id}, {$inc: {quizPoints: points}});
}

const onQuizNextQuery = async (callbackQuery, bot) => {
    const {data, message} = callbackQuery
    const questionId = parseInt(data.split('_')[2]);
    const question = await getQuestion(questionId);

    if (!question) {
        const {quizPoints} = await TelegramUser.findOne({telegramID: message.chat.id});
        const results = await getResults();
        await bot.deleteMessage(message.chat.id, message.message_id);
        var msgText = '';

        for (var j in results) {
            if (results[j].maxPoints >= quizPoints) {
                msgText = results[j].text;
                break;
            }
        }

        try {
            await bot.sendMessage(message.chat.id, msgText);
        } catch (e) { safeErrorLog(e) }

        return console.log("Quiz result - " + quizPoints);
    }
        
    var inline_keyboard = [], questions = '';
    for (var i in question.answers) {
        const q = question.answers[i];
        const n = parseInt(i) + 1;
        inline_keyboard.push([{text: n, callback_data: 'QUIZ_CHECK_' + questionId + '_' + i}]);
        questions += n + ') ' + q.text + '\n';
    }
    
    var msgText = question.question + '\n\n' + questions;

    try {
        await bot.editMessageText(msgText, {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: JSON.stringify({
                inline_keyboard
            })
        });
    } catch (e) { safeErrorLog(e) }
}

async function getQuestion (num) {
    const data = fs.readFileSync("quiz.json", 'utf8');
    const quiz = JSON.parse(data);
    return quiz.questions[num]
}

async function getResults () {
    const data = fs.readFileSync("quiz.json", 'utf8');
    const quiz = JSON.parse(data);
    return quiz.results
}

module.exports = {
    onGetQuiz,
    onQuizStartQuery,
    onQuizСheckQuery,
    onQuizNextQuery
}
