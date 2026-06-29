const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

// Verify/status updates can be made by Admins or Responders (with controller-level restrictions)
router.put('/requests/:id/verify', protect(['Admin', 'Responder']), adminController.verifyAndVerifyRequest);
router.post('/assignments', protect(['Admin']), adminController.assignResponder);
router.get('/responders', protect(['Admin']), adminController.getResponders);

module.exports = router;