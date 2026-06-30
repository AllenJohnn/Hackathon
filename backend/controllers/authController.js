const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hackathon_key';

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'Citizen'
    });

    res.status(201).json({ message: 'User registered successfully!', userId: newUser.id });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed.', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Authentication successful.',
      token,
      user: { id: user.id, name: user.name, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed.', error: error.message });
  }
};