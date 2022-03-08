const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;

const requestSchema = Schema({
    _id: Schema.Types.ObjectId, //Request ID
    requesterTG: Number, //Telegram ID of requester | REMOVE after migration
    requesterMsgID: Number, //Telegram message ID
    moderatorMsgID: Number, //Telegram message ID of resent message
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Moderator' },
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
    text: {type: String, index: true}, //Text of the message
    searchPhrase: String, //Processed text for search
    tags: [String], //Tags, each separate
    commentChatId: Number, //Telegram ID of moderator of the comment
    commentMsgId: Number, //Telegram message ID of comment message
    fakeStatus: {type: Number, default: 0}, //Request Fake status: 0 - uncertain, 1 - not fake, -1 - fake
    lastUpdate: {type: Date, default: new Date()}, //Time of last setting update
    createdAt: {type: Date, default: new Date()} //Time of the creation
});

const imageSchema = Schema({
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

const videoSchema = Schema({
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

const telegramUserSchema = Schema({
    _id: Schema.Types.ObjectId, //User ID
    telegramID: {type: Number, unique: true}, //User's telegram ID
    subscribed: {type: Boolean, default: true}, //Subscription status for newslatters
    createdAt: {type: Date, default: new Date()} //Time of the creation
});

const dataSchema = Schema({
    _id: Schema.Types.ObjectId, //Video ID
    name: String, //Name
    value: String, //Value
});

const moderatorSchema = new Schema({
    username: {
        type: Schema.Types.String, //telegram username
        unique: true
    },
    password: {
        type: Schema.Types.String,
        select: false
    },
    role: {
        type: Schema.Types.String,
        enum: ['admin', 'moderator', 'unverified']
    }
})

moderatorSchema.pre("save", function (next) {
    const user = this

    if (this.isModified("password") || this.isNew) {
        bcrypt.genSalt(10, function (saltError, salt) {
            if (saltError) {
                return next(saltError)
            } else {
                bcrypt.hash(user.password, salt, function(hashError, hash) {
                    if (hashError) {
                        return next(hashError)
                    }

                    user.password = hash
                    next()
                })
            }
        })
    } else {
        return next()
    }
})

moderatorSchema.methods.comparePassword = function(password) {
    const user = this;
    return new Promise((resolve, reject) =>
        bcrypt.compare(password, user.password, function(error, isMatch) {
            if (error) return reject(error);
            if (!isMatch) return reject(new Error('passwords doesn`t match'));
            resolve(isMatch)
    }))
}

requestSchema.index({ text: 'text'});

mongoose.model('Request', requestSchema);
mongoose.model('Image', imageSchema);
mongoose.model('Video', videoSchema);
mongoose.model('TelegramUser', telegramUserSchema);
mongoose.model('Data', dataSchema);
mongoose.model('Moderator', moderatorSchema);
