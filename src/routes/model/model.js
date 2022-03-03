﻿var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var requestSchema = Schema({
    _id: Schema.Types.ObjectId, //Request ID
    requesterTG: Number, //Telegram ID of requester
    requesterMsgID: Number, //Telegram message ID
    otherUsetsTG: [{
        requesterTG: Number,
        requesterMsgID: Number
    }], //Other people who asked for same content
    telegramForwardedChat: Number, //Telegram ID of source
    telegramForwardedMsg: Number, //Telegram MSG ID of source
    telegramPhotoId: String, //Telegram photo fileID
    image: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Image' }], //Image
    video: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }], //Video
    text: {type: String, index: true}, //Text of the message
    searchPhrase: String, //Processed text for search
    tags: [String], //Tags, each separate
    fakeStatus: {type: Number, default: 0}, //Request Fake status: 0 - uncertain, 1 - not fake, -1 - fake
    lastUpdate: {type: Date, default: new Date()}, //Time of last setting update
    createdAt: {type: Date, default: new Date()} //Time of the creation
});

var imageSchema = Schema({
    _id: Schema.Types.ObjectId, //Image ID
    telegramFileId: String, //file_id of the photo from Telegram
    telegramUniqueFileId: String, //file_unique_id of the photo from Telegram
    fileSize: Number, //file_size of the photo from Telegram
    width: Number, //width of the photo from Telegram
    height: Number, //height of the photo from Telegram
    img: {
        data: Buffer,
        contentType: String
    },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' }, //Original request
    createdAt: {type: Date, default: new Date()} //Time of the creation
});

var videoSchema = Schema({
    _id: Schema.Types.ObjectId, //Video ID
    telegramFileId: String, //file_id of the video from Telegram
    telegramUniqueFileId: String, //file_unique_id of the video from Telegram
    fileSize: Number, //file_size of the video from Telegram
    duration: Number, //width of the video from Telegram
    width: Number, //width of the video from Telegram
    height: Number, //height of the video from Telegram
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' }, //Original request
    createdAt: {type: Date, default: new Date()} //Time of the creation
});

requestSchema.index({ text: 'text'});

mongoose.model('Request', requestSchema);  
mongoose.model('Image', imageSchema);  
mongoose.model('Video', videoSchema);  