const bcrypt = require("bcrypt");

async function main() {
  const users = [
    { user_id: "john123", password: "JohnBlog2026!" },
    { user_id: "sarah123", password: "SarahBlog2026!" },
    { user_id: "mike123", password: "MikeBlog2026!" }
  ];

  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 10);
    console.log(`${user.user_id}: ${hash}`);
  }
}

main().catch(console.error);