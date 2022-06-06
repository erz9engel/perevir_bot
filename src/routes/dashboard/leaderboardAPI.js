var express = require("express");
var router = express.Router();
const mongoose = require('mongoose');
const auth = require('./auth');
var Request = mongoose.model('Request');
var Moderator = mongoose.model('Moderator');

//POST new user route (optional, everyone has access)
router.get('/get', auth.required, async (req, res, next) => {
    var from = new Date(req.query.from), to = new Date(req.query.to);
    if(isNaN(from.getTime())) from = new Date(2022, 1, 1)
    if(isNaN(to.getTime())) to = new Date
    from.setHours(0);
    to.setHours(23);
    
    Request.find({ $and: [{'lastUpdate': { $gt: from, $lte: to } }, { moderator: { $ne: undefined } }]}, 'moderator comment commentMsgId fakeStatus lastUpdate', function(err, requests){
        Moderator.populate(requests, { path: 'moderator' }, function (err, requestsM) {
            var calculatedModerators = [];

            for (var i in requestsM) {
                if (requestsM[i].moderator == null) continue; //If moderator deleted

                objIndex = calculatedModerators.findIndex((obj => obj.id == requestsM[i].moderator._id));
                const amounts = getAmounts(requestsM[i]);
                if (objIndex >= 0) { 
                    calculatedModerators[objIndex].requests += 1;
                    calculatedModerators[objIndex].fakes += amounts.fakes;
                    calculatedModerators[objIndex].trues += amounts.trues;
                    calculatedModerators[objIndex].semitrues += amounts.semitrues;
                    calculatedModerators[objIndex].nodatas += amounts.nodatas;
                    calculatedModerators[objIndex].rejects += amounts.rejects;
                    calculatedModerators[objIndex].comments += amounts.comments;
                } else {
                    calculatedModerators.push({id: requestsM[i].moderator._id, tgId: requestsM[i].moderator.telegramID, name: requestsM[i].moderator.name, requests: 1, fakes: amounts.fakes, rejects: amounts.rejects, trues: amounts.trues, semitrues: amounts.semitrues, nodatas: amounts.nodatas, comments: amounts.comments })
                }
            }
            if (calculatedModerators.length == 0) return res.sendStatus(404);
            calculatedModerators.sort((a, b) => a.requests < b.requests ? 1 : -1);
            
            return res.send(calculatedModerators);
        });
    });
});

function getAmounts(request) {
    var answer = {
        fakes: 0,
        trues: 0,
        semitrues: 0,
        nodatas: 0,
        rejects: 0,
        comments: 0
    }

    if (request.fakeStatus == -1) answer.fakes = 1
    else if (request.fakeStatus == 1) answer.trues = 1
    else if (request.fakeStatus == -5) answer.semitrues = 1
    else if (request.fakeStatus == -4) answer.nodatas = 1
    else if (request.fakeStatus == -2) answer.rejects = 1
    if (request.commentMsgId) answer.comments = 1

    return answer;
}

module.exports = router