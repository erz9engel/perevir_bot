var express = require("express");
var router = express.Router();
const mongoose = require('mongoose');
const auth = require('./auth');
const Quiz = mongoose.model('Quiz');

//POST new user route (optional, everyone has access)
router.post('/create', auth.required, async (req, res, next) => {

    const data = req.body;
    const code = await generateCode();
    const newQuiz = new Quiz({
        _id: new mongoose.Types.ObjectId(),
        name: data.name,
        description: data.description,
        code: code
    });
    
    return newQuiz.save()
        .then(function () {
            return res.redirect('../quiz');
        });

});

async function generateCode() {
    return (Math.random() + 1).toString(36).substring(7);
}

module.exports = router