const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  loginId: String,
  socketId: String,
  lastActive: Number,
  is_active: Boolean,
  is_busy: Boolean,
  pushSubscription: mongoose.Schema.Types.Mixed,
});

const User = mongoose.model("user", userSchema);

module.exports = User;
