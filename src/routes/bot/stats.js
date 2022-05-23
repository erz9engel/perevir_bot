const mongoose = require('mongoose');
require('dotenv').config();
var bot = require('./bot');

const Request = mongoose.model('Request');
const Moderator = mongoose.model('Moderator');
const DailyStats = mongoose.model('DailyStats');
const TelegramUser = mongoose.model('TelegramUser');

const startTime = new Date(); startTime.setHours(8, 00);
const now = new Date();

if (startTime.getTime() < now.getTime()) {
  startTime.setHours(startTime.getHours() + 24);
}

const firstTriggerAfterMs = startTime.getTime() - now.getTime();

setTimeout(function(){
    sendStats();
    sendModeratorDailyStats();

    setInterval(function () {
        sendStats();
        sendModeratorDailyStats();
    }, 24 * 60 * 60 * 1000);
}, firstTriggerAfterMs);

function sendStats() {
    Request.find({}, 'fakeStatus createdAt', function(err, requests){
        var now = new Date(), stats = {};
        var msg = "#СТАТИСТИКА запитів на <b>" + now.getDate() + '.' + (parseInt(now.getMonth()) + 1) + '</b>';
        //General
        stats.rTotal = requests.length;
        msg += '\nВсього: <b>' + requests.length + '</b>';
      
        stats.rFake = requests.filter(r => parseInt(r.fakeStatus) === -1).length;
        msg += '\nФейк: ' + stats.rFake;
        msg += '\nМаніпуляція: ' + requests.filter(r => parseInt(r.fakeStatus) === -5).length;
        msg += '\nВідсутні докази: ' + requests.filter(r => parseInt(r.fakeStatus) === -4).length;
        stats.rTrue = requests.filter(r => parseInt(r.fakeStatus) === 1).length;
        msg += '\nПравда: ' + stats.rTrue;

        msg += '\nВідмовлено: ' + requests.filter(r => parseInt(r.fakeStatus) === -2).length;
        msg += '\nОчікує: ' + requests.filter(r => parseInt(r.fakeStatus) === 0).length;
        msg += '\nАвтовідмова: ' + requests.filter(r => parseInt(r.fakeStatus) === -3).length;
        msg += '\nАвтопідтвердження: ' + requests.filter(r => parseInt(r.fakeStatus) === 2).length;
        msg += '\n\n<b>Остання доба:</b>';
        //Last 24 hours
        now.setDate(now.getDate() - 1);
        const lastrequests = requests.filter(r => new Date(r.createdAt) >= now);

        stats.rToday = lastrequests.length;
        msg += '\nВсього: ' + lastrequests.length;

        stats.rTodayFake = lastrequests.filter(r => parseInt(r.fakeStatus) === -1).length
        msg += '\nФейк: ' + stats.rTodayFake;
        msg += '\nМаніпуляція: ' + requests.filter(r => parseInt(r.fakeStatus) === -5).length;
        msg += '\nВідсутні докази: ' + requests.filter(r => parseInt(r.fakeStatus) === -4).length;
        stats.rTodayTrue = lastrequests.filter(r => parseInt(r.fakeStatus) === 1).length;
        msg += '\nПравда: ' + stats.rTodayTrue;

        msg += '\nВідмовлено: ' + lastrequests.filter(r => parseInt(r.fakeStatus) === -2).length;
        msg += '\nОчікує: ' + lastrequests.filter(r => parseInt(r.fakeStatus) === 0).length;
        msg += '\nАвтовідмова: ' + lastrequests.filter(r => parseInt(r.fakeStatus) === -3).length;
        msg += '\nАвтопідтвердження: ' + lastrequests.filter(r => parseInt(r.fakeStatus) === 2).length;

        bot.message(msg, true, {parse_mode: 'HTML'});
        collectStats(stats);
    });
}

function sendModeratorDailyStats() {
    const now = new Date();
    now.setDate(now.getDate() - 1);

    Request.find({ $and: [{'lastUpdate': { $gt: now } }, { moderator: { $ne: undefined } }]}, 'moderator comment commentMsgId fakeStatus lastUpdate', function(err, requests){
        Moderator.populate(requests, { path: 'moderator' }, function (err, requestsM) {
            var calculatedModerators = [];

            for (var i in requestsM) {
                if (requestsM[i].moderator == null) continue; //If moderator deleted

                objIndex = calculatedModerators.findIndex((obj => obj.id == requestsM[i].moderator._id));
                const amounts = getAmounts(requestsM[i]);
                if (objIndex >= 0) { 
                    calculatedModerators[objIndex].requests += 1;
                    calculatedModerators[objIndex].fakes += amounts.fakes;
                    calculatedModerators[objIndex].rejects += amounts.rejects;
                    calculatedModerators[objIndex].trues += amounts.trues;
                    calculatedModerators[objIndex].comments += amounts.comments;
                } else {
                    calculatedModerators.push({id: requestsM[i].moderator._id, tgId: requestsM[i].moderator.telegramID, name: requestsM[i].moderator.name, requests: 1, fakes: amounts.fakes, rejects: amounts.rejects, trues: amounts.trues, comments: amounts.comments })
                }
            }
            if (calculatedModerators.length == 0) return console.log('No moderators activity');
            calculatedModerators.sort((a, b) => a.requests < b.requests ? 1 : -1);

            var msg = "#24H_LEADERBOARD за <b>" + now.getDate() + '.' + (parseInt(now.getMonth()) + 1) + '</b>\nтоп-10';
            for (var m in calculatedModerators) {
                if(m > 9) break;
                const md = calculatedModerators[m];
                if (String(md.name)[0] == '@') msg += "\n\n" + (parseInt(m)+1) + '. ' + md.name + " - " + md.requests + " запити\n";
                else msg += "\n\n" + (parseInt(m)+1) + '. <a href="tg://user?id=' + md.tgId + '">' + md.name + '</a> - ' + md.requests + " запити\n";
                msg += "⛔ " + md.fakes + " | 🟡 " + md.rejects + " | 🟢 " + md.trues + " | ✉️ " + md.comments;
            }
            bot.message(msg, true, {parse_mode: 'HTML'});
        });
    });
}

function getAmounts(request) {
    var answer = {
        fakes: 0,
        rejects: 0,
        trues: 0,
        comments: 0
    }

    if (request.fakeStatus == -1) answer.fakes = 1
    else if (request.fakeStatus == -2) answer.rejects = 1
    else if (request.fakeStatus == 1) answer.trues = 1
    if (request.commentMsgId) answer.comments = 1

    return answer;
}

async function collectStats(stats) {
    const now = new Date();
    const stringDate = now.getDate() + '-' + (parseInt(now.getMonth()) + 1) + '-' + now.getFullYear();
    const allUsers = await TelegramUser.countDocuments();
    const nSubs = await TelegramUser.countDocuments({subscribed: true});

    let dailyStats = new DailyStats({
        _id: new mongoose.Types.ObjectId(),
        stringDate: stringDate,
        subs: allUsers,
        nSubs: nSubs,  
        nRecived : 0,
        rTotal: stats.rTotal,
        rFake: stats.rFake,
        rTrue: stats.rTrue, 
        rToday: stats.rToday, 
        rTodayFake: stats.rTodayFake, 
        rTodayTrue: stats.rTodayTrue,
        createdAt: new Date()
    });
    await dailyStats.save().then(() => {}).catch((error) => {
        console.log("MongoErr on daily stats: " + error.code);
    });
}

module.exports = {};