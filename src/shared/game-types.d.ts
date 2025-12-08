export declare enum GameState {
    LOBBY = "lobby",
    PLAYING = "playing",
    FINISHED = "finished"
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
}
export interface Bullet {
    x: number;
    y: number;
    angle: number;
    ownerId: string;
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
export interface GameStateData {
    state: GameState;
    hostId: string | null;
    players: PlayerInfo[];
    bullets: BulletInfo[];
    results: PlayerResult[];
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
}
export interface BulletInfo {
    x: number;
    y: number;
    angle: number;
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
export interface ShootMessage {
    type: "shoot";
}
export interface StartGameMessage {
    type: "startGame";
}
export interface GameStateMessage {
    type: "gameState";
    data: GameStateData;
}
export interface ErrorMessage {
    type: "error";
    message: string;
}
export type ClientMessage = RegisterMessage | DisconnectMessage | TurnMessage | ShootMessage | StartGameMessage;
export type ServerMessage = ConnectedMessage | GameStateMessage | ErrorMessage;
//# sourceMappingURL=game-types.d.ts.map