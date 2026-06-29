const express = require('express');
const cors = require('cors');
const sequelize = require('./config/db');

const User = require('./models/User');
const EmergencyRequest = require('./models/EmergencyRequest');

const app = express();
app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/authRoutes');

// Mount routes below app.use(express.json());
app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: "online", message: "ResQNet operational mesh running cleanly." });
});

const PORT = 5000;

sequelize.authenticate()
  .then(() => {
    console.log('🔄 Connected to SQLite Database securely.');
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    console.log('📊 Structural schemas successfully synced.');
    app.listen(PORT, () => console.log(`🚀 ResQNet Backend active on port: ${PORT}`));
  })
  .catch(err => {
    console.error('❌ Database boot framework crashed:', err);
  });