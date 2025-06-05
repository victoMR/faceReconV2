const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/constats");

//Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, error: "Token de acceso requerido" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: "Token inválido" });
    }
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
