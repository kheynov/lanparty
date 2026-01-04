import WebSocket, { WebSocketServer } from "ws";
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { RoomManager } from "./room-manager.js";
import { ClientMessage } from "../shared/game-types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Always read HTML files from src/client (source files, no need for dist/)
// __dirname is dist/server, so we go: dist/server -> dist -> project root -> src/client
const projectRoot = path.resolve(__dirname, "..", "..");
const clientPath = path.join(projectRoot, "src", "client");

// Serve static files from dist directory (for compiled JS/CSS if any)
app.use(express.static(path.join(__dirname, "..")));

// Serve client HTML files directly from source (no need for dist/)
app.get("/control", (_req, res) => {
  res.sendFile(path.join(clientPath, "control.html"));
});

// Also serve display.html for root path
app.get("/", (_req, res) => {
  res.sendFile(path.join(clientPath, "display.html"));
});

// WebSocket server
const wss = new WebSocketServer({ server });

const roomManager = new RoomManager();
// Временно: создаем одну общую комнату для всех
const DEFAULT_ROOM_CODE = "DEFAULT";
const defaultRoomCode = roomManager.createRoom();
const defaultGameManager = roomManager.getRoom(defaultRoomCode)!;
defaultGameManager.setRoomCode(DEFAULT_ROOM_CODE);
// Добавляем маппинг для DEFAULT кода
roomManager.getAllRooms().set(DEFAULT_ROOM_CODE, defaultGameManager);
roomManager.getAllRooms().delete(defaultRoomCode);

interface ExtendedWebSocket extends WebSocket {
  isControl?: boolean;
  isDisplay?: boolean;
  playerId?: string | null;
  roomCode?: string | null;
}

