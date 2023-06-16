var express = require("express");
var router = express.Router();
const mongoose = require('mongoose');
const auth = require('./auth');
const { parseNewTelegramChannel } = require("../parser-bot/parser");
const ParsingSource = mongoose.model('ParsingSource');
const ParsingPost = mongoose.model('ParsingPost');

router.post('/create', auth.required, async (req, res, next) => {

    const data = req.body;
    const username = data.username;
    const keywords = data.keywords.split(' ');

    try {
        await parseNewTelegramChannel(username, keywords);
        return res.send('added');
    } catch (e) {
        console.log(e);
        return res.sendStatus(403);
    }

});

router.post('/deleteSource', auth.required, async (req, res, next) => {

    const id = req.body.id;

    await ParsingSource.deleteOne({_id: id});
    await ParsingPost.deleteMany({source: id});
    
    return res.send('Updated');
});

module.exports = router