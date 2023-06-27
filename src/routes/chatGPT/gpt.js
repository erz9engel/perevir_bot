const mongoose = require('mongoose');
const Request = mongoose.model('Request');
const SourceDomain = mongoose.model('SourceDomain');

const { Configuration, OpenAIApi } = require('openai');
const { prepareText, getDomainWithoutSubdomain } = require('../bot/utils');

const configuration = new Configuration({
    organization: process.env.GPTOIORG,
    apiKey: process.env.GPTOIKEY
});
const openai = new OpenAIApi(configuration);
const google = require('googlethis');
const { parser } = require('html-metadata-parser');

const askGPT = async (text) => {
    return new Promise(async (resolve, reject) => {

        try {
            const response = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: [{"role": "user", "content": text}],
                max_tokens: 1000,
                temperature: 0
            });
            console.log(response.data.usage);
            console.log(response.data.choices[0].message);
            // Get the generated text from the OpenAI API response
            var generatedText = response.data.choices[0].message.content;
            generatedText = generatedText.replace(/"/g, '');
            resolve(generatedText); //Answer
       
        } catch (e) {
            return reject(e);
        }
    });   
}

const getGoogleResulte = async(requestSummary, lang) => {
    return new Promise(async (resolve, reject) => {
        const options = {
            page: 0, 
            safe: false, // Safe Search
            parse_ads: false, // If set to true sponsored results will be parsed
            additional_params: { // add additional parameters here, see https://moz.com/blog/the-ultimate-guide-to-the-google-search-parameters
              hl: lang 
            }
        }

        var answer = {
            description: '',
            sources: []
        };
        try {
            const response = await google.search(requestSummary, options);
            for (var i in response.results) {
                const url = new URL(response.results[i].url);
                const domain = getDomainWithoutSubdomain(url.origin);
                console.log(domain);
                const source = await SourceDomain.findOne({$and: [{domain: domain}, {fake: false}]});
                if (source) {
                    try {
                        var result = await parser(response.results[i].url);
                        var metadata = result.meta.title;
                        if (result.meta.description) metadata += '. ' + result.meta.description;
                        answer.description += '- ' + metadata + '\n';
                        answer.sources.push(response.results[i].url);
                    } catch (e) {
                        console.log("Error with a source " + response.results[i].url)
                    }
                }
            }
            resolve(answer); //Answer
        } catch (e) {
            return reject(e);
        }   
    });
}

async function automatedCheckGPT(text, lang) {
    try {
        //Get search term with chatGPT
        const preparedText = await prepareText(text);
        var requestText = "Generate search term in ukrainian that can help to confirm this information:\n" + preparedText;
        const requestSummary = await askGPT(requestText);
        //Request Google
        const searchResults = await getGoogleResulte(requestSummary, lang);
        if (!searchResults || searchResults.sources.length == 0) return false;
        //Ask chatGPT to comment
        var commentRequestText = "Statement: " + preparedText + "\nSummary from trusted sources: " + searchResults.description + "\nBased on the summary, comment on the truth of the statement in ukrainian?";
        const commentRequest = await askGPT(commentRequestText);
        var replyText = commentRequest + "\n\nДжерела:";
        for (var i in searchResults.sources) {
            replyText += '\n- ' + searchResults.sources[i];
        }
        //replyText += "\n\n⚠️ Зверніть увагу, це повідомлення згенероване штучним інтелектом, та може спотворювати реальні дані."
        
        return replyText;

    } catch (e) {
        if(e.response && e.response.statusText) console.log("GPT error: " + e.response.statusText);
        return false;
    }
}

module.exports = {
    automatedCheckGPT
};


