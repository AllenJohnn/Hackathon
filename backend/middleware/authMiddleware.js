const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hackathon_key';

const protect = (roles = []) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No system token provided.' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;

      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ message: 'Access forbidden: Insufficient operational clearance.' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Session expired or token verification failed.' });
    }
  };
};

module.exports = { protect };