const mongoose = require('mongoose');
const TelegramUser = mongoose.model('TelegramUser');
const Quiz = mongoose.model('Quiz');
const Question = mongoose.model('Question');
const PassingQuiz = mongoose.model('PassingQuiz');

const {
    safeErrorLog, shuffle, getImageUrl, deleteMessage
} = require("./utils");
const { getText } = require('./localisation');
const { BackNav } = require('./contstants');

const onGetQuiz = async (msg, bot) => {
    
    const activeQuiz = await Quiz.find({active: true});
    var inline_keyboard = [];
    if (activeQuiz.length == 0) {
        try {
            return await bot.sendMessage(msg.chat.id, "Немає активних квізів");
        } catch (e) { safeErrorLog(e) }
    }

    for (var i in activeQuiz) {
        inline_keyboard.push([{text: activeQuiz[i].name, callback_data: 'QUIZ_' + activeQuiz[i].code}]);
    }

    const options = {
        reply_markup: JSON.stringify({inline_keyboard}),
    };

    try {
        await getText('quiz_main', 'ua', async function(err, text){
            if (err) return safeErrorLog(err);
            try {
                await bot.sendMessage(msg.chat.id, text, options);
            } catch (e) { safeErrorLog(e) }
        });
    } catch (e) { safeErrorLog(e) }

}

const onSpecificQuiz = async (msg, bot) => {
    
    const text = msg.text;
    let quizCode = text.split('quiz_')[1];
    const quiz = await Quiz.findOne({code: quizCode});
    if(!quiz) return

    var inline_keyboard = [
        [{text: "🚀 Розпочати", callback_data: 'STARTQUIZ_' + quiz.code}]
    ];

    const options = {
        reply_markup: JSON.stringify({inline_keyboard}),
    };
    
    try {
        await bot.sendMessage(msg.chat.id, quiz.description, options);
    } catch (e) {
        safeErrorLog(e);
    }
}

//Queries
const onSpecificQuizQuery = async (callbackQuery, bot) => {
    
    const {data, message} = callbackQuery;
    let quizCode = data.split('_')[1];
    const quiz = await Quiz.findOne({code: quizCode});
    if (quiz || quiz.active) return

    var inline_keyboard = [
        [{text: "🚀 Розпочати", callback_data: 'STARTQUIZ_' + quiz.code}],
        [{text: BackNav, callback_data: 'QUIZ'}]
    ];
    
    try {
        await bot.editMessageText(quiz.description, {
            reply_markup: {
                inline_keyboard
            },
            chat_id: message.chat.id,
            message_id: message.message_id
        });
    } catch (e) {
        safeErrorLog(e);
    }
}

const onStartQuizQuery = async (callbackQuery, bot) => {

    const {data, message} = callbackQuery;
    await deleteMessage(message, bot);

    let quizCode = data.split('_')[1];
    const quiz = await Quiz.findOne({code: quizCode});
    if (!quiz || !quiz.active) return console.log("Quiz is deleted or inactive");

    const user = await TelegramUser.findOne({telegramID: message.chat.id});
    if (!user) return console.log("No user to start test");

    const PQId = new mongoose.Types.ObjectId();
    const newPassingQuiz = new PassingQuiz({
        _id: PQId,
        user: user._id,
        quiz: quiz._id,
        startedAt: new Date()
    });
    
    await newPassingQuiz.save();

    const question = await getQuestion(PQId);
    if (question == false) return console.log("Handle last Q")
    
    await sendQuestion(question, PQId, message, bot);

};

async function getQuestion(PQId) {

    const passingQuiz = await PassingQuiz.findById(PQId).populate('quiz');
    var allQuestions = passingQuiz.quiz.questions;

    if (passingQuiz.answers.length >= passingQuiz.quiz.maxQuestions) return false; // After last question

    allQuestions = shuffle(allQuestions);
    const question = await Question.findById(allQuestions[0]);

    return question;

}

async function sendQuestion(question, PQId, message, bot) {

    var inline_keyboard = [
        [{text: question.correct, callback_data: 'ANS_0_' + PQId + '_' + question._id}],
        [{text: question.incorrect1, callback_data: 'ANS_1_' + PQId + '_' + question._id}]
    ];
    if (question.incorrect2) inline_keyboard.push([{text: question.incorrect2, callback_data: 'ANS_2_' + PQId + '_' + question._id}]);
    if (question.incorrect3) inline_keyboard.push([{text: question.incorrect3, callback_data: 'ANS_3_' + PQId + '_' + question._id}]);

    if (question.image) {
        const options = {
            caption: question.name,
            reply_markup: JSON.stringify({inline_keyboard})
        };

        const imageUrl = getImageUrl(question.image);
        
        try {
            await bot.sendPhoto(message.chat.id, imageUrl, options);
        } catch (e) {safeErrorLog(e);}
    
    } else {
        const options = {
            reply_markup: JSON.stringify({inline_keyboard})
        };
        try {
            await bot.sendMessage(message.chat.id, question.name, options);
        } catch (e) {safeErrorLog(e);}
    }
}

const onAnswerQuizQuery = async (callbackQuery, bot) => {

    const {data, message} = callbackQuery;
    const correctAnswer = data.split('_')[1];
    const PQId = data.split('_')[2];
    const QuestionId = data.split('_')[3];

    const question = await Question.findById(QuestionId);

    var inline_keyboard = [
        [{text: "Далі", callback_data: 'NEXTQ_' + PQId}]
    ];

    var explain = '\n\n';
    if(correctAnswer == '1') explain += "Вірно!\n"
    else explain += "Невірно\n"
    explain += question.explain;

    if (question.image) {
        try {
            await bot.editMessageCaption(question.name + explain, {
                reply_markup: {
                    inline_keyboard
                },
                chat_id: message.chat.id,
                message_id: message.message_id,
            });
        } catch (e) {
            safeErrorLog(e);
        }
    } else {
        try {
            await bot.editMessageText(question.name + explain, {
                reply_markup: {
                    inline_keyboard
                },
                chat_id: message.chat.id,
                message_id: message.message_id
            });
        } catch (e) {
            safeErrorLog(e);
        }
    }

};

module.exports = {
    onGetQuiz,
    onSpecificQuizQuery,
    onSpecificQuiz,
    onStartQuizQuery,
    onAnswerQuizQuery
}
