var express = require("express");
var router = express.Router();
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const auth = require('./auth');
const Quiz = mongoose.model('Quiz');

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
    
    let url;
    if (req.files && req.files.length > 0) {
      // If a file was uploaded, use its filename to construct the URL
      const file = req.files[0];
      url = `http://localhost:3000/images/${file.filename}`;
    } else {
        url = 'no';
    }

    res.send(url);
});

// Error handling middleware
router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

module.exports = router