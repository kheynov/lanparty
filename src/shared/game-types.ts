// Game state types
export enum GameState {
  LOBBY = "lobby",
  PLAYING = "playing",
  FINISHED = "finished",
}

// Collectable types
export enum CollectableType {
  REVERSE_TURN = "reverseTurn",
  LASER = "laser",
  SHIELD = "shield",
  LASER_BLADE = "laserBlade",
}

// Collectable data
export interface Collectable {
  id: string;
  x: number;
  y: number;
  type: CollectableType;
  collectedBy?: string; // playerId
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
  ammoReadyTime: number[]; // Массив времени готовности каждого заряда (в мс с начала эпохи)
  reverseTurnUntil?: number; // Время до которого поворот инвертирован
  hasShield?: boolean; // Защита от одного удара
  hasLaserBlade?: boolean; // Способность наносить урон при столкновении
  pilotId?: string; // ID пилота, если корабль уничтожен
}

// Bullet data
export interface Bullet {
  x: number;
  y: number;
  angle: number;
  ownerId: string;
  laser?: boolean; // Специальный тип пули - лазер
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

// Kill log entry
export interface KillLogEntry {
  killerId: string;
  killerName: string;
  killerColor: string;
  victimId: string;
  victimName: string;
  victimColor: string;
  timestamp: number; // Время убийства в миллисекундах
}

// Full game state
export interface GameStateData {
  state: GameState;
  hostId: string | null;
  players: PlayerInfo[];
  bullets: BulletInfo[];
  results: PlayerResult[];
  nextRoundTime?: number; // Время (timestamp) когда начнется следующий раунд
  killLog: KillLogEntry[]; // Килл-лог текущего раунда (всегда массив, может быть пустым)
  roomCode?: string; // Код комнаты
  collectables?: CollectableInfo[]; // Collectables на карте
  asteroids?: AsteroidInfo[]; // Астероиды на карте
  walls?: WallInfo[]; // Стены на карте
  pilots?: PilotInfo[]; // Пилоты на карте
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
  ammoReadyTime: number[]; // Массив времени готовности каждого заряда (для синхронизации)
  ammoCount: number; // Количество готовых зарядов (для удобства отображения)
}

// Bullet info for client
export interface BulletInfo {
  x: number;
  y: number;
  angle: number;
  laser?: boolean;
}

// Collectable info for client
export interface CollectableInfo {
  id: string;
  x: number;
  y: number;
  type: CollectableType;
}

// Asteroid types
export enum AsteroidType {
  EMPTY = "empty",
  ORANGE = "orange",
  ANTIGRAVITY = "antigravity",
}

// Asteroid data
export interface Asteroid {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: AsteroidType;
  health?: number; // для разрушаемых
}

// Wall data
export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  destructible: boolean;
  health?: number;
}

// Asteroid info for client
export interface AsteroidInfo {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: AsteroidType;
}

// Wall info for client
export interface WallInfo {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  destructible: boolean;
}

// Pilot data
export interface Pilot {
  id: string;
  playerId: string; // связь с игроком
  x: number;
  y: number;
  angle: number;
  velocityX: number;
  velocityY: number;
  alive: boolean;
}

// Pilot info for client
export interface PilotInfo {
  id: string;
  playerId: string;
  x: number;
  y: number;
  angle: number;
  alive: boolean;
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

export type ClientMessage =
  | RegisterMessage
  | DisconnectMessage
  | TurnMessage
  | TurnStartMessage
  | TurnStopMessage
  | ShootMessage
  | StartGameMessage
  | CreateRoomMessage
  | JoinRoomMessage;

export type ServerMessage = ConnectedMessage | GameStateMessage | ErrorMessage | RoomCodeMessage;
