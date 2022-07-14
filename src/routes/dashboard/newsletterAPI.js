var express = require("express");
var router = express.Router();
const mongoose = require('mongoose');
const auth = require('./auth');
const Request = mongoose.model('Request');
const TelegramUser = mongoose.model('TelegramUser');

router.get('/get', auth.required, async (req, res, next) => {
    var from = new Date(req.query.from), to = new Date(req.query.to);
    if(isNaN(from.getTime())) from = new Date(2022, 1, 1)
    if(isNaN(to.getTime())) to = new Date();
    from.setHours(0);
    from.setMinutes(0);
    to.setHours(23);
    to.setMinutes(59);

    var checkedMinNews = req.query.checkedMinNews, checkedMaxNews = req.query.checkedMaxNews;
    var subscribed = true;
    if (req.query.subscribed == 'false') subscribed = false;

    if (!checkedMinNews) checkedMinNews = 0;
    if (!checkedMaxNews) checkedMaxNews = 1000;
    const toContactIds = await getUsersData(from, to, checkedMinNews, checkedMaxNews, subscribed);
    return res.send({'amount': toContactIds.length});
});

async function getUsersData(from, to, checkedMinNews, checkedMaxNews, subscribed) {
    var requests = await Request.find({ $and: [{'createdAt': { $gt: from, $lte: to } }]}, 'requesterTG requesterId');
    requests = await TelegramUser.populate(requests, { path: 'requesterId', select: 'subscribed' });
    //Remove viber & sort by subscription status
    var groupedRequests = [], allIds = [];
    for (var r in requests) {
        if (requests[r] && requests[r].requesterTG) {
            if (subscribed && requests[r].requesterId && Boolean(requests[r].requesterId.subscribed)) {
                groupedRequests.push({'requesterTG': requests[r].requesterTG})
            } else if (!subscribed) {
                groupedRequests.push({'requesterTG': requests[r].requesterTG})
            } else {
                allIds.push(String(requests[r].requesterTG));
            }
        }
    }
    //Group requests
    const groupedReqs = countValuesByKey(groupedRequests, 'requesterTG');
    const groupedReqsArr = Object.entries(groupedReqs);
    groupedReqsArr.sort(function(a, b) {
        var x = a[1], y = b[1];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });

    var toContactIds = [];
    for (var i in groupedReqsArr) {
        if (groupedReqsArr[i][1] >= checkedMinNews && groupedReqsArr[i][1] <= checkedMaxNews && groupedReqsArr[i][0] && groupedReqsArr[i][0] != 'undefined') {
            toContactIds.push(groupedReqsArr[i][0]);
        }
        allIds.push(groupedReqsArr[i][0]);
    }
    
    if (checkedMinNews == 0) {
        var tgUsers;
        if (subscribed) tgUsers = await TelegramUser.find({subscribed: subscribed}, 'telegramID');
        tgUsers = await TelegramUser.find({}, 'telegramID');
        
        for (var j in tgUsers) {
            const id = String(tgUsers[j].telegramID);
            if (!allIds.includes(id)) toContactIds.push(id);
        }
    }
    
    return toContactIds;
}

let countValuesByKey = (arr, key) => arr.reduce((r, c) => {
    r[c[key]] = (r[c[key]] || 0) + 1
    return r
}, {})

const {sendLetters} = require("../bot/bot")

router.get('/send', auth.required, async (req, res, next) => {

    const message = req.query.message;
    if(!message || message == '') return res.status(403).send({ error: 'Немає тексту' })

    var from = new Date(req.query.from), to = new Date(req.query.to);
    if(isNaN(from.getTime())) from = new Date(2022, 1, 1)
    if(isNaN(to.getTime())) to = new Date();
    from.setHours(0);
    from.setMinutes(0);
    to.setHours(23);
    to.setMinutes(59);

    var checkedMinNews = req.query.checkedMinNews, checkedMaxNews = req.query.checkedMaxNews;
    if (!checkedMinNews) checkedMinNews = 0;
    if (!checkedMaxNews) checkedMaxNews = 1000;
    var subscribed = true;
    if (req.query.subscribed == 'false') subscribed = false;
    const toContactIds = await getUsersData(from, to, checkedMinNews, checkedMaxNews, subscribed);
    sendLetters(toContactIds, message);

    return res.send({'sent': true});
});


module.exports = router