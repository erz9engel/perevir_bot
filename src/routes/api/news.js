const passport = require("passport");
const mongoose = require("mongoose");
const router = require("express").Router();
const NewsRequest = mongoose.model('Request');

const statusMapping = {
    'pending': '0',
    'fake': '-1',
    'true': '1'
}

router.get('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
    const {status} = req.query;
    const bdQuery = status ? { fakeStatus: statusMapping[status] } : {}
    try {
        const requests = await NewsRequest.find(bdQuery);
        res.send(requests);
    } catch (e) {
        res.send(e)
    }
})

module.exports = router