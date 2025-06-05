const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "config.env") });

//Configs
const { PORT } = require("./config/constats");
const { specs, swaggerUi } = require("./config/swagger");

//Routes
const routes = require("./router/routes");

//Services
const { connectDatabase } = require("./services/database.service");

const app = express();

//UI Swagger configuration
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "API Facial Auth - Documentación",
    swaggerOptions: {
      persistAuthorization: true,
      displayOperationId: false,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  })
);

//Security middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(compression());
app.use(morgan("combined"));

//Rate limiting
const limiter = rateLimit({
  windowMs: (Number.parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
  max: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: "Demasiadas peticiones, intente más tarde",
  },
});
app.use("/api/", limiter);

//Middlewares
app.use(cors());
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || "10mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.MAX_FILE_SIZE || "10mb",
  })
);

//Api's routes
app.use("/api", routes);

//Error handling for undefined routes
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint no encontrado",
  });
});

//Global error handler
app.use((err, req, res, next) => {
  console.error("Error no manejado:", err);
  res.status(500).json({
    success: false,
    error: "Error interno del servidor",
  });
});

//Start server and connect to database
async function startServer() {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      console.log(`\n🚀 Servidor iniciado exitosamente`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(
        `📚 Documentación Swagger: http://localhost:${PORT}/api/docs`
      );
      console.log(`🗄️  Base de datos: PostgreSQL (Neon)`);
      console.log(`⏰ Hora: ${new Date().toLocaleString("es-ES")}`);
      console.log(`\n📋 Endpoints disponibles:`);
      console.log(`   GET  /api/health - Estado del servidor`);
      console.log(`   POST /api/auth/register - Registro de usuario`);
      console.log(`   POST /api/auth/login - Login con credenciales`);
      console.log(`   POST /api/auth/logout - Logout`);
      console.log(`   POST /api/face/enroll - Enrollar embeddings faciales`);
      console.log(`   POST /api/face/login - Login facial`);
      console.log(`   GET  /api/user/profile - Perfil de usuario`);
      console.log(`   GET  /api/dashboard/stats - Estadísticas del dashboard`);
      console.log(
        `   DELETE /api/user/biometric - Eliminar datos biométricos\n`
      );
    });
  } catch (error) {
    console.error("❌ Error iniciando servidor:", error);
    process.exit(1);
  }
}

//Handle shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Cerrando servidor...");
  const { pool } = require("./config/database");
  await pool.end();
  console.log("✅ Conexiones de base de datos cerradas");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Cerrando servidor...");
  const { pool } = require("./config/database");
  await pool.end();
  console.log("✅ Conexiones de base de datos cerradas");
  process.exit(0);
});

startServer();
