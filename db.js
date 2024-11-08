const mongoose = require("mongoose");

mongoose.set("strictQuery", false);
// const MONGO_URI = "mongodb://127.0.0.1:27017/ultrashare";
const MONGO_URI = "mongodb+srv://ultrashare:ultrashare1@cluster0.phmxd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

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
