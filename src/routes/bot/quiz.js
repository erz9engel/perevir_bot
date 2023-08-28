const mongoose = require('mongoose');
const TelegramUser = mongoose.model('TelegramUser');
const Quiz = mongoose.model('Quiz');
const Question = mongoose.model('Question');
const PassingQuiz = mongoose.model('PassingQuiz');
const Answer = mongoose.model('Answer');

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
        parse_mode: "HTML",
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
        parse_mode: "HTML",
        reply_markup: JSON.stringify({inline_keyboard}),
    };
    
    try {
        await bot.sendMessage(msg.chat.id, quiz.description, options);
    } catch (e) {
        safeErrorLog(e);
    }

    await addViews(quiz._id);
}

//Queries
const onSpecificQuizQuery = async (callbackQuery, bot) => {
    
    const {data, message} = callbackQuery;
    let quizCode = data.split('_')[1];
    const quiz = await Quiz.findOne({code: quizCode});
    if (!quiz || !quiz.active) return

    var inline_keyboard = [
        [{text: "🚀 Розпочати", callback_data: 'STARTQUIZ_' + quiz.code}],
        [{text: BackNav, callback_data: 'QUIZ'}]
    ];
    
    try {
        await bot.editMessageText(quiz.description, {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard
            },
            chat_id: message.chat.id,
            message_id: message.message_id
        });
    } catch (e) {
        safeErrorLog(e);
    }

    await addViews(quiz._id);
}

async function addViews(quiz_id) {
    await Quiz.findByIdAndUpdate(quiz_id, {$inc: {views: 1}});
}

const onStartQuizQuery = async (callbackQuery, bot) => {

    const {data, message} = callbackQuery;
    await deleteMessage(message, bot);

    let quizCode = data.split('_')[1];
    const quiz = await Quiz.findOne({code: quizCode});
    if (!quiz || !quiz.active) return console.log("Quiz is deleted or inactive");

    var user = await TelegramUser.findOne({telegramID: message.chat.id});
    if (!user) {
        let newUser = new TelegramUser({
            _id: new mongoose.Types.ObjectId(),
            telegramID: message.chat.id,
            language: 'ua',
            joinedCampaign: 'quiz ' + quizCode,
            createdAt: new Date()
        });
        user = newUser;
        await newUser.save().then(() => {}).catch(() => {});
    }

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

    const passingQuiz = await PassingQuiz.findById(PQId).populate('quiz answers');
    var allQuestions = passingQuiz.quiz.questions;

    if (passingQuiz.answers.length >= passingQuiz.quiz.maxQuestions) return false; // After last question

    allQuestions = removeAnswered(allQuestions, passingQuiz.answers);
    if (allQuestions.length == 0) return false;//No more questions
    allQuestions = shuffle(allQuestions);
    var question = await Question.findById(allQuestions[0]);
    
    question.Qn = passingQuiz.answers.length + 1; //Number of current question
    question.Qf = passingQuiz.quiz.maxQuestions; //Max questions

    return question;

}

function removeAnswered(allQuestions, answers) {

    var answersQids = [];
    for (var i in answers) {
        answersQids.push(answers[i].question);
    }
    const filteredArray = allQuestions.filter(objectId => !answersQids.some(id => id.equals(objectId)));
    
    return filteredArray;

}

