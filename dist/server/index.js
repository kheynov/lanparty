import { WebSocketServer } from "ws";
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { GameManager } from "./game-manager.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
// Serve static files from dist directory
app.use(express.static(path.join(__dirname, "..")));
// Serve client HTML files
app.get("/control.html", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "client", "control.html"));
});
app.get("/display.html", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "client", "display.html"));
});
// Also serve display.html for root path
app.get("/", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "client", "display.html"));
});
// WebSocket server
const wss = new WebSocketServer({ server });
const gameManager = new GameManager();
wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const isControl = url.pathname === "/control" || url.pathname === "/mobile";
    const isDisplay = url.pathname === "/display" || url.pathname === "/";
    ws.isControl = isControl;
    ws.isDisplay = isDisplay;
    gameManager.addClient(ws);
    if (isControl) {
        ws.playerId = null;
        console.log("Control client connected, waiting for registration");
    }
    else if (isDisplay) {
        console.log("Display connected");
    }
    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message.toString());
            // Handle startGame for both display and control clients
            if (data.type === "startGame") {
                console.log(`startGame received from ${ws.isDisplay ? "display" : "control"} client`);
                console.log(`Current game state: ${gameManager.getState()}`);
                if (gameManager.getState() === "lobby") {
                    const connectedPlayers = Array.from(gameManager.getPlayers().values()).filter((p) => p.connected);
                    console.log(`Connected players: ${connectedPlayers.length}`);
                    if (connectedPlayers.length >= 2) {
                        console.log("Starting game...");
                        gameManager.startGame();
                    }
                    else {
                        console.log("Not enough players to start game");
                    }
                }
                else {
                    console.log(`Cannot start game: current state is ${gameManager.getState()}`);
                }
                return;
            }
            if (isControl) {
                if (data.type === "register") {
                    const name = (data.name || "Игрок").trim().substring(0, 20);
                    if (name.length < 2) {
                        ws.send(JSON.stringify({
                            type: "error",
                            message: "Имя должно содержать минимум 2 символа",
                        }));
                        return;
                    }
                    const clientUuid = data.uuid;
                    let playerId = null;
                    // Check if player with this UUID exists
                    if (clientUuid) {
                        console.log(`Looking for player with UUID: ${clientUuid}`);
                        const existing = gameManager.findPlayerByUuid(clientUuid);
                        if (existing) {
                            // Reconnect to existing player
                            playerId = existing.playerId;
                            const player = gameManager.reconnectPlayer(playerId, name);
                            ws.playerId = playerId;
                            ws.send(JSON.stringify({
                                type: "connected",
                                playerId: playerId,
                                uuid: player.uuid,
                                color: player.color,
                                name: player.name,
                            }));
                            gameManager.broadcastGameState();
                            console.log(`Player ${player.name} (${playerId}) reconnected. Total players: ${gameManager.getPlayers().size}`);
                        }
                        else {
                            console.log(`No existing player found with UUID: ${clientUuid}`);
                        }
                    }
                    else {
                        console.log("No UUID provided by client");
                    }
                    if (!playerId) {
                        // Register new player
                        if (!gameManager.canAddPlayer()) {
                            ws.send(JSON.stringify({ type: "error", message: "Игра переполнена" }));
                            ws.close();
                            return;
                        }
                        const uuid = clientUuid || crypto.randomUUID();
                        const result = gameManager.addPlayer(name, uuid);
                        playerId = result.playerId;
                        const player = result.player;
                        ws.playerId = playerId;
                        ws.send(JSON.stringify({
                            type: "connected",
                            playerId: playerId,
                            uuid: uuid,
                            color: player.color,
                        }));
                        gameManager.broadcastGameState();
                        console.log(`Player ${name} (${playerId}) connected. Total players: ${gameManager.getPlayers().size}`);
                    }
                }
                else if (data.type === "disconnect") {
                    // Explicit disconnect request
                    if (ws.playerId) {
                        gameManager.disconnectPlayer(ws.playerId);
                        console.log(`Player ${ws.playerId} disconnected.`);
                        ws.close();
                    }
                }
                else if (ws.playerId) {
                    // Handle game commands
                    const player = gameManager.getPlayers().get(ws.playerId);
                    if (!player || !player.connected)
                        return;
                    // Only allow game actions during playing state
                    if (gameManager.getState() !== "playing")
                        return;
                    if (!player.alive)
                        return;
                    if (data.type === "turnStart") {
                        gameManager.turnStart(ws.playerId);
                    }
                    else if (data.type === "turnStop") {
                        gameManager.turnStop(ws.playerId);
                    }
                    else if (data.type === "turn") {
                        // Старый формат для обратной совместимости
                        gameManager.turnStart(ws.playerId);
                    }
                    else if (data.type === "shoot") {
                        gameManager.shootBullet(ws.playerId);
                    }
                }
            }
        }
        catch (e) {
            console.error("Error parsing message:", e);
        }
    });
    ws.on("close", () => {
        if (isControl && ws.playerId) {
            gameManager.disconnectPlayer(ws.playerId);
            console.log(`Player ${ws.playerId} disconnected.`);
        }
        gameManager.removeClient(ws);
    });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Display: http://localhost:${PORT}`);
    console.log(`Control: http://localhost:${PORT}/control.html`);
});
//# sourceMappingURL=index.js.map