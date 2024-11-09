const mongoose = require("mongoose");

const siteSchema = new mongoose.Schema({
  publicVapIdKey: String,
  privateVapIdKey: String,
});

const SiteData = mongoose.model("site-data", siteSchema);

module.exports = SiteData;
