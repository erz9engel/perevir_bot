var express = require("express");
var router = express.Router();
const mongoose = require('mongoose');
const auth = require('./auth');
const SourceTelegram = mongoose.model('SourceTelegram');
const SourceDomain = mongoose.model('SourceDomain');

router.get('/source', auth.required, async (req, res, next) => {

    const query = req._parsedOriginalUrl.query;
    const source = query.split('_')[0];
    const sourceId = query.split('_')[1];

    try {
        var s, answer;
        if (source == 'T') {
            s = await SourceTelegram.findById({_id: sourceId});
            answer = {
                name: '@' + s.telegramUsername,
                id: "T_" + s._id
            }
        } else {
            s = await SourceDomain.findById({_id: sourceId});
            answer = {
                name: s.domain,
                id: "D_" + s._id
            }
        }
        answer.fake = s.fake;
        answer.description = s.description;
        return res.send(answer);
    } catch (e) {
        return res.status(500)
    }

});

router.post('/update', auth.required, async (req, res, next) => {

    const data = req.body;
    const source = data.id.split('_')[0];
    const sourceId = data.id.split('_')[1];

    if (source == 'T') {
        await SourceTelegram.findByIdAndUpdate(sourceId, {fake: data.fake, description: data.description});
    } else {
        await SourceDomain.findByIdAndUpdate(sourceId, {fake: data.fake, description: data.description});
    }

    return res.send('Updated');
});


router.post('/deleteSource', auth.required, async (req, res, next) => {

    const id = req.body.id;
    const source = id.split('_')[0];
    const sourceId = id.split('_')[1];

    if (source == 'T') {
        await SourceTelegram.deleteOne({_id: sourceId});
    } else {
        await SourceDomain.deleteOne({_id: sourceId});
    }

    return res.send('Updated');
});

module.exports = router