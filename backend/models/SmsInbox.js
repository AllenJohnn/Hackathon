const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const SmsInbox = sequelize.define('SmsInbox', {
  sender_phone: { type: DataTypes.STRING, allowNull: false },
  raw_message: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.ENUM('Pending', 'Ingested'), defaultValue: 'Pending' }
}, {
  tableName: 'sms_inbox',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = SmsInbox;
