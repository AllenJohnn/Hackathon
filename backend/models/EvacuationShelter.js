const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const EvacuationShelter = sequelize.define('EvacuationShelter', {
  name: { type: DataTypes.STRING, allowNull: false },
  latitude: { type: DataTypes.DECIMAL(10, 8), allowNull: false },
  longitude: { type: DataTypes.DECIMAL(11, 8), allowNull: false },
  capacity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
  occupied: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'evacuation_shelters',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = EvacuationShelter;
