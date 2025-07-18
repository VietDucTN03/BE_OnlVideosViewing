const express = require("express");

const Channel = require("../../models/user/channel");

const { Server } = require("socket.io");
const { createServer } = require("http");

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.URL_CLIENT,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`👋🏻 ${socket.id} has joined the connection.`);

  // Server sends an event to all clients
  io.emit("send-socket-id", socket.id);

  socket.on("disconnect", () => {
    console.log(`👋🏻 ${socket.id} has disconnected.`);
  });

  socket.on("user-login", async ({ userId }) => {
    try {
      socket.join(userId);
      console.log(`✅ User ${userId} đã join phòng cá nhân ${userId}`);
    } catch (err) {
      console.error("❌ Lỗi khi join phòng channel sau login:", err);
    }
  });

  socket.on("subscribe-channel", async ({ channelId, userId }) => {
    if (channelId !== userId) {
      socket.join(channelId);
      console.log(`👉 User ${userId} joined room: ${channelId}`);
    } else {
      console.log(
        `⚠️ User ${userId} không cần join kênh chính họ (${channelId})`
      );
    }

    try {
      const channel = await Channel.findById(channelId);

      const user = await Channel.findById(userId);

      if (!channel) {
        console.log("Kênh không tồn tại");
        return;
      }

      if (!user) {
        console.log("User không tồn tại");
        return;
      }

      // Phát sự kiện thông báo đến tất cả các client trong kênh
      io.to(channelId).emit("notification-sub-successful", {
        channelId,
        userId,
      });
    } catch (error) {
      console.error("Lỗi khi xử lý subscribe-channel:", error);
    }
  });

  socket.on("unsubscribe-channel", ({ channelId, userId }) => {
    socket.leave(channelId);
    console.log("👉 Left room:", channelId);
    // io.to(channelId).emit("new-unsubscription", {
    //   channelId,
    //   userId,
    // });
  });
});

module.exports = { io, httpServer, app };
