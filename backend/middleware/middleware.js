const { pool } = require("../config/database");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/constats");

//Middleware for token authentication
const authenticateToken =
  (allowedTypes = []) =>
  async (req, res, next) => {
    //Here we check if the request has an Authorization header and we extract the token
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Token de acceso requerido",
        shouldLogout: true, //This is a signal to the frontend to handle logout
      });
    }

    try {
      let decodedToken;
      try {
        decodedToken = jwt.verify(token, JWT_SECRET);
        console.log("[Auth] JWT válido para usuario:", decodedToken.email);
      } catch (jwtError) {
        console.error("[Auth] Error verificando JWT:", jwtError.message);

        let errorMessage = "Token inválido";
        if (jwtError.name === "TokenExpiredError") {
          errorMessage = "Token ha expirado";
        } else if (jwtError.name === "JsonWebTokenError") {
          errorMessage = "Token malformado o inválido";
        } else if (jwtError.name === "NotBeforeError") {
          errorMessage = "Token no es válido aún";
        }

        return res.status(401).json({
          success: false,
          error: errorMessage,
          shouldLogout: true,
        });
      }

      //Search for the token in the login_sessions table to verify its validity
      const sessionResult = await pool.query(
        `SELECT ls.user_id, ls.expires_at, ls.is_active, u.email, u.first_name, u.last_name
       FROM login_sessions ls 
       JOIN users u ON u.id = ls.user_id 
       WHERE ls.token = $1 AND ls.is_active = true`,
        [token]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: "Token inválido o no encontrado",
          shouldLogout: true,
        });
      }

      const sessionData = sessionResult.rows[0];
      const now = new Date();

      //Verification of token expiration
      if (new Date(sessionData.expires_at) < now) {
        //Desactivate the session if the token has expired
        await pool.query(
          "UPDATE login_sessions SET is_active = false WHERE token = $1",
          [token]
        );

        return res.status(401).json({
          success: false,
          error: "Token ha expirado",
          shouldLogout: true,
        });
      }

      //In case there are allowed user types, we check if the user has the required permissions
      //At the moment there are no user types in the table but it'ill be soon
      if (allowedTypes.length > 0) {
        const userTypeResult = await pool.query(
          "SELECT type FROM users WHERE id = $1",
          [sessionData.user_id]
        );

        if (userTypeResult.rows.length === 0) {
          return res.status(403).json({
            success: false,
            error: "Usuario no encontrado",
            shouldLogout: true,
          });
        }

        const userType = userTypeResult.rows[0].type;
        if (!allowedTypes.includes(userType)) {
          return res.status(403).json({
            success: false,
            error: "Acceso denegado. Permisos insuficientes",
          });
        }
      }

      //Add user information to the request object
      req.user = {
        userId: sessionData.user_id,
        email: sessionData.email,
        firstName: sessionData.first_name,
        lastName: sessionData.last_name,
      };

      next();
    } catch (error) {
      console.error("Error al verificar el token:", error);
      res.status(500).json({
        success: false,
        error: "Error interno del servidor al verificar el token",
        shouldLogout: true,
      });
    }
  };

module.exports = { authenticateToken };
