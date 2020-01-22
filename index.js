const express = require("express");
const errorHandler = require("errorhandler");
const WebSocket = require("ws");
const http = require("http");

const app = express();

// Error handler
if (process.env.NODE_ENV === "dev") {
  // only use in development
  app.use(errorHandler());
}

//initialize a http server
const server = http.createServer(app);

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

let users = {};

const sendTo = (connection, message) => {
  connection.send(JSON.stringify(message));
};

const sendToAll = (clients) => {
  const users = Object.keys(clients);
  users.forEach(user => {
    let client = clients[user];
    const loggedIn = users
      .filter(user => user !== client.name)
      .map(user => ({ userName: user }));

      client.send(JSON.stringify({
        type: "updateUsers",
        users: loggedIn
      }));
  })
}

wss.on("connection", ws => {
  console.log("User connected");
  //connection is up, let's add a simple simple event
  ws.on("message", msg => {
    console.log({ msg })
    //log the received message and send it back to the client
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
          users[data.name] = ws;
          ws.name = data.name;
          const loggedIn = Object.keys(users)
            .filter(user => user !== ws.name)
            .map(user => ({ userName: user }));

          sendTo(ws, {
            type: "login",
            success: true,
            users: loggedIn
          });
          sendToAll(users);
        }
        break;
      case "offer":
        console.log("Sending offer to: ", data.name); 
        //if UserBexists then send him offer details 
        let recipient = users[data.name]; 
       
        if(!!recipient){ 
           //setting that sender connected with recipient
           ws.otherName = data.name; 
           sendTo(recipient, { 
              type: "offer", 
              offer: data.offer, 
              name: ws.name 
           }); 
        }
        break;
      case "answer": 
        console.log("Sending answer to: ", data.name); 
        //for ex. UserB answers UserA 
        recipient = users[data.name]; 
       
        if(!!recipient) { 
           ws.otherName = data.name; 
           sendTo(recipient, { 
              type: "answer", 
              answer: data.answer 
           }); 
        }
        break;
      case "candidate": 
        console.log("Sending candidate to:",data.name); 
        recipient = users[data.name]; 
       
        if(!!recipient) {
           sendTo(recipient, { 
              type: "candidate", 
              candidate: data.candidate 
           }); 
        }
        break;
      case "leave": 
        console.log("Disconnecting from", data.name); 
        recipient = users[data.name]; 
        recipient.otherName = null; 
       
        //notify the other user so he can disconnect his peer connection 
        if(!!recipient) { 
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
    if(ws.name) { 
       delete users[ws.name]; 
       if(ws.otherName) { 
          console.log("Disconnecting from ", ws.otherName); 
          const recipient = users[ws.otherName]; 
          recipient.otherName = null;
       
          if(!!recipient) { 
             sendTo(recipient, { 
                type: "leave" 
             }); 
          }  
       } 
    } 
 });
  //send immediatly a feedback to the incoming connection
  ws.send(JSON.stringify({
    type: "connect",
    message: "Well hello there, I am a WebSocket server"
  }));
});

//start our server
server.listen(9000, () => {
  console.log(`Server started on port ${server.address().port} :)`);
});
