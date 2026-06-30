const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const sequelize = require('./config/db');

const User = require('./models/User');
const EmergencyRequest = require('./models/EmergencyRequest');
const EmergencyAnalysis = require('./models/EmergencyAnalysis');
const AuditLog = require('./models/AuditLog');
const SmsInbox = require('./models/SmsInbox');
const EvacuationShelter = require('./models/EvacuationShelter');
const requestRoutes = require('./routes/requestRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

const authRoutes = require('./routes/authRoutes');
app.use('/api/requests', requestRoutes);
app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: "online", message: "ResQNet operational mesh running cleanly." });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT"]
  }
});

io.on('connection', (socket) => {
  socket.on('disconnect', () => {
  });
});

app.set('io', io);

const PORT = process.env.PORT || 5000;

sequelize.authenticate()
  .then(() => {
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    server.listen(PORT);
  })
  .catch(err => {
    console.error(err);
  });