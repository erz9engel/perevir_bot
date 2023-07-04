const request = require('request');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const { messageId } = require('../bot/bot');
const { text } = require('body-parser');
const ParsingSource = mongoose.model('ParsingSource');
const ParsingPost = mongoose.model('ParsingPost');
const notifyGroup = process.env.TGPARSEGROUP;

const baseURL = 'https://t.me/s/';
const oririnalURL = 'https://t.me/'

async function parseNewTelegramChannel(channelName, keywords) {
    //Check if alsredy added
    const duplicate = await ParsingSource.findOne({username: channelName});
    
    return new Promise(async (resolve, reject) => {
        if (duplicate) return reject('Duplicate'); 

        const url = `${baseURL}${channelName}`;
        request(url, async (error, response, body) => {
            if (!error && response.statusCode === 200) {
                answer = await parseBody(body, channelName, keywords);
                if (!answer) {
                    const err = `Error fetching channel ${channelName}: ${error}`;
                    return reject(err);
                }
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
        const lastPost = await ParsingPost.findOne({source: sources[i]._id}, {}, { sort: {id: -1} });
        const lastPostId = lastPost.id;

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
    const lastMessageText = lastMessageDiv.find('.tgme_widget_message_text').last().text().trim();
    const lastMessageLink = lastMessageDiv.find('.tgme_widget_message_date').attr('href');
    if (!lastMessageLink) return false;
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

    for (var i in messageDivs) {
        const div = messageDivs[i];
        const lastMessageDiv = $(div);
        const lastMessageText = lastMessageDiv.find('.tgme_widget_message_text').last().text().trim();
        const lastMessageLink = lastMessageDiv.find('.tgme_widget_message_date').attr('href');
        const parts = lastMessageLink.split('/');
        const lastMessageId = parts[parts.length - 1];

        if (lastMessageId <= lastPostId) {
            return console.log('no new posts for ' + source.username);
        } else {
            saveNewPost({
                sourceId: source._id,
                username: source.username,
                keywords: source.keywords,
                id: lastMessageId,
                text: lastMessageText
            })
        }
    }
}

async function saveNewSoure(answer) {
    const {channelName, keywords, text, id } = answer;
    //Save new source
    const sourceId = new mongoose.Types.ObjectId();
    var newParsingSource = new ParsingSource({
        _id: sourceId,
        username: channelName,
        keywords: keywords,
        addedAt: new Date()
    });
    
    await newParsingSource.save().then(async () => {
    }).catch(async (e) => {
        return console.log(e); 
    });
    
    saveNewPost({
        sourceId: sourceId,
        username: channelName,
        keywords: keywords,
        id: id,
        text: text
    });
}

async function saveNewPost(answer) {
    const {sourceId, username, keywords, id, text} = answer;
    //Check if has text & keywords
    const hasKeyword = await checkKeyword(text, keywords);
    //Alert to the chat
    if (hasKeyword == true) {
        const options = {parse_mode: "HTML"};
        const msgText = oririnalURL + username + "/" + id + "\n\n" + text;
        await messageId(notifyGroup, msgText, false, options);
    }

    //Save last post
    const postId = new mongoose.Types.ObjectId();
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
        return console.log(e); 
    });
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

// Schedule parseSources to run every 5 minutes
const interval = 5 * 60 * 1000; 
setInterval(parseSources, interval);

module.exports = {
    parseNewTelegramChannel //'Genesis_Academy', ['telegram']
};

