var express = require("express");
var router = express.Router();
const mongoose = require('mongoose');
const auth = require('./auth');
const fs = require('fs');
var Data = mongoose.model('Data');

//POST new user route (optional, everyone has access)
router.post('/update', auth.required, async (req, res, next) => {
    const textsToUpdate = req.body;
    var texts = [];
    for (var i in textsToUpdate) {
        texts.push({
            name: textsToUpdate[i].name,
            ua: textsToUpdate[i].ua,
            en: textsToUpdate[i].en
        });
    }
    await updateTexts(texts);
    return res.sendStatus(200);
});

async function updateTexts(texts) {
     
    fs.readFile('texts.json',
        await function(err, data) {       
            if (err) throw err;
            var dbTexts = JSON.parse(data);
            for (var i in dbTexts) {
                for (var j in texts) {
                    if  (dbTexts[i].name == texts[j].name) {
                        if(texts[j].ua != '') dbTexts[i].ua = texts[j].ua;
                        if(texts[j].en != '') dbTexts[i].en = texts[j].en;
                        break;
                    }
                }
            }
            fs.writeFile("texts.json", JSON.stringify(dbTexts), 'utf8', async function (err) {
                if (err) {
                    console.log("An error occured while writing JSON Object to File.");
                    return console.log(err);
                }
                console.log("Texts file has been updated.");
                //Write to DB
                await Data.findOneAndUpdate({name: 'texts'}, {value: JSON.stringify(dbTexts)});
            });
        });
}

getTextsFromDB();
async function getTextsFromDB (){
    Data.findOne({name: 'texts'}, async function(err, texts){
        if (!texts) {
            let newData = new Data({
                _id: new mongoose.Types.ObjectId(),
                name: 'texts',
                value: null
            });
            await newData.save()
        } else if (texts.value) {
            fs.writeFile("texts.json", texts.value, 'utf8', function (err) {
                if (err) {
                    console.log("An error occured while writing JSON Object to File.");
                }
            });
        }
    })
}


module.exports = router