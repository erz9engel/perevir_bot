const request = require('request');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const ParsingSource = mongoose.model('ParsingSource');
const ParsingPost = mongoose.model('ParsingPost');

const baseURL = 'https://t.me/s/';

async function parseNewTelegramChannel(channelName, keywords) {
    //Check if alsredy added
    const duplicate = await ParsingSource.findOne({username: channelName});
    
    return new Promise(async (resolve, reject) => {
        if (duplicate) return reject('Duplicate'); 

        const url = `${baseURL}${channelName}`;
        request(url, async (error, response, body) => {
            if (!error && response.statusCode === 200) {
                answer = await parseBody(body, channelName, keywords);
                saveNewSoure(answer); //Save channel and last post
                resolve(answer); //Answer
            } else {
                const err = `Error fetching channel ${channelName}: ${error}`;
                return reject(err);
            }
          });
    });   
}

async function parseSources() {
    const sources = await ParsingSource.find({});
    const RPS = 1; //Requests per second

    for (var i in sources) {
        const channelName = sources[i].username;
        const url = `${baseURL}${channelName}`;
        const lastPost = await ParsingPost.findOne({source: sources[i]._id}, {}, { sort: {parsedAt: -1} });
        const lastPostId = lastPost.url;
        
        request(url, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                parseLastPostsBody(body, lastPostId, sources[i]);
            } else {
                const err = `Error fetching channel ${channelName}: ${error}`;
                console.log(err);
            }
        });
        await new Promise(resolve => setTimeout(resolve, 1000 / RPS));
    }
}

async function parseBody(body, channelName, keywords) {
    
    const $ = cheerio.load(body);
    const lastMessageDiv = $('.tgme_widget_message_bubble').last();
    const lastMessageText = lastMessageDiv.find('.tgme_widget_message_text').text().trim();
    const lastMessageLink = lastMessageDiv.find('.tgme_widget_message_date').attr('href');
    if (!lastMessageLink) return reject(`No fetching channel ${channelName}`);
    const parts = lastMessageLink.split('/');
    const lastMessageId = parts[parts.length - 1];

    return {
        channelName: channelName,
        keywords: keywords,
        text: lastMessageText,
        id: lastMessageId
    };
}

async function parseLastPostsBody(body, lastPostId, source) {
    
    const $ = cheerio.load(body);
    const messageDivs = $('.tgme_widget_message_bubble').get().reverse();

    messageDivs.forEach((div) => {
        const lastMessageDiv = $(div);
        const lastMessageText = lastMessageDiv.find('.tgme_widget_message_text').text().trim();
        const lastMessageLink = lastMessageDiv.find('.tgme_widget_message_date').attr('href');
        const parts = lastMessageLink.split('/');
        const lastMessageId = parts[parts.length - 1];

        if (lastMessageId == lastPostId) {
            return console.log('no new posts for ' + source.username);
        } else {
            console.log('NEW: ' + lastMessageLink + ' for ' + lastPostId);
        }
    });
}

async function saveNewSoure(answer) {
    const {channelName, keywords, text, id } = answer;
    //Save new source
    const sourceId = new mongoose.Types.ObjectId();
    const postId = new mongoose.Types.ObjectId();
    var newParsingSource = new ParsingSource({
        _id: sourceId,
        username: channelName,
        posts: [postId],
        keywords: keywords,
        addedAt: new Date()
    });
    
    await newParsingSource.save().then(async () => {
    }).catch(async (e) => {
        return console.log(e); 
    });
    //Check if has text & keywords
    const hasKeyword = await checkKeyword(text, keywords);
    //Save last post
    var newParsingPost = new ParsingPost({
        _id: postId,
        source: sourceId,
        id: id, 
        text: text,
        hasKeyword: hasKeyword,
        parsedAt: new Date()
    });

    await newParsingPost.save().then(async () => {
    }).catch(async (e) => {
        console.log('creation post err')
        return console.log(e); 
    });
}

async function saveNewPost(answer) {
    console.log(answer);
}

async function checkKeyword(text, keywords) {
    const lowercasedText = text.toLowerCase();
    const lowercasedKeywords = keywords.map(keyword => keyword.toLowerCase());
  
    for (const keyword of lowercasedKeywords) {
        if (lowercasedText.includes(keyword)) {
            return true;
        }
    }
    return false;
}

f()
async function f() {
    try {
        const channel = await parseNewTelegramChannel('durov', ['telegram']);
    } catch (e) {
        console.log("Error on adding parsing source: " + e);
    }
}

module.exports = {
    parseNewTelegramChannel //'Genesis_Academy', ['telegram']
};

