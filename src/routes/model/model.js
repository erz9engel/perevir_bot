var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var requestSchema = Schema({
    _id: Schema.Types.ObjectId, //Request ID
    requesterTG: Number, //Telegram ID of requester | REMOVE after migration
    requesterMsgID: Number, //Telegram message ID
    moderatorMsgID: Number, //Telegram message ID of resent message
    moderatorActionMsgID: Number, //Telegram message ID of action message
    otherUsetsTG: [{
        requesterTG: Number,
        requesterMsgID: Number
    }], //Other people who asked for same content
    telegramForwardedChat: Number, //Telegram ID of source
    telegramForwardedMsg: Number, //Telegram MSG ID of source
    telegramPhotoId: String, //Telegram photo fileID
    image: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Image' }], //Image
    video: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }], //Video
    text: String, //Text of the message
    searchPhrase: String, //Processed text for search
    tags: [String], //Tags, each separate
    commentChatId: Number, //Telegram ID of moderator of the comment
    commentMsgId: Number, //Telegram message ID of comment message
    fakeStatus: {type: Number, default: 0}, //Request Fake status: 0 - uncertain, 1 - not fake, -1 - fake, -2 - rejected, -3 - auto reject, 2 - auto confirm
    requestReason: Number, //0 - emergency, 1 - decision, 2 - important
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

var telegramUserSchema = Schema({
    _id: Schema.Types.ObjectId, //User ID
    telegramID: {type: Number, unique: true}, //User's telegram ID
    subscribed: {type: Boolean, default: true}, //Subscription status for newslatters
    lastFakeNews: String, //Last sent fakeNews
    createdAt: {type: Date, default: new Date()} //Time of the creation
});

var dataSchema = Schema({
    _id: Schema.Types.ObjectId,
    name: String, 
    value: String
});

var sourceTelegramSchema = Schema({
    _id: Schema.Types.ObjectId, 
    telegramId: {type: Number, unique: true},
    telegramUsername: String,
    fake: Boolean,
    description: String,
    requestsAmount: {type: Number, default: 0},
    createdAt: {type: Date, default: new Date()}
});

var sourceDomainSchema = Schema({
    _id: Schema.Types.ObjectId, 
    domain: {type: String, unique: true},
    fake: Boolean,
    description: String,
    requestsAmount: {type: Number, default: 0},
    createdAt: {type: Date, default: new Date()}
});

mongoose.model('Request', requestSchema);
mongoose.model('Image', imageSchema);
mongoose.model('Video', videoSchema);
mongoose.model('TelegramUser', telegramUserSchema);
mongoose.model('Data', dataSchema);
mongoose.model('SourceTelegram', sourceTelegramSchema);
mongoose.model('SourceDomain', sourceDomainSchema);
