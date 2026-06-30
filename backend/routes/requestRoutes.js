const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const requestController = require('../controllers/requestController');
const { protect } = require('../middleware/authMiddleware');

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

router.post('/', protect(['Citizen']), upload.single('image'), requestController.submitRequest);
router.get('/', protect(['Admin', 'Responder', 'Citizen']), requestController.getAllRequests);

router.get('/shelters', protect(['Admin', 'Responder', 'Citizen']), requestController.getShelters);
router.get('/:id/logs', protect(['Admin', 'Responder', 'Citizen']), requestController.getAuditLogs);

module.exports = router;