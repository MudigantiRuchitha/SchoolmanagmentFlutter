const { verifyToken } = require('../utils/jwt');
const db = require('../config/db');

async function deviceAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // If no token, allow request to proceed so controllers can inspect query/body parameters (e.g. UserId)
  if (!token) {
    return next();
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    req.token = token;
    next();
  } catch (err) {
    // If token verification fails, allow next() so controller can check alternative parameters
    next();
  }
}

module.exports = deviceAuth;
