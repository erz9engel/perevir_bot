function isValidCheckRequest(message) {
    let validContent = (message.photo || message.video || (message.text && message.text.length > 10)) //Check if text > 10 in order to sort out short msgs
    let notReply = !message.reply_to_message
    let personalChatOnly = message.chat.id === message.from.id // Verify that this is personal chat with bot, not a group

    return validContent && notReply && personalChatOnly
}

function isReplyWithCommentRequest(message) {
    return message.reply_to_message
        && message.reply_to_message.text
        && message.reply_to_message.text.startsWith('#comment_')
}

function isUnsupportedContent(message) {
    return message.audio || message.document || message.voice || message.location
}

function isTextFromDict(text, dict) {
    for (var key in dict){
        if (dict[key] === text) return true
    }
}

module.exports = {
    isValidCheckRequest,
    isReplyWithCommentRequest,
    isUnsupportedContent,
    isTextFromDict,
}