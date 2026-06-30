const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const EmergencyRequest = require('./EmergencyRequest');

const AuditLog = sequelize.define('AuditLog', {
  action: { type: DataTypes.STRING, allowNull: false },
  details: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

EmergencyRequest.hasMany(AuditLog, { foreignKey: 'request_id', onDelete: 'CASCADE' });
AuditLog.belongsTo(EmergencyRequest, { foreignKey: 'request_id' });

module.exports = AuditLog;
