// // message.socket.test.js
// const { io } = require("socket.io-client");
// const jwt = require('jsonwebtoken');

// describe("Message Socket.IO Tests", () => {
//   let socket;
//   const serverUrl = "http://localhost:3000";
  
//   // Create valid token with user IDs from your database
//   const token = jwt.sign({ userId: "test-user-id" }, process.env.JWT_SECRET);
//   const senderId = "test-user-id";
//   const receiverId = "test-recipient-id";
  
//   beforeAll((done) => {
//     // Connect with auth token
//     socket = io(serverUrl, {
//       auth: { token }
//     });
    
//     socket.on("connect", () => {
//       socket.emit("register", senderId, (response) => {
//         done();
//       });
//     });
//   });

//   afterAll(() => {
//     if (socket.connected) {
//       socket.disconnect();
//     }
//   });

//   test("should send and receive a message", (done) => {
//     // Listen for message confirmation
//     socket.once("message_sent", (message) => {
//       expect(message).toBeDefined();
//       expect(message.senderId).toBe(senderId);
//       expect(message.receiverId).toBe(receiverId);
//       expect(message.content).toBe("Test message");
//       done();
//     });
    
//     // Send a message
//     socket.emit("send_message", {
//       senderId,
//       receiverId,
//       content: "Test message"
//     });
//   });
// });