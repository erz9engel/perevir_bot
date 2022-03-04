const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();
var bot = require('./bot');

const Request = mongoose.model('Request');

const startTime = new Date(); startTime.setHours(8, 00);
const now = new Date();

if (startTime.getTime() < now.getTime()) {
  startTime.setHours(startTime.getHours() + 24);
}

const firstTriggerAfterMs = startTime.getTime() - now.getTime();

setTimeout(function(){
    sendStats();
    setInterval(sendStats, 24 * 60 * 60 * 1000);
}, firstTriggerAfterMs);

function sendStats() {
    Request.find({}, 'fakeStatus createdAt', function(err, requests){
        var now = new Date();
        var msg = "#СТАТИСТИКА запитів на " + now.getDate() + '.' + (parseInt(now.getMonth()) + 1);
        msg += '\nВсього: ' + requests.length;
        msg += '\nФейк: ' + requests.filter(r => parseInt(r.fakeStatus) === -1).length;
        msg += '\nПравда: ' + requests.filter(r => parseInt(r.fakeStatus) === 1).length;
        msg += '\n\nОстання доба:';
        now.setDate(now.getDate() - 1);
        const lastrequests = requests.filter(r => new Date(r.createdAt) >= now);
        msg += '\nВсього: ' + lastrequests.length;
        msg += '\nФейк: ' + lastrequests.filter(r => parseInt(r.fakeStatus) === -1).length;
        msg += '\nПравда: ' + lastrequests.filter(r => parseInt(r.fakeStatus) === 1).length;
        msg += '\nОчікує: ' + lastrequests.filter(r => parseInt(r.fakeStatus) === 0).length;

        bot.message(msg, true)
    });
}

module.exports = {};