async function sendQuestion(question, PQId, message, bot) {

    var inline_keyboard = [
        [{text: question.correct, callback_data: 'ANS_0_' + PQId + '_' + question._id}],
        [{text: question.incorrect1, callback_data: 'ANS_1_' + PQId + '_' + question._id}]
    ];
    if (question.incorrect2) inline_keyboard.push([{text: question.incorrect2, callback_data: 'ANS_2_' + PQId + '_' + question._id}]);
    if (question.incorrect3) inline_keyboard.push([{text: question.incorrect3, callback_data: 'ANS_3_' + PQId + '_' + question._id}]);

    inline_keyboard = shuffle(inline_keyboard);
    var text = "Питання " + question.Qn + " з " + question.Qf + ' 🔎';
    text += "\n\n" + question.name;
    if (question.image) {
        const options = {
            parse_mode: "HTML",
            caption: text,
            reply_markup: JSON.stringify({inline_keyboard})
        };

        var imageUrl = getImageUrl(question.image);
        
        if (imageUrl.endsWith('.gif')) {
            try {
                await bot.sendAnimation(message.chat.id, imageUrl, options);
            } catch (e) {safeErrorLog(e);}
        } else {
            try {
                await bot.sendPhoto(message.chat.id, imageUrl, options);
            } catch (e) {safeErrorLog(e);}
        }
        
    
    } else {
        const options = {
            parse_mode: "HTML",
            reply_markup: JSON.stringify({inline_keyboard})
        };
        try {
            await bot.sendMessage(message.chat.id, text, options);
        } catch (e) {safeErrorLog(e);}
    }
}

const onAnswerQuizQuery = async (callbackQuery, bot) => {

    const {data, message} = callbackQuery;
    const correctAnswer = data.split('_')[1];
    const PQId = data.split('_')[2];
    const QuestionId = data.split('_')[3];

    const question = await Question.findById(QuestionId);
    const passingQuiz = await PassingQuiz.findById(PQId);
    if(!question || !passingQuiz) return

    var inline_keyboard = [
        [{text: "Далі", callback_data: 'NEXTQ_' + PQId}]
    ];

    var explain = '\n\n', trueAnswer = false;
    if (correctAnswer == '0') {
        trueAnswer = true;
        explain += "🟢 <b>Правильно!</b>\n"
        if (question.correctExplain) explain += question.correctExplain;
    } else { 
        explain += "🔴 <b>Неправильно!</b>\n" 
        explain += question.explain;
    }
    
    
    if (question.image) {
        try {
            await bot.editMessageCaption(message.caption + explain, {
                parse_mode: "HTML",
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
            await bot.editMessageText(message.text + explain, {
                parse_mode: "HTML",
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
    //SAVE ANSWER
    const answerId = new mongoose.Types.ObjectId();
    const newAnswer = new Answer({
        _id: answerId,
        quiz: passingQuiz.quiz,
        question: QuestionId,
        correct: trueAnswer,
        passedAt: new Date()
    });
    
    await newAnswer.save();
    await PassingQuiz.findByIdAndUpdate(passingQuiz._id, {$push: { answers: answerId }});

};

const onNextQuestionQuery = async (callbackQuery, bot) => {

    const {data, message} = callbackQuery;
    await deleteMessage(message, bot);

    let PQId = data.split('_')[1];
    const question = await getQuestion(PQId);
    if (question == false) return showResults(PQId, callbackQuery, bot);
    
    await sendQuestion(question, PQId, message, bot);

};

const showResults = async (PQId, callbackQuery, bot) => {

    const {message} = callbackQuery;

    const PQ = await PassingQuiz.findByIdAndUpdate(PQId, {finishedAt: new Date(), $inc: {passed_times: 1}}).populate('answers');
    await Quiz.findByIdAndUpdate(PQ.quiz, {$inc: {passed_times: 1}});

    //Analyze answers
    var correct = 0, incorrect = 0;
    for (var i in PQ.answers) {
        const answer = PQ.answers[i];
        if (answer.correct) correct++
        else incorrect++
    }
    
    const pc = correct / (correct+incorrect) * 100;
    var results;
    if (pc < 20) results = 'quiz_result20';
    else if (pc < 50) results = 'quiz_result50';
    else if (pc < 80) results = 'quiz_result80';
    else results = 'quiz_result100';

    const options = {
        parse_mode: "HTML"
    };

    await getText(results, 'ua', async function(err, text){
        if (err) return safeErrorLog(err);
        try {
            await bot.sendMessage(message.chat.id, text, options);
        } catch (e) { safeErrorLog(e) }
    });

};

module.exports = {
    onGetQuiz,
    onSpecificQuizQuery,
    onSpecificQuiz,
    onStartQuizQuery,
    onAnswerQuizQuery,
    onNextQuestionQuery
}
