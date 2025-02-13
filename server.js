import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());

let players = [];
let roles = ["Raja", "Mantri", "Police", "Chor"];
let currentRound = 0;
let scores = {};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  
  socket.on("joinGame", (name) => {
    if (players.length < 4) {
      players.push({ id: socket.id, name, score: 0 });
      console.log(`${name} joined the game`);
      scores[socket.id] = 0;

      io.emit("updatePlayers", players);

      
      if (players.length === 4) {
        startGame();
      }
    } else {
      socket.emit("error", "Game is full");
    }
  });

  
  const startGame = () => {
    console.log("Game started!");
    shuffleRoles();
    io.emit("gameStart", { players, roles, scores, round: currentRound + 1 });
  };

  const shuffleRoles = () => {
    const shuffledRoles = [...roles].sort(() => Math.random() - 0.5);
    players.forEach((player, index) => {
      player.role = shuffledRoles[index];
    });
    console.log("Roles assigned:", players);
  };

  
  socket.on("guessChor", ({ guessId }) => {
    const police = players.find((player) => player.role === "Police");
    const chor = players.find((player) => player.role === "Chor");

    if (police && chor) {
      if (chor.id === guessId) {
        
        scores[police.id] += 100;
        scores[chor.id] += 0;
      } else {
        
        scores[police.id] += 0;
        scores[chor.id] += 100;
      }

      io.emit("roundResult", { scores, correctGuess: chor.id === guessId });
      nextRound();
    }
  });

  const nextRound = () => {
    currentRound++;

    
    players.forEach((player) => {
      if (player.role === "Raja") {
        scores[player.id] += 1000; 
      } else if (player.role === "Mantri") {
        scores[player.id] += 600; 
      }
    });

    if (currentRound >= 10) {
      endGame();
    } else {
      shuffleRoles();
      io.emit("nextRound", { players, roles, scores, round: currentRound + 1 });
    }
  };

  const endGame = () => {
    const winner = players.reduce((max, player) =>
      scores[player.id] > scores[max.id] ? player : max
    );
    io.emit("gameEnd", { winner, scores });
    resetGame();
  };

  const resetGame = () => {
    players = [];
    scores = {};
    currentRound = 0;
  };

  
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    players = players.filter((player) => player.id !== socket.id);
    io.emit("updatePlayers", players);
  });

  
  socket.on("send_message", (data) => {
    io.emit("receive_message", { ...data, sender: socket.id });
  });
});

server.listen(5000, "0.0.0.0", () => {
  console.log("Backend running on port 5000");
});
