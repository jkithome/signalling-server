const express = require("express");
const WebSocket = require("ws");
const http = require("http");

const app = express();

const port = process.env.PORT || 9000;

//initialize a http server
const server = http.createServer(app);

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

let users = {};

const sendTo = (connection, message) => {
  connection.send(JSON.stringify(message));
};

const pushNewUser = (clients, { name: userName }) => {
  Object.keys(clients).forEach(key=> {
    const client = clients[key];
    if(client.name !== userName) {
      client.send(
        JSON.stringify({
          type: "updateUsers",
          user: { userName }
        })
      );
    }
  })
};

wss.on("connection", ws => {
  ws.on("message", msg => {
    console.log("Received message: %s", msg);
    let data;

    //accepting only JSON messages
    try {
      data = JSON.parse(msg);
    } catch (e) {
      console.log("Invalid JSON");
      data = {};
    }
    switch (data.type) {
      //when a user tries to login
      case "login":
        //Check if username is available
        if (users[data.name]) {
          sendTo(ws, {
            type: "login",
            success: false,
            message: "Username is unavailable"
          });
        } else {
          const loggedIn = Object.keys(users).map(user => ({ userName: user }));
          users[data.name] = ws;
          ws.name = data.name;

          sendTo(ws, {
            type: "login",
            success: true,
            users: loggedIn
          });
          pushNewUser(users, ws);
        }
        break;
      case "offer":
        //if UserBexists then send him offer details
        const offerRecipient = users[data.name];

        if (!!offerRecipient) {
          //setting that sender connected with cecipient
          ws.otherName = data.name;
          sendTo(offerRecipient, {
            type: "offer",
            offer: data.offer,
            name: ws.name
          });
        }
        break;
      case "answer":
        //for ex. UserB answers UserA
        const answerRecipient = users[data.name];

        if (!!answerRecipient) {
          ws.otherName = data.name;
          sendTo(answerRecipient, {
            type: "answer",
            answer: data.answer
          });
        }
        break;
      case "candidate":
        const candidateRecipient = users[data.name];

        if (!!candidateRecipient) {
          sendTo(candidateRecipient, {
            type: "candidate",
            candidate: data.candidate
          });
        }
        break;
      case "leave":
        recipient = users[data.name];

        //notify the other user so he can disconnect his peer connection
        if (!!recipient) {
          recipient.otherName = null;
          sendTo(recipient, {
            type: "leave"
          });
        }
        break;
      default:
        sendTo(ws, {
          type: "error",
          message: "Command not found: " + data.type
        });
        break;
    }
  });

  ws.on("close", function() {
    if (ws.name) {
      delete users[ws.name];
      if (ws.otherName) {
        console.log("Disconnecting from ", ws.otherName);
        const recipient = users[ws.otherName];
        if (!!recipient) {
          recipient.otherName = null;
          sendTo(recipient, {
            type: "leave"
          });
        }
      }
    }
  });
  //send immediatly a feedback to the incoming connection
  ws.send(
    JSON.stringify({
      type: "connect",
      message: "Well hello there, I am a WebSocket server"
    })
  );
});

//start our server
server.listen(port, () => {
  console.log(`Server started on port ${server.address().port} :)`);
});
