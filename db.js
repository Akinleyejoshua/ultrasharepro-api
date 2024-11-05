const mongoose = require("mongoose");

mongoose.set("strictQuery", false);
const MONGO_URI = "mongodb://127.0.0.1:27017/ultrashare";

const connect = async () => {
  await mongoose
    .connect(MONGO_URI, {})
    .then((res) => {
      if (res) return console.log("Database Connected");
      console.log("MongoDB Database Connection Failed");
    })
    .catch((err) => {
      console.log("MongoDB Database Connection Failed: " + err);
    });
};

module.exports = connect;
