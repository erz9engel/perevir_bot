const passport = require("passport");
const mongoose = require("mongoose");
const router = require("express").Router();
const NewsRequest = mongoose.model('Request');

const statusMapping = {
    'pending': '0',
    'fake': '-1',
    'true': '1'
}
const authenticate = passport.authenticate('jwt', { session: false })

router.get('/', authenticate, async (req, res) => {
    const {status} = req.query;
    const bdQuery = status ? { fakeStatus: statusMapping[status] } : {}
    try {
        const requests = await NewsRequest.find(bdQuery);
        res.send(requests);
    } catch (e) {
        res.send(e)
    }
})

router.get('/my', authenticate, async (req, res) => {
    const {query, user} = req;
    const {status} = query;

    const bdQuery = {
        assignedTo: user._id
    }
    if (status) bdQuery.fakeStatus = statusMapping[status];

    try {
        const requests = await NewsRequest.find(bdQuery);
        res.send(requests);
    } catch (e) {
        res.send(e)
    }
})

router.post('/assign', authenticate, async (req, res) => {
    const { user, body } = req;
    const { moderatorId, newsRequestId } = body;
    if (moderatorId && user._id !== moderatorId && user.role !== 'admin') {
        return res.status(401).send('You`re not authorized to assign to other people');
    }

    try {
        const newsRequest = await NewsRequest.findOne({_id: newsRequestId});
        await newsRequest.update({
            assignedTo: moderatorId ? moderatorId : user._id
        });

        const updatedRequest = await NewsRequest.findOne({_id: newsRequestId}).populate('assignedTo');

        logger.info(updatedRequest);
        res.send(updatedRequest);
    } catch (_) {
        return res.status(404).send('news request not found');
    }
})

module.exports = router