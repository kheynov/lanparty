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
    private nextRoundTime;
    private killLog;
    private roomCode;
    private collectables;
    private lastCollectableSpawn;
    private collectableIdCounter;
    private asteroids;
    private walls;
    private asteroidIdCounter;
    private pilots;
    private pilotIdCounter;
    constructor(roomCode?: string);
    setRoomCode(roomCode: string): void;
    getRoomCode(): string | null;
    /**
     * Initialize ammo for a player with first charge ready and others reloading
     */
    private initializeAmmo;
    addClient(ws: WebSocket): void;
    removeClient(ws: WebSocket): void;
    getClients(): Set<WebSocket>;
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
    /**
     * Проверяет, есть ли у игрока активный collectable определенного типа
     */
    private checkPlayerHasCollectable;
    /**
     * Спавнит случайный collectable на карте
     */
    private spawnCollectable;
    /**
     * Проверяет столкновения игроков с collectables
     */
    private checkCollectableCollisions;
    /**
     * Применяет эффект collectable к игроку
     */
    private applyCollectableEffect;
    /**
     * Размещает игроков по периметру карты, направленными в центр
     */
    private positionPlayersOnPerimeter;
    /**
     * Генерирует окружение: стены и астероиды
     */
    private generateEnvironment;
    startGame(): void;
    private startGameLoop;
    private stopGameLoop;
    private updateGame;
    private checkPlayerCollisions;
    private getShipTrianglePoints;
    private pointInTriangle;
    private trianglesCollide;
    /**
     * Спавнит пилота при уничтожении корабля
     */
    private spawnPilot;
    /**
     * Проверяет столкновения игрока со стенами
     */
    private checkWallCollisions;
    /**
     * Проверяет столкновения пуль с астероидами
     */
    private checkAsteroidCollisions;
    /**
     * Спавнит collectable из разрушенного оранжевого астероида
     */
    private spawnCollectableFromAsteroid;
    /**
     * Применяет антигравитационные силы от астероидов
     */
    private applyAntigravityForce;
    private endRound;
    private resetToLobby;
    getGameState(): GameStateData;
    broadcastGameState(): void;
    private getRandomColor;
}
//# sourceMappingURL=game-manager.d.ts.map