const express = require("express");
const app = express();
const port = 4000;
const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server, { cors: { origin: "*" } });
const db = require("./db");

const user = require("./models/user");

db();

let rooms = {};
let callUsers = {};
let time;

io.sockets.on("error", (e) => console.log(e));

io.sockets.on("connection", (socket) => {
  try { 
console.log(`Client connected: ${socket.id}`);

socket.on("user:signin", async (loginId) => {
  const users = await user.findOne({ loginId });
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

socket.on("createRoom", ({ roomId }) => {
  console.log(`Room created: ${roomId} by broadcaster ${socket.id}`);
  rooms[roomId] = { broadcaster: socket.id };
  socket.join(roomId);
});

socket.on("joinRoom", ({ roomId }) => {
  console.log(`Client ${socket.id} joining room: ${roomId}`);
  const room = rooms[roomId];

  if (room) {
    socket.join(roomId);
    // Notify broadcaster about new viewer
    io.to(room.broadcaster).emit("viewerJoined", {
      viewerId: socket.id,
      roomId,
    });
    console.log(`Notified broadcaster about new viewer in room: ${roomId}`);
  } else {
    console.log(`Room ${roomId} not found`);
    socket.emit("error", { message: "Room not found" });
  }
});

socket.on("offer", ({ offer, roomId, viewerId }) => {
  console.log(
    `Offer received from broadcaster for viewer ${viewerId} in room: ${roomId}`
  );
  io.to(viewerId).emit("offer", { offer, roomId });
});

socket.on("answer", ({ answer, roomId }) => {
  console.log(`Answer received from ${socket.id} in room: ${roomId}`);
  const room = rooms[roomId];
  if (room) {
    io.to(room.broadcaster).emit("answer", { answer, viewerId: socket.id });
  }
});

// socket.on("iceCandidate", ({ candidate, roomId, to }) => {
//   console.log(`ICE candidate received from ${socket.id} in room: ${roomId}`);
//   if (to) {
//     io.to(to).emit("iceCandidate", { candidate });
//   } else {
//     const room = rooms[roomId];
//     if (room) {
//       // If 'to' is not specified, send to broadcaster
//       io.to(room.broadcaster).emit("iceCandidate", { candidate });
//     }
//   }
// });

socket.on("leaveRoom", ({ roomId }) => {
  console.log(`Client ${socket.id} leaving room: ${roomId}`);
  socket.leave(roomId);

  const room = rooms[roomId];
  if (room && room.broadcaster === socket.id) {
    console.log(`Broadcaster left, closing room: ${roomId}`);
    delete rooms[roomId];
    io.to(roomId).emit("broadcasterLeft");
  }
});

socket.on("disconnect", () => {
  console.log(`Client disconnected: ${socket.id}`);
  Object.values(rooms).forEach((value, key) => {
    if (value.broadcaster === socket.id) {
      console.log(`Broadcaster disconnected, closing room: ${key}`);
      delete rooms[key];
      io.to(key).emit("broadcasterLeft");
    }
  });
});

// ========================================================================= //

socket.on("call:screen:start", async ({ to, from, offer, isScreenShare }) => {
  console.log(`Screen Call request from ${from} to ${to}`);
  const toSocket = await user.findOne({ loginId: to });

  io.to(toSocket.socketId).emit("screen:incomming", {
    from,
    offer,
    isScreenShare,
  });
});

socket.on("call:start", async ({ to, from, offer }) => {
  console.log(`Call request from ${from} to ${to}`);
  const toSocket = await user.findOne({ loginId: to });

  // time = setInterval(() => {

  // }, 1000);

  io.to(toSocket?.socketId).emit("call:incomming", {
    from,
    offer,
  });

  setTimeout(() => {
    clearInterval(time);
  }, 4000);
});

socket.on("call:screen:answer", async ({ to, answer }) => {
  clearInterval(time);

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
  clearInterval(time);

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
  clearInterval(time);

  console.log(`Screen Call rejected by ${from}`);
  const toSocket = await user.findOne({ loginId: to });

  if (toSocket) {
    io.to(toSocket.socketId).emit("call:rejected", {
      from,
    });
  }
});

socket.on("call:reject", async ({ to, from }) => {
  clearInterval(time);

  console.log(`Call rejected by ${from}`);
  const toSocket = await user.findOne({ loginId: to });

  if (toSocket) {
    io.to(toSocket.socketId).emit("call:rejected");
  }
});

socket.on("ice:screen", async ({ candidate, to }) => {
  // clearInterval(time);

  console.log(`Screen ICE candidate for ${to}`);
  const toSocket = await user.findOne({ loginId: to });

  if (toSocket) {
    io.to(toSocket.socketId).emit("ice:screen", {
      candidate,
    });
  }
});

socket.on("ice:call", async ({ candidate, to }) => {
  // clearInterval(time);

  console.log(`ICE candidate for ${to}`);
  const toSocket = await user.findOne({ loginId: to });

  if (toSocket) {
    io.to(toSocket.socketId).emit("ice:call", {
      candidate,
    });
  }
});

socket.on("screen:end", async ({ to }) => {
  clearInterval(time);

  console.log(`Screen Call ended with ${to}`);
  const toSocket = await user.findOne({ loginId: to });

  if (toSocket) {
    io.to(toSocket.socketId).emit("screen:disconnected");
  }
});

socket.on("call:end", async ({ to }) => {
  clearInterval(time);

  console.log(`Call ended with ${to}`);
  const toSocket = await user.findOne({ loginId: to });

  if (toSocket) {
    io.to(toSocket.socketId).emit("user:disconnected");
  }
});

socket.on("disconnect", async () => {
  clearInterval(time);

  console.log(`Socket disconnected: ${socket.id}`);
  const users = await user.find();

  // Remove user from users map
  for (const [userId, socketId] in Object.values(users)) {
    if (socketId === socket.id) {
      const userSocket = await user.find({ socketId: socket.id });
      await user.findByIdAndUpdate(userSocket._id, { socketId: "" });
      io.to(userSocket.socketId).emit("user:disconnected");
      break;
    }
  }

  // Broadcast updated user list
  io.emit("users:get", users);
});
  } catch (err) {
    console.log(err)
  }
  
});

app.get("/", (req, res) => {
  res.send("API WORKING");
});

server.listen(port, () => console.log(`Server is running on port ${port}`));
