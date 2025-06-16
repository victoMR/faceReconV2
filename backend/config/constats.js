module.exports = {
  PORT: process.env.PORT || 8000,
  JWT_SECRET:
    process.env.JWT_SECRET || "facial_auth_secret_key_2024_neon_postgresql",
  SESSION_TIMEOUT: process.env.SESSION_TIMEOUT || "24h",
  SIMILARITY_THRESHOLD: 0.85, // 85% of similarity threshold (increased for more security)
  MIN_CONFIDENCE_THRESHOLD: 0.85, // 85% for high confidence
};
