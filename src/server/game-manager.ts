import { WebSocket } from "ws";
import {
  GameState,
  Player,
  Bullet,
  Point,
  PlayerResult,
  GameStateData,
  PlayerInfo,
  BulletInfo,
} from "../shared/game-types.js";
import {
  MAX_PLAYERS,
  GAME_WIDTH,
  GAME_HEIGHT,
  ACCELERATION,
  MAX_SPEED,
  FRICTION,
  BULLET_SPEED,
  TURN_SPEED,
  TURN_SPEED_MAX,
  TURN_ACCELERATION_TIME,
  SHIP_SIZE,
  SHIP_MAX_RADIUS,
  COLLISION_DISTANCE,
  COLLISION_FORCE,
  RESTITUTION,
  PLAYER_COLORS,
  GAME_FPS,
  ROUND_END_DELAY,
  LOBBY_DELAY,
  DOUBLE_TAP_TIME,
  DRIFT_ANGLE,
  DRIFT_BOOST,
} from "./game-constants.js";

export class GameManager {
  private players: Map<string, Player> = new Map();
  private bullets: Bullet[] = [];
  private gameLoop: NodeJS.Timeout | null = null;
  private state: GameState = GameState.LOBBY;
  private hostId: string | null = null;
  private roundResults: PlayerResult[] = [];
  private playerIdCounter = 0;
  private clients: Set<WebSocket> = new Set();
  private lastTurnTime: Map<string, number> = new Map(); // Время последнего поворота для каждого игрока
  private turningPlayers: Set<string> = new Set(); // Игроки, которые сейчас поворачиваются
  private turnStartTime: Map<string, number> = new Map(); // Время начала поворота для каждого игрока

  constructor() {}

  public addClient(ws: WebSocket): void {
    this.clients.add(ws);
  }

  public removeClient(ws: WebSocket): void {
    this.clients.delete(ws);
  }

  public getState(): GameState {
    return this.state;
  }

  public getPlayers(): Map<string, Player> {
    return this.players;
  }

  public getHostId(): string | null {
    return this.hostId;
  }

  public canAddPlayer(): boolean {
    return this.players.size < MAX_PLAYERS;
  }

  public addPlayer(
    name: string,
    uuid: string
  ): { playerId: string; player: Player } {
    const playerId = `player_${this.playerIdCounter++}`;

    const usedColors = Array.from(this.players.values())
      .map((p) => p.color)
      .filter((c) => c);

    const player: Player = {
      id: playerId,
      uuid: uuid,
      name: name,
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
      angle: Math.random() * Math.PI * 2,
      velocityX: 0,
      velocityY: 0,
      color: this.getRandomColor(usedColors),
      alive: true,
      connected: true,
      kills: 0,
      deaths: 0,
    };

    if (!this.hostId) {
      this.hostId = playerId;
    }

    this.players.set(playerId, player);
    return { playerId, player };
  }

  public findPlayerByUuid(
    uuid: string
  ): { playerId: string; player: Player } | null {
    for (const [id, player] of this.players.entries()) {
      if (player.uuid === uuid) {
        return { playerId: id, player };
      }
    }
    return null;
  }

  public reconnectPlayer(playerId: string, name: string): Player {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    player.connected = true;
    player.velocityX = 0;
    player.velocityY = 0;

    if (name.length >= 2 && name !== player.name) {
      player.name = name;
    }

    return player;
  }

