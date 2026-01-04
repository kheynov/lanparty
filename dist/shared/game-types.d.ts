export declare enum GameState {
    LOBBY = "lobby",
    PLAYING = "playing",
    FINISHED = "finished"
}
export declare enum CollectableType {
    REVERSE_TURN = "reverseTurn",
    LASER = "laser",
    SHIELD = "shield",
    LASER_BLADE = "laserBlade"
}
export interface Collectable {
    id: string;
    x: number;
    y: number;
    type: CollectableType;
    collectedBy?: string;
}
export interface Player {
    id: string;
    uuid: string;
    name: string;
    x: number;
    y: number;
    angle: number;
    velocityX: number;
    velocityY: number;
    color: string;
    alive: boolean;
    connected: boolean;
    kills: number;
    deaths: number;
    ammoReadyTime: number[];
    reverseTurnUntil?: number;
    hasShield?: boolean;
    hasLaserBlade?: boolean;
    pilotId?: string;
}
export interface Bullet {
    x: number;
    y: number;
    angle: number;
    ownerId: string;
    laser?: boolean;
}
export interface Point {
    x: number;
    y: number;
}
export interface PlayerResult {
    id: string;
    name: string;
    kills: number;
    deaths: number;
    alive: boolean;
    color: string;
}
export interface KillLogEntry {
    killerId: string;
    killerName: string;
    killerColor: string;
    victimId: string;
    victimName: string;
    victimColor: string;
    timestamp: number;
}
export interface GameStateData {
    state: GameState;
    hostId: string | null;
    players: PlayerInfo[];
    bullets: BulletInfo[];
    results: PlayerResult[];
    nextRoundTime?: number;
    killLog: KillLogEntry[];
    roomCode?: string;
    collectables?: CollectableInfo[];
    asteroids?: AsteroidInfo[];
    walls?: WallInfo[];
    pilots?: PilotInfo[];
}
export interface PlayerInfo {
    id: string;
    name: string;
    x: number;
    y: number;
    angle: number;
    color: string;
    alive: boolean;
    connected: boolean;
    kills: number;
    deaths: number;
    ammoReadyTime: number[];
    ammoCount: number;
}
export interface BulletInfo {
    x: number;
    y: number;
    angle: number;
    laser?: boolean;
}
export interface CollectableInfo {
    id: string;
    x: number;
    y: number;
    type: CollectableType;
}
export declare enum AsteroidType {
    EMPTY = "empty",
    ORANGE = "orange",
    ANTIGRAVITY = "antigravity"
}
export interface Asteroid {
    id: string;
    x: number;
    y: number;
    radius: number;
    type: AsteroidType;
    health?: number;
}
export interface Wall {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    destructible: boolean;
    health?: number;
}
export interface AsteroidInfo {
    id: string;
    x: number;
    y: number;
    radius: number;
    type: AsteroidType;
}
export interface WallInfo {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    destructible: boolean;
}
export interface Pilot {
    id: string;
    playerId: string;
    x: number;
    y: number;
    angle: number;
    velocityX: number;
    velocityY: number;
    alive: boolean;
}
export interface PilotInfo {
    id: string;
    playerId: string;
    x: number;
    y: number;
    angle: number;
    alive: boolean;
}
export type MessageType = "register" | "connected" | "disconnect" | "turn" | "shoot" | "startGame" | "gameState" | "error";
export interface RegisterMessage {
    type: "register";
    name: string;
    uuid?: string;
}
export interface ConnectedMessage {
    type: "connected";
    playerId: string;
    uuid: string;
    color: string;
    name?: string;
}
export interface DisconnectMessage {
    type: "disconnect";
}
export interface TurnMessage {
    type: "turn";
}
export interface TurnStartMessage {
    type: "turnStart";
}
export interface TurnStopMessage {
    type: "turnStop";
}
export interface ShootMessage {
    type: "shoot";
}
export interface StartGameMessage {
    type: "startGame";
}
export interface CreateRoomMessage {
    type: "createRoom";
}
export interface JoinRoomMessage {
    type: "joinRoom";
    roomCode: string;
}
export interface RoomCodeMessage {
    type: "roomCode";
    roomCode: string;
}
export interface GameStateMessage {
    type: "gameState";
    data: GameStateData;
}
export interface ErrorMessage {
    type: "error";
    message: string;
}
export type ClientMessage = RegisterMessage | DisconnectMessage | TurnMessage | TurnStartMessage | TurnStopMessage | ShootMessage | StartGameMessage | CreateRoomMessage | JoinRoomMessage;
export type ServerMessage = ConnectedMessage | GameStateMessage | ErrorMessage | RoomCodeMessage;
//# sourceMappingURL=game-types.d.ts.map