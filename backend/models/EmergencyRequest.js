const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const EmergencyRequest = sequelize.define('EmergencyRequest', {
  category: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  people_count: { type: DataTypes.INTEGER, defaultValue: 1 },
  latitude: { type: DataTypes.DECIMAL(10, 8), allowNull: false },
  longitude: { type: DataTypes.DECIMAL(11, 8), allowNull: false },
  landmark: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.ENUM('Submitted', 'Under Analysis', 'Verified', 'Assigned', 'Completed'), defaultValue: 'Submitted' }
}, {
  tableName: 'emergency_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

User.hasMany(EmergencyRequest, { foreignKey: 'user_id', onDelete: 'CASCADE' });
EmergencyRequest.belongsTo(User, { foreignKey: 'user_id' });

module.exports = EmergencyRequest;