const mongoose = require('mongoose');
require('dotenv').config();
var bot = require('./bot');
const schedule = require('node-schedule');

const Request = mongoose.model('Request');
const Moderator = mongoose.model('Moderator');
const Escalation = mongoose.model('Escalation');
const DailyStats = mongoose.model('DailyStats');
const TelegramUser = mongoose.model('TelegramUser');
const SourceStatistics = mongoose.model('SourceStatistics');

schedule.scheduleJob("0 22 * * *", async () => sendStats());
schedule.scheduleJob("1 22 * * *", async () => sendModeratorDailyStats());
schedule.scheduleJob("2 22 * * *", async () => sendEscalationStats());
schedule.scheduleJob("0 3 * * *", async () => updateSourceStats());

function sendStats() {
    Request.find({}, 'fakeStatus createdAt', function(err, requests){
        var now = new Date(), stats = {};
        var displayDate = new Date();
            displayDate.setDate(displayDate.getDate() + 1);

        var msg = "#СТАТИСТИКА запитів на <b>" + displayDate.getDate() + '.' + (parseInt(displayDate.getMonth()) + 1) + '</b>';
        //General
        stats.rTotal = requests.length;
        msg += '\nВсього: <b>' + requests.length + '</b>';
      
        stats.rFake = requests.filter(r => parseInt(r.fakeStatus) === -1).length;
        msg += '\nФейк: ' + stats.rFake;

        stats.rSemiTrue = requests.filter(r => parseInt(r.fakeStatus) === -5).length;
        msg += '\nНапівправда: ' + stats.rSemiTrue;

        stats.rNoProofs = requests.filter(r => parseInt(r.fakeStatus) === -4).length;
        msg += '\nВідсутні докази: ' + stats.rNoProofs;

        stats.rTrue = requests.filter(r => parseInt(r.fakeStatus) === 1).length;
        msg += '\nПравда: ' + stats.rTrue;

        stats.rReject = requests.filter(r => parseInt(r.fakeStatus) === -2).length;
        msg += '\nВідмовлено: ' + stats.rReject;

        stats.rPending = requests.filter(r => parseInt(r.fakeStatus) === 0).length;
        msg += '\nОчікує: ' + stats.rPending;
        msg += '\nАвтовідмова: ' + requests.filter(r => parseInt(r.fakeStatus) === -3).length;
        msg += '\nАвтопідтвердження: ' + requests.filter(r => parseInt(r.fakeStatus) === 2).length;

        //Last 24 hours
        msg += '\n\n<b>Остання доба:</b>';
        now.setDate(now.getDate() - 1);
        const lastrequests = requests.filter(r => new Date(r.createdAt) >= now);

        stats.rToday = lastrequests.length;
        msg += '\nВсього: ' + lastrequests.length;

        stats.rTodayFake = lastrequests.filter(r => parseInt(r.fakeStatus) === -1).length
        msg += '\nФейк: ' + stats.rTodayFake;

        stats.rTodaySemiTrue = lastrequests.filter(r => parseInt(r.fakeStatus) === -5).length;
        msg += '\nНапівправда: ' + stats.rTodaySemiTrue;

        stats.rTodayNoProofs = lastrequests.filter(r => parseInt(r.fakeStatus) === -4).length;
        msg += '\nВідсутні докази: ' + stats.rTodayNoProofs;

        stats.rTodayTrue = lastrequests.filter(r => parseInt(r.fakeStatus) === 1).length;
        msg += '\nПравда: ' + stats.rTodayTrue;

        stats.rTodayReject = lastrequests.filter(r => parseInt(r.fakeStatus) === -2).length;
        msg += '\nВідмовлено: ' + stats.rTodayReject;

        stats.rTodayPending = lastrequests.filter(r => parseInt(r.fakeStatus) === 0).length;
        msg += '\nОчікує: ' + stats.rTodayPending;
        msg += '\nАвтовідмова: ' + lastrequests.filter(r => parseInt(r.fakeStatus) === -3).length;
        msg += '\nАвтопідтвердження: ' + lastrequests.filter(r => parseInt(r.fakeStatus) === 2).length;

        bot.message(msg, true, {parse_mode: 'HTML'});
        collectStats(stats);
    });
}