  public disconnectPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.connected = false;
      player.velocityX = 0;
      player.velocityY = 0;
    }
    // Очищаем время последнего поворота и состояние поворота
    this.lastTurnTime.delete(playerId);
    this.turningPlayers.delete(playerId);
    this.turnStartTime.delete(playerId);
  }

  public turnStart(playerId: string): void {
    if (this.state !== GameState.PLAYING) return;

    const player = this.players.get(playerId);
    if (!player || !player.alive || !player.connected) return;

    const now = Date.now();
    const lastTurn = this.lastTurnTime.get(playerId);

    // Проверяем двойное нажатие
    if (lastTurn && now - lastTurn < DOUBLE_TAP_TIME) {
      // Двойное нажатие - дрифт!
      // Поворачиваем на 90 градусов
      player.angle += DRIFT_ANGLE;

      // Даем импульс скорости в новом направлении
      const boostX = Math.cos(player.angle) * DRIFT_BOOST;
      const boostY = Math.sin(player.angle) * DRIFT_BOOST;

      // Добавляем к текущей скорости
      player.velocityX += boostX;
      player.velocityY += boostY;

      // Ограничиваем максимальную скорость после дрифта
      const speed = Math.sqrt(player.velocityX ** 2 + player.velocityY ** 2);
      if (speed > MAX_SPEED * 1.5) {
        player.velocityX = (player.velocityX / speed) * MAX_SPEED * 1.5;
        player.velocityY = (player.velocityY / speed) * MAX_SPEED * 1.5;
      }

      // Сбрасываем время последнего поворота, чтобы не было тройного дрифта
      this.lastTurnTime.delete(playerId);
    } else {
      // Обычное начало поворота - добавляем в список поворачивающихся
      this.turningPlayers.add(playerId);
      this.turnStartTime.set(playerId, now);
      this.lastTurnTime.set(playerId, now);
    }
  }

  public turnStop(playerId: string): void {
    this.turningPlayers.delete(playerId);
    this.turnStartTime.delete(playerId);
  }

  // Применяет поворот для всех игроков, которые поворачиваются (вызывается в игровом цикле)
  // Использует очень плавную экспоненциальную кривую для нелинейного увеличения скорости поворота
  private applyTurns(): void {
    const now = Date.now();
    this.turningPlayers.forEach((playerId) => {
      const player = this.players.get(playerId);
      if (player && player.alive && player.connected) {
        const turnStart = this.turnStartTime.get(playerId);
        if (turnStart) {
          // Вычисляем время удержания кнопки в миллисекундах
          const holdTime = now - turnStart;

          // Нормализуем время от 0 до 1 (0 = начало, 1 = максимальное время)
          const normalizedTime = Math.min(holdTime / TURN_ACCELERATION_TIME, 1);

          // Используем очень плавную экспоненциальную кривую с насыщением
          // 1 - exp(-k*x) дает очень плавную кривую, которая медленно набирает скорость
          // Коэффициент 2.0 делает кривую еще более плавной и естественной
          const smoothFactor = 1 - Math.exp(-normalizedTime * 2.0);

          // Вычисляем скорость поворота от базовой до максимальной
          const currentTurnSpeed =
            TURN_SPEED + (TURN_SPEED_MAX - TURN_SPEED) * smoothFactor;

          player.angle += currentTurnSpeed;
        } else {
          // Fallback на базовую скорость, если время начала не найдено
          player.angle += TURN_SPEED;
        }
      }
    });
  }

  public shootBullet(playerId: string): void {
    if (this.state !== GameState.PLAYING) return;

    const player = this.players.get(playerId);
    if (!player || !player.alive || !player.connected) return;

    const bullet: Bullet = {
      x: player.x + Math.cos(player.angle) * (SHIP_SIZE + 5),
      y: player.y + Math.sin(player.angle) * (SHIP_SIZE + 5),
      angle: player.angle,
      ownerId: playerId,
    };
    this.bullets.push(bullet);
  }

  public startGame(): void {
    if (this.state !== GameState.LOBBY) return;
    if (this.players.size < 2) return;

    this.bullets = [];
    this.lastTurnTime.clear(); // Очищаем время последних поворотов при старте игры
    this.turningPlayers.clear(); // Очищаем список поворачивающихся игроков
    this.turnStartTime.clear(); // Очищаем время начала поворотов
    this.players.forEach((player) => {
      if (player.connected) {
        player.alive = true;
        player.x = Math.random() * GAME_WIDTH;
        player.y = Math.random() * GAME_HEIGHT;
        player.angle = Math.random() * Math.PI * 2;
        player.velocityX = 0;
        player.velocityY = 0;
        if (!player.kills) player.kills = 0;
        if (!player.deaths) player.deaths = 0;
      }
    });

    this.startGameLoop();
  }

  private startGameLoop(): void {
    if (this.gameLoop) return;

    this.state = GameState.PLAYING;
    this.gameLoop = setInterval(() => {
      this.updateGame();
      this.broadcastGameState();
    }, 1000 / GAME_FPS);
  }

  private stopGameLoop(): void {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
  }

  private updateGame(): void {
    // Apply turns for players who are turning
    this.applyTurns();

    // Update players
    this.players.forEach((player) => {
      if (!player.alive || !player.connected) return;

      // Apply acceleration
      const accelX = Math.cos(player.angle) * ACCELERATION;
      const accelY = Math.sin(player.angle) * ACCELERATION;

      player.velocityX += accelX;
      player.velocityY += accelY;

      // Apply friction
      player.velocityX *= FRICTION;
      player.velocityY *= FRICTION;

      // Limit speed
      const speed = Math.sqrt(player.velocityX ** 2 + player.velocityY ** 2);
      if (speed > MAX_SPEED) {
        player.velocityX = (player.velocityX / speed) * MAX_SPEED;
        player.velocityY = (player.velocityY / speed) * MAX_SPEED;
      }

      // Check collisions with other players
      this.checkPlayerCollisions(player);

      // Update position
      player.x += player.velocityX;
      player.y += player.velocityY;

      // Wrap around screen
      if (player.x < 0) player.x = GAME_WIDTH;
      if (player.x > GAME_WIDTH) player.x = 0;
      if (player.y < 0) player.y = GAME_HEIGHT;
      if (player.y > GAME_HEIGHT) player.y = 0;
    });

    // Update bullets
    this.bullets = this.bullets.filter((bullet) => {
      bullet.x += Math.cos(bullet.angle) * BULLET_SPEED;
      bullet.y += Math.sin(bullet.angle) * BULLET_SPEED;

      // Remove off-screen bullets
      if (
        bullet.x < 0 ||
        bullet.x > GAME_WIDTH ||
        bullet.y < 0 ||
        bullet.y > GAME_HEIGHT
      ) {
        return false;
      }

      // Check collision with players
      let hit = false;
      this.players.forEach((player, playerId) => {
        if (!player.alive || playerId === bullet.ownerId) return;

        const dx = bullet.x - player.x;
        const dy = bullet.y - player.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);

        if (distance < SHIP_SIZE * 0.6) {
          player.alive = false;
          player.deaths++;

          const killer = this.players.get(bullet.ownerId);
          if (killer) {
            killer.kills++;
          }

          hit = true;
        }
      });

      return !hit;
    });

    // Check if game should end
    const alivePlayers = Array.from(this.players.values()).filter(
      (p) => p.alive && p.connected
    );
    if (
      alivePlayers.length <= 1 &&
      this.players.size > 1 &&
      this.state === GameState.PLAYING
    ) {
      this.endRound();
    }
  }

  private checkPlayerCollisions(player: Player): void {
    this.players.forEach((otherPlayer, otherId) => {
      if (player.id === otherId || !otherPlayer.alive || !otherPlayer.connected)
        return;

      const dx = player.x - otherPlayer.x;
      const dy = player.y - otherPlayer.y;
      const distance = Math.sqrt(dx ** 2 + dy ** 2);

      if (distance > COLLISION_DISTANCE) return;

      const ship1Points = this.getShipTrianglePoints(
        player.x,
        player.y,
        player.angle
      );
      const ship2Points = this.getShipTrianglePoints(
        otherPlayer.x,
        otherPlayer.y,
        otherPlayer.angle
      );

      const isColliding = this.trianglesCollide(ship1Points, ship2Points);

      if (isColliding && distance > 0) {
        const minOverlap = SHIP_MAX_RADIUS * 0.1;
        const overlap = Math.max(minOverlap, COLLISION_DISTANCE - distance);
        const collisionAngle = Math.atan2(dy, dx);

        const normalX = Math.cos(collisionAngle);
        const normalY = Math.sin(collisionAngle);

        const pushX = normalX * overlap * COLLISION_FORCE;
        const pushY = normalY * overlap * COLLISION_FORCE;
        player.x += pushX;
        player.y += pushY;
        otherPlayer.x -= pushX;
        otherPlayer.y -= pushY;

        const relativeVelX = player.velocityX - otherPlayer.velocityX;
        const relativeVelY = player.velocityY - otherPlayer.velocityY;
        const relativeSpeedAlongNormal =
          relativeVelX * normalX + relativeVelY * normalY;

        if (relativeSpeedAlongNormal < 0) {
          const impulseScalar =
            ((1 + RESTITUTION) * relativeSpeedAlongNormal) / 2;
          const impulseX = impulseScalar * normalX;
          const impulseY = impulseScalar * normalY;

          player.velocityX -= impulseX;
          player.velocityY -= impulseY;
          otherPlayer.velocityX += impulseX;
          otherPlayer.velocityY += impulseY;
        }
      }
    });
  }

  private getShipTrianglePoints(x: number, y: number, angle: number): Point[] {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const noseX = x + SHIP_SIZE * cosA;
    const noseY = y + SHIP_SIZE * sinA;

    const leftX = x - SHIP_SIZE * 0.6 * cosA + SHIP_SIZE * 0.5 * sinA;
    const leftY = y - SHIP_SIZE * 0.6 * sinA - SHIP_SIZE * 0.5 * cosA;

    const rightX = x - SHIP_SIZE * 0.6 * cosA - SHIP_SIZE * 0.5 * sinA;
    const rightY = y - SHIP_SIZE * 0.6 * sinA + SHIP_SIZE * 0.5 * cosA;

    return [
      { x: noseX, y: noseY },
      { x: leftX, y: leftY },
      { x: rightX, y: rightY },
    ];
  }

  private pointInTriangle(
    px: number,
    py: number,
    p1: Point,
    p2: Point,
    p3: Point
  ): boolean {
    const d1 = (px - p2.x) * (p1.y - p2.y) - (p1.x - p2.x) * (py - p2.y);
    const d2 = (px - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (py - p3.y);
    const d3 = (px - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (py - p1.y);
    return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
  }

  private trianglesCollide(triangle1: Point[], triangle2: Point[]): boolean {
    for (const point of triangle1) {
      if (
        this.pointInTriangle(
          point.x,
          point.y,
          triangle2[0],
          triangle2[1],
          triangle2[2]
        )
      ) {
        return true;
      }
    }
    for (const point of triangle2) {
      if (
        this.pointInTriangle(
          point.x,
          point.y,
          triangle1[0],
          triangle1[1],
          triangle1[2]
        )
      ) {
        return true;
      }
    }
    return false;
  }

  private endRound(): void {
    this.stopGameLoop();
    this.state = GameState.FINISHED;

    const results = Array.from(this.players.entries())
      .filter(([_, player]) => player.connected)
      .map(([id, player]) => ({
        id: id,
        name: player.name,
        kills: player.kills,
        deaths: player.deaths,
        alive: player.alive,
        color: player.color,
      }))
      .sort((a, b) => {
        if (b.kills !== a.kills) return b.kills - a.kills;
        return a.deaths - b.deaths;
      });

    this.roundResults = results;
    this.broadcastGameState();

    setTimeout(() => {
      this.resetToLobby();
      setTimeout(() => {
        const connectedPlayers = Array.from(this.players.values()).filter(
          (p) => p.connected
        );
        if (connectedPlayers.length >= 2 && this.state === GameState.LOBBY) {
          this.startGame();
        }
      }, LOBBY_DELAY);
    }, ROUND_END_DELAY);
  }

  private resetToLobby(): void {
    this.state = GameState.LOBBY;
    this.bullets = [];
    this.roundResults = [];

    this.players.forEach((player) => {
      if (player.connected) {
        player.alive = true;
        player.x = Math.random() * GAME_WIDTH;
        player.y = Math.random() * GAME_HEIGHT;
        player.angle = Math.random() * Math.PI * 2;
        player.velocityX = 0;
        player.velocityY = 0;
      }
    });

    this.broadcastGameState();
  }

  public getGameState(): GameStateData {
    const players: PlayerInfo[] = Array.from(this.players.entries()).map(
      ([id, player]) => ({
        id,
        name: player.name,
        x: player.x,
        y: player.y,
        angle: player.angle,
        color: player.color,
        alive: player.alive,
        connected: player.connected,
        kills: player.kills,
        deaths: player.deaths,
      })
    );

    const bullets: BulletInfo[] = this.bullets.map((bullet) => ({
      x: bullet.x,
      y: bullet.y,
      angle: bullet.angle,
    }));

    return {
      state: this.state,
      hostId: this.hostId,
      players,
      bullets,
      results: this.roundResults,
    };
  }

  public broadcastGameState(): void {
    const state = this.getGameState();
    const message = JSON.stringify({ type: "gameState", data: state });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private getRandomColor(usedColors: string[] = []): string {
    const availableColors = PLAYER_COLORS.filter(
      (color) => !usedColors.includes(color)
    );

    if (availableColors.length === 0) {
      return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
    }

    return availableColors[Math.floor(Math.random() * availableColors.length)];
  }
}
