const mongoose = require("mongoose");
const router = require("express").Router();
const NewsRequest = mongoose.model('Request');

router.get('/api/news', async (req, res) => {
    console.log(1)
    try {
        const requests = await NewsRequest.find({}).populate('video');
        res.send(requests);
    } catch (e) {
        res.send(e)
    }
})

module.exports = router