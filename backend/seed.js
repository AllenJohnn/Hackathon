const sequelize = require('./config/db');
const User = require('./models/User');
const bcrypt = require('bcrypt');

async function seedData() {
  try {
    await sequelize.sync(); // Connect to the active SQLite file
    
    // Hash a uniform password for easy demo logging
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('p123', salt);

    // 1. Create Citizen Account
    const [citizen, citizenCreated] = await User.findOrCreate({
      where: { email: 'citizen@resqnet.org' },
      defaults: { name: 'John Doe', phone: '9876543210', password: hashedPassword, role: 'Citizen' }
    });
    if (!citizenCreated) {
      citizen.password = hashedPassword;
      await citizen.save();
    }

    // 2. Create Admin Account
    const [admin, adminCreated] = await User.findOrCreate({
      where: { email: 'admin@resqnet.org' },
      defaults: { name: 'Commander Allen', phone: '9998887776', password: hashedPassword, role: 'Admin' }
    });
    if (!adminCreated) {
      admin.password = hashedPassword;
      await admin.save();
    }

    // 3. Create Responder Account
    const [responder, responderCreated] = await User.findOrCreate({
      where: { email: 'responder@resqnet.org' },
      defaults: { name: 'Rescue Unit Alpha', phone: '5554443332', password: hashedPassword, role: 'Responder' }
    });
    if (!responderCreated) {
      responder.password = hashedPassword;
      await responder.save();
    }

    console.log('✅ DEMO ACCOUNTS INJECTED INTO PORTAL STORAGE.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Data injection loop failed:', error);
    process.exit(1);
  }
}

seedData();