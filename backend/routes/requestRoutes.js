const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const requestController = require('../controllers/requestController');
const { protect } = require('../middleware/authMiddleware');

// Ensure uploads folder exists
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

// Citizens push requests; Admins, Responders and Citizens can fetch requests (with scoping)
router.post('/', protect(['Citizen']), upload.single('image'), requestController.submitRequest);
router.get('/', protect(['Admin', 'Responder', 'Citizen']), requestController.getAllRequests);

module.exports = router;