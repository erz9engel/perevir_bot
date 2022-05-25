var fs = require('fs');

module.exports = {
    getText: async function (name, lang, callback) {
        await fs.readFile('texts.json',
            function(err, texts) {       
                if (err) return callback(err);
                const textsObj = JSON.parse(texts);
                for (var i in textsObj) {
                    if (textsObj[i].name == name){
                        if (lang == null) return callback(null, textsObj[i]);
                        return callback(null, textsObj[i][lang]);
                    } 
                }
            });
    }
}