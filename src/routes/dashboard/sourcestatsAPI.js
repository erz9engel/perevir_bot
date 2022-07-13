var express = require("express");
var router = express.Router();
const mongoose = require('mongoose');
const auth = require('./auth');
var SourceStatistics = mongoose.model('SourceStatistics');

//POST new user route (optional, everyone has access)
router.get('/get', auth.required, async (req, res, next) => {
    let sorting = {}
    sorting[req.query.sort] = 'desc'
    let query = SourceStatistics.find(
        {'totalRequests': { $gt: 5 } },
        'sourceTgId sourceName trueCount falseCount manipulationCount noproofCount rejectCount totalRequests',
    ).sort(
        sorting
    );
    query.exec(function(err, docs) {
       return res.send(docs)
    })
});

module.exports = router