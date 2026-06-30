const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

router.put('/requests/:id/verify', protect(['Admin', 'Responder']), adminController.verifyAndVerifyRequest);
router.post('/assignments', protect(['Admin']), adminController.assignResponder);
router.get('/responders', protect(['Admin']), adminController.getResponders);

router.get('/sms-inbox', protect(['Admin']), adminController.getSmsInbox);
router.post('/sms-inbox/simulate', adminController.simulateSms);
router.post('/sms-inbox/:id/ingest', protect(['Admin']), adminController.ingestSms);

router.post('/shelters', protect(['Admin']), adminController.createShelter);
router.put('/shelters/:id', protect(['Admin']), adminController.updateShelterOccupancy);

module.exports = router;