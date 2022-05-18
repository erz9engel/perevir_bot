const mongoose = require("mongoose");
const Comment = mongoose.model('Comment');

async function answerInlineQuery(inlineQuery, bot) {
    const {query} = inlineQuery;
    let comments = await Comment.find({"tag": {"$regex": query, "$options": "i"}}).limit(10);
        let inlineResults = [];
        for (var index = 0; index < comments.length; index++) {
            inlineResults.push({
                "id": comments[index]._id,
                "type": "article",
                "title": comments[index].tag,
                "input_message_content": {
                    "message_text": comments[index].tag
                },
            });
        }
        await bot.answerInlineQuery(inlineQuery.id, inlineResults)
}

module.exports = {
    answerInlineQuery
}