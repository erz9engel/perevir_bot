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
    var tgUsers;
    if (subscribed) tgUsers = await TelegramUser.find({subscribed: subscribed}, 'telegramID requests');
    else tgUsers = await TelegramUser.find({}, 'telegramID requests');
    //populate requests
    tgUsers = await Request.populate(tgUsers, { path: 'requests', match: {'createdAt': { $gt: from, $lte: to } }, select: '_id' });

    var toContactIds = [];
    for (var j in tgUsers) {
        if (tgUsers[j].requests.length >= checkedMinNews && tgUsers[j].requests.length <= checkedMaxNews) toContactIds.push(tgUsers[j].telegramID);
    }

    return toContactIds;
};

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