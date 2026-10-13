const pool = require("./db");

async function testConnection() {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) AS total FROM blogs"
    );

    console.log("Database connected successfully!");
    console.log("Number of blog posts:", result.rows[0].total);
  } catch (error) {
    console.error("Database connection failed:");
    console.error(error.message);
  } finally {
    await pool.end();
  }
}

testConnection();