function sendModeratorDailyStats() {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    var displayDate = new Date();

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

            var msg = "#24H_LEADERBOARD за <b>" + displayDate.getDate() + '.' + (parseInt(displayDate.getMonth()) + 1) + '</b>\nтоп-10';
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

function sendEscalationStats() {
    Escalation.aggregate([{
       $lookup:
         {
           from: 'requests',
           localField: 'request',
           foreignField: '_id',
           as: 'request_data'
         }
    },{
        $unwind: "$request_data"
    },{
        $project:
            {
                _id: 1,
                isResolved: 1,
                createdAt: 1,
                fakeStatus: "$request_data.fakeStatus"
            }
    }], function (err, escalations){
        var now = new Date(), stats = {};
        var displayDate = new Date();
            displayDate.setDate(displayDate.getDate() + 1);

        var msg = "#СТАТИСТИКА ескалацій на <b>" + displayDate.getDate() + '.' + (parseInt(displayDate.getMonth()) + 1) + '</b>';
        //General
        stats.rTotal = escalations.length;
        msg += '\nВсього: <b>' + escalations.length + '</b>';

        stats.rFake = escalations.filter(r => parseInt(r.fakeStatus) === -1).length;
        msg += '\nФейк: ' + stats.rFake;

        stats.rSemiTrue = escalations.filter(r => parseInt(r.fakeStatus) === -5).length;
        msg += '\nНапівправда: ' + stats.rSemiTrue;

        stats.rNoProofs = escalations.filter(r => parseInt(r.fakeStatus) === -4).length;
        msg += '\nВідсутні докази: ' + stats.rNoProofs;

        stats.rTrue = escalations.filter(r => parseInt(r.fakeStatus) === 1).length;
        msg += '\nПравда: ' + stats.rTrue;

        stats.rPending = escalations.filter(r => parseInt(r.fakeStatus) === 0).length;
        msg += '\nОчікує: ' + stats.rPending;

        //Last 24 hours
        msg += '\n\n<b>Остання доба:</b>';
        now.setDate(now.getDate() - 1);
        const lastrequests = escalations.filter(r => new Date(r.createdAt) >= now);

        stats.rToday = lastrequests.length;
        msg += '\nВсього: ' + lastrequests.length;

        stats.rTodayFake = lastrequests.filter(r => parseInt(r.fakeStatus) === -1).length
        msg += '\nФейк: ' + stats.rTodayFake;

        stats.rTodaySemiTrue = lastrequests.filter(r => parseInt(r.fakeStatus) === -5).length;
        msg += '\nНапівправда: ' + stats.rTodaySemiTrue;

        stats.rTodayNoProofs = lastrequests.filter(r => parseInt(r.fakeStatus) === -4).length;
        msg += '\nВідсутні докази: ' + stats.rTodayNoProofs;

        stats.rTodayTrue = lastrequests.filter(r => parseInt(r.fakeStatus) === 1).length;
        msg += '\nПравда: ' + stats.rTodayTrue;

        stats.rTodayPending = lastrequests.filter(r => parseInt(r.fakeStatus) === 0).length;
        msg += '\nОчікує: ' + stats.rTodayPending;

        bot.messageId(process.env.TGESCALATIONGROUP, msg, true, {parse_mode: 'HTML'});
    });
}

async function updateSourceStats() {
    const stats = await Request.aggregate([
    {
        $match: {"telegramForwardedChat": {$ne: null}}
    },
    {
        $group: {
            _id: { telegramForwardedChat: "$telegramForwardedChat", fakeStatus: "$fakeStatus" },
            sourceCount: { $sum :1 }
        }
    },
    {
        $group: {
            _id: "$_id.telegramForwardedChat",
            statusCounts: { $push: { status: "$_id.fakeStatus", count: "$sourceCount" } }
        }
    },
    {
        $project: {
            _id: 1,
            statusCounts:1,
            "totalRequests": {
                "$sum": "$statusCounts.count"
            }
        }
    },
    {
        $sort: {telegramForwardedChat: -1, totalRequests: -1}
    }
]);
    for (var index = 0; index < stats.length; index++) {
        let sourceStat = {"1": 0, "-1": 0, "-2": 0, "-4": 0, "-5": 0}
        for (var i = 0; i < stats[index].statusCounts.length; i++) {
            sourceStat[stats[index].statusCounts[i].status.toString()] = stats[index].statusCounts[i].count
        }
        let updateData = {
            trueCount: sourceStat["1"],
            falseCount: sourceStat["-1"],
            manipulationCount: sourceStat["-5"],
            noproofCount: sourceStat["-4"],
            rejectCount: sourceStat["-2"],
            totalRequests: stats[index].totalRequests,
        }
        let updateResult = await SourceStatistics.findOneAndUpdate(
            {sourceTgId: stats[index]._id},
            updateData,
        );
        if (!updateResult){
            updateData["_id"] = new mongoose.Types.ObjectId()
            updateData["sourceTgId"] = stats[index]._id
            updateData["sourceName"] = ""
            let s = new SourceStatistics(updateData)
            await s.save()
        }
    }
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
    var now = new Date();
    const stringDate = now.getDate() + '-' + (parseInt(now.getMonth()) + 1) + '-' + now.getFullYear();
    const allUsers = await TelegramUser.countDocuments();
    const nSubs = await TelegramUser.countDocuments({subscribed: true});

    let dailyStats = {
        subs: allUsers,
        nSubs: nSubs,  
        rTotal: stats.rTotal,
        rFake: stats.rFake,
        rTrue: stats.rTrue, 
        rSemiTrue: stats.rSemiTrue,
        rNoProofs: stats.rNoProofs,
        rReject: stats.rReject,
        rPending: stats.rPending,
        rToday: stats.rToday, 
        rTodayFake: stats.rTodayFake, 
        rTodayTrue: stats.rTodayTrue,
        rTodaySemiTrue: stats.rTodaySemiTrue,
        rTodayNoProofs: stats.rTodayNoProofs,
        rTodayReject: stats.rTodayReject,
        rTodayPending: stats.rTodayPending
    };
    console.log(dailyStats)
    await DailyStats.findOneAndUpdate({stringDate: stringDate}, dailyStats);

    //Create for upcoming day
    var nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    const stringNextDate = nextDay.getDate() + '-' + (parseInt(nextDay.getMonth()) + 1) + '-' + nextDay.getFullYear();
    let newDailyStats = new DailyStats({
        _id: new mongoose.Types.ObjectId(),
        stringDate: stringNextDate,
        nRecived : 0,
        createdAt: new Date()
    });
    await newDailyStats.save().then(() => {}).catch((error) => {
        console.log("MongoErr on daily stats: " + error.code);
    });
}

module.exports = {};