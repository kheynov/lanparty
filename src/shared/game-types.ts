// Game state types
export enum GameState {
  LOBBY = "lobby",
  PLAYING = "playing",
  FINISHED = "finished",
}

// Player data
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

// Bullet data
export interface Bullet {
  x: number;
  y: number;
  angle: number;
  ownerId: string;
}

// Point for collision detection
export interface Point {
  x: number;
  y: number;
}

// Game result for a player
export interface PlayerResult {
  id: string;
  name: string;
  kills: number;
  deaths: number;
  alive: boolean;
  color: string;
}

// Full game state
export interface GameStateData {
  state: GameState;
  hostId: string | null;
  players: PlayerInfo[];
  bullets: BulletInfo[];
  results: PlayerResult[];
}

// Player info for client
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

// Bullet info for client
export interface BulletInfo {
  x: number;
  y: number;
  angle: number;
}

// WebSocket message types
export type MessageType =
  | "register"
  | "connected"
  | "disconnect"
  | "turn"
  | "shoot"
  | "startGame"
  | "gameState"
  | "error";

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

export interface GameStateMessage {
  type: "gameState";
  data: GameStateData;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ClientMessage =
  | RegisterMessage
  | DisconnectMessage
  | TurnMessage
  | TurnStartMessage
  | TurnStopMessage
  | ShootMessage
  | StartGameMessage;

export type ServerMessage = ConnectedMessage | GameStateMessage | ErrorMessage;
