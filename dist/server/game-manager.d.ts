import { WebSocket } from "ws";
import { GameState, Player, GameStateData } from "../shared/game-types.js";
export declare class GameManager {
    private players;
    private bullets;
    private gameLoop;
    private state;
    private hostId;
    private roundResults;
    private playerIdCounter;
    private clients;
    private lastTurnTime;
    private turningPlayers;
    private turnStartTime;
    constructor();
    addClient(ws: WebSocket): void;
    removeClient(ws: WebSocket): void;
    getState(): GameState;
    getPlayers(): Map<string, Player>;
    getHostId(): string | null;
    canAddPlayer(): boolean;
    addPlayer(name: string, uuid: string): {
        playerId: string;
        player: Player;
    };
    findPlayerByUuid(uuid: string): {
        playerId: string;
        player: Player;
    } | null;
    reconnectPlayer(playerId: string, name: string): Player;
    disconnectPlayer(playerId: string): void;
    turnStart(playerId: string): void;
    turnStop(playerId: string): void;
    private applyTurns;
    shootBullet(playerId: string): void;
    startGame(): void;
    private startGameLoop;
    private stopGameLoop;
    private updateGame;
    private checkPlayerCollisions;
    private getShipTrianglePoints;
    private pointInTriangle;
    private trianglesCollide;
    private endRound;
    private resetToLobby;
    getGameState(): GameStateData;
    broadcastGameState(): void;
    private getRandomColor;
}
//# sourceMappingURL=game-manager.d.ts.map