require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const pool = require("./db");

const app = express();
const PORT = 3000;

console.log("RUNNING THE CORRECT APP.JS FILE");
console.log("Current file:", __filename);

// Configure EJS.
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve CSS and other static files.
app.use(express.static(path.join(__dirname, "public")));

// Read form submissions.
app.use(express.urlencoded({ extended: true }));

// Session middleware.
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // Local HTTP development only.
      maxAge: 1000 * 60 * 60 * 2
    }
  })
);

// Make the signed-in user available to EJS.
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// =====================================
// HOMEPAGE: DISPLAY BLOG POSTS
// =====================================
app.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM blogs ORDER BY date_created DESC"
    );

    console.log("Blog rows retrieved:", result.rows.length);

    return res.render("index", {
      blogs: result.rows
    });
  } catch (error) {
    console.error("Error loading blogs:", error);
    return res.status(500).send(
      "Unable to load blog posts. Check the VS Code terminal."
    );
  }
});

// =====================================
// CREATE A BLOG POST
// =====================================
app.post("/blogs", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/signin");
  }

  const { title, body } = req.body;

  if (
    typeof title !== "string" ||
    typeof body !== "string" ||
    !title.trim() ||
    !body.trim() ||
    title.trim().length > 255
  ) {
    return res.status(400).send(
      "Please provide a title (up to 255 characters) and post content."
    );
  }

  try {
    await pool.query(
      `INSERT INTO blogs
        (creator_name, creator_user_id, title, body, date_created)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        req.session.user.name,
        req.session.user.user_id,
        title.trim(),
        body.trim()
      ]
    );

    console.log("Blog post created by:", req.session.user.user_id);
    return res.redirect("/");
  } catch (error) {
    console.error("Error creating blog post:", error);
    return res.status(500).send(
      "Unable to create blog post. Check the VS Code terminal."
    );
  }
});

// =====================================
// DISPLAY EDIT FORM
// =====================================
app.get("/blogs/:id/edit", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/signin");
  }

  const blogId = req.params.id;

  if (!/^\d+$/.test(blogId)) {
    return res.status(400).send("Invalid blog post ID.");
  }

  try {
    const result = await pool.query(
      `SELECT *
       FROM blogs
       WHERE blog_id = $1
         AND creator_user_id = $2`,
      [blogId, req.session.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(
        "Post not found or you do not have permission to edit it."
      );
    }

    return res.render("edit", {
      blog: result.rows[0]
    });
  } catch (error) {
    console.error("Error loading edit form:", error);
    return res.status(500).send("Unable to load the edit form.");
  }
});

// =====================================
// UPDATE A BLOG POST
// =====================================
app.post("/blogs/:id/edit", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/signin");
  }

  const blogId = req.params.id;
  const { title, body } = req.body;

  if (!/^\d+$/.test(blogId)) {
    return res.status(400).send("Invalid blog post ID.");
  }

  if (
    typeof title !== "string" ||
    typeof body !== "string" ||
    !title.trim() ||
    !body.trim() ||
    title.trim().length > 255
  ) {
    return res.status(400).send(
      "Provide a title of up to 255 characters and post content."
    );
  }

  try {
    const result = await pool.query(
      `UPDATE blogs
       SET title = $1, body = $2
       WHERE blog_id = $3
         AND creator_user_id = $4
       RETURNING blog_id`,
      [
        title.trim(),
        body.trim(),
        blogId,
        req.session.user.user_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(
        "Post not found or you do not have permission to edit it."
      );
    }

    console.log("Blog post updated:", blogId);
    return res.redirect("/");
  } catch (error) {
    console.error("Error updating blog post:", error);
    return res.status(500).send("Unable to update blog post.");
  }
});

// =====================================
// DELETE A BLOG POST
// =====================================
app.post("/blogs/:id/delete", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/signin");
  }

  const blogId = req.params.id;

  if (!/^\d+$/.test(blogId)) {
    return res.status(400).send("Invalid blog post ID.");
  }

  try {
    const result = await pool.query(
      `DELETE FROM blogs
       WHERE blog_id = $1
         AND creator_user_id = $2
       RETURNING blog_id`,
      [blogId, req.session.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(
        "Post not found or you do not have permission to delete it."
      );
    }

    console.log("Blog post deleted:", blogId);
    return res.redirect("/");
  } catch (error) {
    console.error("Error deleting blog post:", error);
    return res.status(500).send("Unable to delete blog post.");
  }
});

// =====================================
// SIGNUP: DISPLAY PAGE
// =====================================
app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

// =====================================
// SIGNUP: CREATE ACCOUNT
// =====================================
app.post("/signup", async (req, res) => {
  const { user_id, password, name } = req.body;

  if (
    typeof user_id !== "string" ||
    typeof password !== "string" ||
    typeof name !== "string" ||
    !user_id.trim() ||
    !password ||
    !name.trim()
  ) {
    return res.status(400).render("signup", {
      error: "Please fill in all fields."
    });
  }

  if (password.length < 8) {
    return res.status(400).render("signup", {
      error: "Your password must be at least 8 characters."
    });
  }

  try {
    const existingUser = await pool.query(
      "SELECT user_id FROM users WHERE user_id = $1",
      [user_id.trim()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).render("signup", {
        error: "That user ID is already taken. Please choose another."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO users (user_id, password, name)
       VALUES ($1, $2, $3)`,
      [user_id.trim(), hashedPassword, name.trim()]
    );

    return res.redirect("/signin");
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).render("signup", {
        error: "That user ID is already taken. Please choose another."
      });
    }

    console.error("Signup error:", error);

    return res.status(500).render("signup", {
      error: "Unable to create your account. Please try again."
    });
  }
});

// =====================================
// SIGNIN: DISPLAY PAGE
// =====================================
app.get("/signin", (req, res) => {
  res.render("signin", { error: null });
});

// =====================================
// SIGNIN: AUTHENTICATE USER
// =====================================
app.post("/signin", async (req, res) => {
  const { user_id, password } = req.body;

  if (
    typeof user_id !== "string" ||
    typeof password !== "string" ||
    !user_id.trim() ||
    !password
  ) {
    return res.status(400).render("signin", {
      error: "Enter your user ID and password."
    });
  }

  try {
    const result = await pool.query(
      "SELECT user_id, password, name FROM users WHERE user_id = $1",
      [user_id.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).render("signin", {
        error: "Invalid user ID or password."
      });
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).render("signin", {
        error: "Invalid user ID or password."
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        console.error("Session error:", error);
        return res.status(500).send(
          "Unable to sign in. Please try again."
        );
      }

      req.session.user = {
        user_id: user.user_id,
        name: user.name
      };

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save error:", saveError);
          return res.status(500).send(
            "Unable to sign in. Please try again."
          );
        }

        return res.redirect("/");
      });
    });
  } catch (error) {
    console.error("Signin error:", error);

    return res.status(500).render("signin", {
      error: "Unable to sign in. Please try again."
    });
  }
});

// =====================================
// SIGNOUT
// =====================================
app.post("/signout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie("connect.sid");
    return res.redirect("/signin");
  });
});

// =====================================
// 404: PAGE NOT FOUND
// Keep this after all routes.
// =====================================
app.use((req, res) => {
  res.status(404).send("Page not found.");
});

// =====================================
// START SERVER
// =====================================
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});