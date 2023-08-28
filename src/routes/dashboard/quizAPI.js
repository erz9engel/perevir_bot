var express = require("express");
var router = express.Router();
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const auth = require('./auth');
const Quiz = mongoose.model('Quiz');
const Question = mongoose.model('Question');

//POST new quiz route
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

router.post('/update', auth.required, async (req, res, next) => {

    const data = req.body;
    await Quiz.findByIdAndUpdate(data.Qid, {name: data.name, description: data.description, maxQuestions: data.maxQuestions, active: data.active});

    return res.send('Updated');
});

// Increase the maximum request size to 50MB
const jsonParser = bodyParser.json({ limit: '50mb' });
const urlencodedParser = bodyParser.urlencoded({ limit: '50mb', extended: true });

// Configure multer to store uploaded files in the "uploads" directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'src/public/images');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = uuidv4() + ext;
    cb(null, filename);
  }
});

const upload = multer({ storage });

router.post('/createQuestion', jsonParser, urlencodedParser, upload.any(), (req, res) => {
    
    const data = req.body;
    if(!data.quizCode) return res.send("No quizCode");

    const Qid = new mongoose.Types.ObjectId();
    const newQuestion = new Question({
        _id: Qid,
        name: data.name,
        correct: data.correct,
        incorrect1: data.incorrect1,
        incorrect2: data.incorrect2,
        incorrect3: data.incorrect3,
        explain: data.explain,
        correctExplain: data.correctExplain,
        video: data.video,
    });

    if (req.files && req.files.length > 0) {
      const file = req.files[0];
      newQuestion.image = file.filename;
    } 

    return newQuestion.save()
        .then(async function () {
            await Quiz.findOneAndUpdate({code: data.quizCode}, {$push: { questions: Qid } });
            return res.redirect('../quiz/' + data.quizCode);
        });
});


router.post('/updateQuestion', jsonParser, urlencodedParser, upload.any(), async (req, res) => {
    
    const data = req.body;
    if(!data.quizCode) return res.send("No quizCode");
    else if (!data.Qid) return res.send("No Qid");
    
    const questionData = {
        name: data.name,
        correct: data.correct,
        incorrect1: data.incorrect1,
        incorrect2: data.incorrect2,
        incorrect3: data.incorrect3,
        explain: data.explain,
        correctExplain: data.correctExplain,
        video: data.video,
    };

    if (req.files && req.files.length > 0) {
      const file = req.files[0];
      questionData.image = file.filename;
    } 

    await Question.findByIdAndUpdate(data.Qid, questionData);
    return res.redirect('../quiz/' + data.quizCode);
    
});

router.post('/deleteQuestion', auth.required, async (req, res, next) => {

    const data = req.body;

    await Question.deleteOne({_id: data.question});
    await Quiz.findOneAndUpdate({code: data.quizCode}, { $pull: {questions: data.question}});

    return res.send('deleted');
});

router.get('/question', auth.required, async (req, res, next) => {

    try {
        const q = await Question.findById({_id: req._parsedOriginalUrl.query});
        return res.send(q);
    } catch (e) {
        return res.status(500)
    }

});


module.exports = router