wss.on("connection", (ws: ExtendedWebSocket, req) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const isControl = url.pathname === "/control" || url.pathname === "/mobile";
  const isDisplay = url.pathname === "/display" || url.pathname === "/";

  ws.isControl = isControl;
  ws.isDisplay = isDisplay;
  ws.roomCode = null;

  // Временно: все подключаются к одной общей комнате
  const defaultRoomCode = "DEFAULT";
  const gameManager = roomManager.getRoom(defaultRoomCode);
  
  if (!gameManager) {
    console.error("Default room not found! This should not happen.");
    ws.close();
    return;
  }
  
  ws.roomCode = defaultRoomCode;
  gameManager.addClient(ws);
  
  if (isControl) {
    ws.playerId = null;
    console.log("Control client connected to default room");
  } else if (isDisplay) {
    console.log("Display connected to default room");
    ws.send(
      JSON.stringify({
        type: "roomCode",
        roomCode: defaultRoomCode,
      })
    );
    gameManager.broadcastGameState();
  }

  ws.on("message", (message: Buffer) => {
    try {
      const messageStr = message.toString().trim();
      if (!messageStr) {
        console.log("Received empty message");
        return;
      }

      let data: ClientMessage;
      try {
        data = JSON.parse(messageStr) as ClientMessage;
      } catch (parseError) {
        console.error("Error parsing JSON message:", parseError);
        console.error("Message content:", messageStr.substring(0, 100));
        console.error("Full message length:", messageStr.length);
        
        // Проверяем, не является ли это старым форматом сообщения (например, "Player$uuid")
        if (messageStr.includes("$") && messageStr.length < 100) {
          console.warn("Received message in old format, ignoring:", messageStr);
          // Это может быть старая версия клиента, пытающаяся отправить имя и UUID напрямую
          // Игнорируем такие сообщения
        }
        
        // Не отправляем ошибку клиенту, если это невалидный JSON - просто игнорируем
        return;
      }

      // Валидация типа сообщения
      if (!data || typeof data !== "object" || !data.type) {
        console.error("Invalid message structure:", data);
        return;
      }

      // Временно отключена механика joinRoom - все подключаются к одной комнате
      // Handle joinRoom - игнорируем, все уже в одной комнате
      if (data.type === "joinRoom") {
        // Просто отправляем подтверждение, что комната уже выбрана
        ws.send(
          JSON.stringify({
            type: "roomCode",
            roomCode: ws.roomCode || "DEFAULT",
          })
        );
        return;
      }

      // Get game manager for this client's room (всегда DEFAULT)
      const defaultRoomCode = ws.roomCode || "DEFAULT";
      const gameManager = roomManager.getRoom(defaultRoomCode);
      if (!gameManager) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Комната не найдена",
          })
        );
        return;
      }

      // Handle startGame for both display and control clients
      if (data.type === "startGame") {
        console.log(
          `startGame received from ${
            ws.isDisplay ? "display" : "control"
          } client in room ${ws.roomCode}`
        );
        console.log(`Current game state: ${gameManager.getState()}`);

        if (gameManager.getState() === "lobby") {
          const connectedPlayers = Array.from(
            gameManager.getPlayers().values()
          ).filter((p) => p.connected);
          console.log(`Connected players: ${connectedPlayers.length}`);

          if (connectedPlayers.length >= 2) {
            console.log("Starting game...");
            gameManager.startGame();
          } else {
            console.log("Not enough players to start game");
          }
        } else {
          console.log(
            `Cannot start game: current state is ${gameManager.getState()}`
          );
        }
        return;
      }

      if (isControl) {
        if (data.type === "register") {
          const name = (data.name || "Игрок").trim().substring(0, 20);
          if (name.length < 2) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Имя должно содержать минимум 2 символа",
              })
            );
            return;
          }

          const clientUuid = data.uuid;
          let playerId: string | null = null;

          // Check if player with this UUID exists
          if (clientUuid) {
            console.log(`Looking for player with UUID: ${clientUuid}`);
            const existing = gameManager.findPlayerByUuid(clientUuid);

            if (existing) {
              // Reconnect to existing player
              playerId = existing.playerId;
              const player = gameManager.reconnectPlayer(playerId, name);

              ws.playerId = playerId;

              ws.send(
                JSON.stringify({
                  type: "connected",
                  playerId: playerId,
                  uuid: player.uuid,
                  color: player.color,
                  name: player.name,
                })
              );

              gameManager.broadcastGameState();

              console.log(
                `Player ${
                  player.name
                } (${playerId}) reconnected. Total players: ${
                  gameManager.getPlayers().size
                }`
              );
            } else {
              console.log(`No existing player found with UUID: ${clientUuid}`);
            }
          } else {
            console.log("No UUID provided by client");
          }

          if (!playerId) {
            // Register new player
            if (!gameManager.canAddPlayer()) {
              ws.send(
                JSON.stringify({ type: "error", message: "Игра переполнена" })
              );
              ws.close();
              return;
            }

            const uuid = clientUuid || crypto.randomUUID();
            const result = gameManager.addPlayer(name, uuid);
            playerId = result.playerId;
            const player = result.player;

            ws.playerId = playerId;

            ws.send(
              JSON.stringify({
                type: "connected",
                playerId: playerId,
                uuid: uuid,
                color: player.color,
              })
            );

            console.log(
              `Player ${name} (${playerId}) connected. Total players: ${
                gameManager.getPlayers().size
              }`
            );
            
            // Отправляем обновленное состояние игры всем клиентам
            gameManager.broadcastGameState();
            console.log("Game state broadcasted after player registration");
          }
        } else if (data.type === "disconnect") {
          // Explicit disconnect request
          if (ws.playerId) {
            gameManager.disconnectPlayer(ws.playerId);
            console.log(`Player ${ws.playerId} disconnected.`);
            ws.close();
          }
        } else if (ws.playerId) {
          // Handle game commands
          const player = gameManager.getPlayers().get(ws.playerId);
          if (!player || !player.connected) return;

          // Only allow game actions during playing state
          if (gameManager.getState() !== "playing") return;
          if (!player.alive) return;

          if (data.type === "turnStart") {
            gameManager.turnStart(ws.playerId);
          } else if (data.type === "turnStop") {
            gameManager.turnStop(ws.playerId);
          } else if (data.type === "turn") {
            // Старый формат для обратной совместимости
            gameManager.turnStart(ws.playerId);
          } else if (data.type === "shoot") {
            gameManager.shootBullet(ws.playerId);
          }
        }
      }
    } catch (e) {
      console.error("Error parsing message:", e);
    }
  });

  ws.on("close", () => {
    if (ws.roomCode) {
      const gameManager = roomManager.getRoom(ws.roomCode);
      if (gameManager) {
        if (isControl && ws.playerId) {
          gameManager.disconnectPlayer(ws.playerId);
          console.log(`Player ${ws.playerId} disconnected from room ${ws.roomCode}.`);
        }
        gameManager.removeClient(ws);
        
        // Check if room is empty and remove it
        const allClients = Array.from(gameManager.getClients?.() || []);
        if (allClients.length === 0) {
          roomManager.removeRoom(ws.roomCode);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Display: http://localhost:${PORT}`);
  console.log(`Control: http://localhost:${PORT}/control`);
});
