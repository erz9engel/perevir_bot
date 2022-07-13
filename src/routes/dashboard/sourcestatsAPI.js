var express = require("express");
var router = express.Router();
const mongoose = require('mongoose');
const auth = require('./auth');
var SourceStatistics = mongoose.model('SourceStatistics');

//POST new user route (optional, everyone has access)
router.get('/get', auth.required, async (req, res, next) => {
    SourceStatistics.find(
        {'totalRequests': { $gt: 5 } },
        'sourceTgId sourceName trueCount falseCount manipulationCount noproofCount rejectCount totalRequests',
        function(err, sources){
            return res.send(sources);
        });
});

module.exports = router