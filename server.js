const express = require("express");
const path = require("path");
const { generateTempToken } = require("./tokenGenerator");

const app = express();
const PORT = 8000;

// eslint-disable-next-line no-undef
app.use(express.static(path.join(__dirname, "public")));

app.get("/token", async (req, res) => {
  try {
    const token = await generateTempToken(600); // 10 minutes for better user experience
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate token" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
