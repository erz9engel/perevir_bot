const mongoose = require("mongoose");
const Request = mongoose.model('Request');
const {onNeedUpdate, onTakenRequest, onBackRequest} = require('./query-callbacks');
const {delay} = require('./utils');

async function onTryToUpdate (bot) {
    var requests = await Request.find({"needUpdate": true}).populate('moderator');
    console.log("Found " + requests.length + ' requests that needs to be updated in channel')
    for (var i in requests) {
        if (requests[i].fakeStatus != 0) {
            await onNeedUpdate(requests[i], bot); 
        } else if (requests[i].takenModerator) {
            await onTakenRequest(requests[i], bot);
        } else if (requests[i].takenModerator == null) {
            await onBackRequest(requests[i], bot);
        }
        await Request.findByIdAndUpdate(requests[i]._id, {"needUpdate": false});
        await delay(100);
    }
    await delay(1000);
    onTryToUpdate(bot);
}

module.exports = {
    onTryToUpdate
}