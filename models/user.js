const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  loginId: String,
  socketId: String,
  lastActive: Number,
  is_active: Boolean,
  is_busy: Boolean,
});

const User = mongoose.model("user", userSchema);

module.exports = User;
