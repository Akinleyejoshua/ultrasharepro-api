const express = require("express");
const app = express();
const port = 4000;
const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server, { cors: { origin: "*" } });
const db = require("./db");

const user = require("./models/user");

db();

let onCalls = {};

const addToOnCalls = async (from, to) => {
  const fromSocket = await user.findOne({ loginId: from });
  const toSocket = await user.findOne({ loginId: to });

  onCalls[to] = {
    from: fromSocket?.socketId,
    to: toSocket?.socketId,
  };
};

io.sockets.on("error", (e) => console.log(e));

io.sockets.on("connection", (socket) => {
  try {
    console.log(`Client connected: ${socket.id}`);

    socket.on("user:signin", async (loginId) => {
      const users = await user.findOne({ loginId: loginId.replace(" ", "") });
      if (users) {
        await user.findByIdAndUpdate(users._id, {
          socketId: socket.id,
          is_active: true,
          lastActive: Date.now(),
        });

        socket.emit("auth:access-granted", loginId);
      } else {
        const newUser = new user({
          loginId,
          socketId: socket.id,
          is_active: true,
          lastActive: Date.now(),
        });
        if (newUser.save()) {
          socket.emit("auth:access-granted", loginId);
        }
      }

      console.log(`${loginId} access granted`);
      const allUsers = await user.find();
      socket.broadcast.emit("users:get", allUsers);
    });

    socket.on("user:logout", async (loginId) => {
      const currentUser = await user.findOne({ loginId });
      if (currentUser) {
        await user.findByIdAndUpdate(currentUser._id, {
          is_active: false,
          lastActive: Date.now(),
        });
        const allUsers = await user.find();
        socket.broadcast.emit("users:get", allUsers);
        socket.emit("user:logout");
      }
    });

    socket.on("users:get", async () => {
      const allUsers = await user.find();
      socket.emit("users:get", allUsers);
    });

    socket.on(
      "call:screen:start",
      async ({ to, from, offer, isScreenShare }) => {
        console.log(`Screen Call request from ${from} to ${to}`);
        const toSocket = await user.findOne({ loginId: to });

        io.to(toSocket?.socketId).emit("screen:incomming", {
          from,
          offer,
          isScreenShare,
        });
      }
    );

    socket.on("call:start", async ({ to, from, offer }) => {
      console.log(`Call request from ${from} to ${to}`);
      const toSocket = await user.findOne({ loginId: to });

      if (toSocket?.is_busy) {
        socket.emit("call:busy");
      } else {
        await addToOnCalls(from, to);

        io.to(toSocket?.socketId).emit("call:incomming", {
          from,
          offer,
          to,
        });
      }
    });

    socket.on("call:screen:answer", async ({ to, answer }) => {
      console.log(`Screen Call answered by ${socket.id} to ${to}`);
      const toSocket = await user.findOne({ loginId: to });

      if (toSocket) {
        io.to(toSocket.socketId).emit("call:screen:accepted", {
          answer,
          to,
        });
      }
    });

    socket.on("call:answer", async ({ to, answer }) => {
      console.log(`Call answered by ${socket.id} to ${to}`);
      const toSocket = await user.findOne({ loginId: to });

      if (toSocket) {
        io.to(toSocket.socketId).emit("call:accepted", {
          answer,
          to,
        });
      }
    });

    socket.on("call:screen:rejected", async ({ to, from }) => {
      console.log(`Screen Call rejected by ${from}`);
      const toSocket = await user.findOne({ loginId: to });

      if (toSocket) {
        io.to(toSocket.socketId).emit("call:rejected", {
          from,
        });
      }
    });

    socket.on("call:reject", async ({ to, from }) => {
      console.log(`Call rejected by ${from}`);
      const toSocket = await user.findOne({ loginId: to });

      if (toSocket) {
        io.to(toSocket.socketId).emit("call:rejected");
      }
    });

    socket.on("ice:screen", async ({ candidate, to }) => {
      //

      console.log(`Screen ICE candidate for ${to}`);
      const toSocket = await user.findOne({ loginId: to });

      if (toSocket) {
        io.to(toSocket.socketId).emit("ice:screen", {
          candidate,
        });
      }
    });

    socket.on("ice:call", async ({ candidate, to }) => {
      //

      console.log(`ICE candidate for ${to}`);
      const toSocket = await user.findOne({ loginId: to });

      if (toSocket) {
        io.to(toSocket.socketId).emit("ice:call", {
          candidate,
        });
      }
    });

    socket.on("screen:end", async ({ to }) => {
      console.log(`Screen Call ended with ${to}`);
      const toSocket = await user.findOne({ loginId: to });

      if (toSocket) {
        io.to(toSocket.socketId).emit("screen:disconnected");
      }
    });

    socket.on("call:end", async ({ to }) => {
      console.log(`Call ended with ${to}`);
      const toSocket = await user.findOne({ loginId: to });

      if (toSocket) {
        io.to(toSocket.socketId).emit("user:disconnected");
        io.to(toSocket.socketId).emit("screen:disconnected");
      }
    });

    socket.on("disconnect", async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      const users = await user.find();

      // Remove user from users map
      for (const item of users) {
        io.to(onCalls[item?.loginId]?.from).emit("user:disconnected");
        io.to(onCalls[item?.loginId]?.to).emit("user:disconnected"); 
      }
      
        await user.findOne({ socketId: socket?.id }).updateOne({
          is_active: false,
          lastActive: Date.now(),
        });
            
      // Broadcast updated user list
      io.emit("users:get", await user.find());
    });
  } catch (err) {
    console.log(err);
  }
});

app.get("/", (req, res) => {
  res.send("API WORKING");
});

server.listen(port, () => console.log(`Server is running on port ${port}`));
