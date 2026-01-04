import { WebSocket } from "ws";
import { GameState, CollectableType, AsteroidType, } from "../shared/game-types.js";
import { MAX_PLAYERS, GAME_WIDTH, GAME_HEIGHT, ACCELERATION, MAX_SPEED, FRICTION, BULLET_SPEED, TURN_SPEED, TURN_SPEED_MAX, TURN_ACCELERATION_TIME, SHIP_SIZE, SHIP_MAX_RADIUS, COLLISION_DISTANCE, COLLISION_FORCE, RESTITUTION, PLAYER_COLORS, GAME_FPS, ROUND_END_DELAY, DOUBLE_TAP_TIME, DRIFT_ANGLE, DRIFT_BOOST, AMMO_CLIP_SIZE, AMMO_RELOAD_TIME, COLLECTABLE_SPAWN_INTERVAL, COLLECTABLE_SPAWN_CHANCE, REVERSE_TURN_DURATION, LASER_BACKWARD_FORCE, COLLECTABLE_COLLECTION_DISTANCE, WALL_THICKNESS, ASTEROID_MIN_RADIUS, ASTEROID_MAX_RADIUS, ASTEROID_COUNT, ANTIGRAVITY_FORCE, ANTIGRAVITY_RANGE, } from "./game-constants.js";
export class GameManager {
    constructor(roomCode) {
        this.players = new Map();
        this.bullets = [];
        this.gameLoop = null;
        this.state = GameState.LOBBY;
        this.hostId = null;
        this.roundResults = [];
        this.playerIdCounter = 0;
        this.clients = new Set();
        this.lastTurnTime = new Map();
        this.turningPlayers = new Set();
        this.turnStartTime = new Map();
        this.nextRoundTime = null;
        this.killLog = [];
        this.roomCode = null;
        this.collectables = [];
        this.lastCollectableSpawn = 0;
        this.collectableIdCounter = 0;
        this.asteroids = [];
        this.walls = [];
        this.asteroidIdCounter = 0;
        this.pilots = [];
        this.pilotIdCounter = 0;
        this.roomCode = roomCode || null;
    }
    setRoomCode(roomCode) {
        this.roomCode = roomCode;
    }
    getRoomCode() {
        return this.roomCode;
    }
    /**
     * Initialize ammo for a player with first charge ready and others reloading
     */
    initializeAmmo(now = Date.now()) {
        const ammoReadyTime = [];
        ammoReadyTime[0] = now; // First charge ready immediately
        for (let i = 1; i < AMMO_CLIP_SIZE; i++) {
            ammoReadyTime[i] = now + i * AMMO_RELOAD_TIME; // Others reload sequentially
        }
        return ammoReadyTime;
    }
    addClient(ws) {
        this.clients.add(ws);
    }
    removeClient(ws) {
        this.clients.delete(ws);
    }
    getClients() {
        return this.clients;
    }
    getState() {
        return this.state;
    }
    getPlayers() {
        return this.players;
    }
    getHostId() {
        return this.hostId;
    }
    canAddPlayer() {
        return this.players.size < MAX_PLAYERS;
    }
    addPlayer(name, uuid) {
        const playerId = `player_${this.playerIdCounter++}`;
        const usedColors = Array.from(this.players.values())
            .map((p) => p.color)
            .filter((c) => c);
        const player = {
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
            connected: true, // Убеждаемся, что игрок помечен как подключенный
            kills: 0,
            deaths: 0,
            ammoReadyTime: this.initializeAmmo(),
        };
        if (!this.hostId) {
            this.hostId = playerId;
        }
        this.players.set(playerId, player);
        return { playerId, player };
    }
    findPlayerByUuid(uuid) {
        for (const [id, player] of this.players.entries()) {
            if (player.uuid === uuid) {
                return { playerId: id, player };
            }
        }
        return null;
    }
    reconnectPlayer(playerId, name) {
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
    disconnectPlayer(playerId) {
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
    turnStart(playerId) {
        if (this.state !== GameState.PLAYING)
            return;
        const player = this.players.get(playerId);
        if (!player || !player.connected)
            return;
        // Если игрок мертв, но есть пилот, управляем пилотом
        if (!player.alive && player.pilotId) {
            const pilot = this.pilots.find((p) => p.id === player.pilotId);
            if (pilot && pilot.alive) {
                // Пилот поворачивается как корабль
                const now = Date.now();
                if (!this.turningPlayers.has(playerId)) {
                    this.turningPlayers.add(playerId);
                    this.turnStartTime.set(playerId, now);
                    this.lastTurnTime.set(playerId, now);
                }
                return;
            }
        }
        if (!player.alive || !player.connected)
            return;
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
        }
        else {
            // Обычное начало поворота - добавляем в список поворачивающихся
            this.turningPlayers.add(playerId);
            this.turnStartTime.set(playerId, now);
            this.lastTurnTime.set(playerId, now);
        }
    }
    turnStop(playerId) {
        this.turningPlayers.delete(playerId);
        this.turnStartTime.delete(playerId);
    }
    // Применяет поворот для всех игроков, которые поворачиваются (вызывается в игровом цикле)
    // Использует очень плавную экспоненциальную кривую для нелинейного увеличения скорости поворота
    applyTurns() {
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
                    let currentTurnSpeed = TURN_SPEED + (TURN_SPEED_MAX - TURN_SPEED) * smoothFactor;
                    // Проверяем эффект реверса поворота
                    if (player.reverseTurnUntil && player.reverseTurnUntil > now) {
                        currentTurnSpeed = -currentTurnSpeed; // Инвертируем направление
                    }
                    player.angle += currentTurnSpeed;
                }
                else {
                    // Fallback на базовую скорость, если время начала не найдено
                    player.angle += TURN_SPEED;
                }
            }
        });
    }
    shootBullet(playerId) {
        if (this.state !== GameState.PLAYING)
            return;
        const player = this.players.get(playerId);
        if (!player || !player.connected)
            return;
        // Если игрок мертв, но есть пилот, управляем пилотом
        if (!player.alive && player.pilotId) {
            const pilot = this.pilots.find((p) => p.id === player.pilotId);
            if (pilot && pilot.alive) {
                // Пилот движется по прямой при нажатии выстрела
                const accelX = Math.cos(pilot.angle) * ACCELERATION;
                const accelY = Math.sin(pilot.angle) * ACCELERATION;
                pilot.velocityX += accelX;
                pilot.velocityY += accelY;
                return;
            }
        }
        if (!player.alive || !player.connected)
            return;
        const now = Date.now();
        // Находим первый готовый заряд
        let readyAmmoIndex = -1;
        for (let i = 0; i < player.ammoReadyTime.length; i++) {
            if (player.ammoReadyTime[i] <= now) {
                readyAmmoIndex = i;
                break;
            }
        }
        // Если нет готовых зарядов, не стреляем
        if (readyAmmoIndex === -1)
            return;
        // Используем заряд - устанавливаем время следующей перезарядки
        player.ammoReadyTime[readyAmmoIndex] = now + AMMO_RELOAD_TIME;
        // Проверяем, есть ли у игрока лазер
        const hasLaser = this.checkPlayerHasCollectable(playerId, CollectableType.LASER);
        const bullet = {
            x: player.x + Math.cos(player.angle) * (SHIP_SIZE + 5),
            y: player.y + Math.sin(player.angle) * (SHIP_SIZE + 5),
            angle: player.angle,
            ownerId: playerId,
            laser: hasLaser,
        };
        this.bullets.push(bullet);
        // Если это лазер, отбрасываем игрока назад
        if (hasLaser) {
            player.velocityX -= Math.cos(player.angle) * LASER_BACKWARD_FORCE;
            player.velocityY -= Math.sin(player.angle) * LASER_BACKWARD_FORCE;
        }
    }
    /**
     * Проверяет, есть ли у игрока активный collectable определенного типа
     */
    checkPlayerHasCollectable(playerId, type) {
        const player = this.players.get(playerId);
        if (!player)
            return false;
        switch (type) {
            case CollectableType.LASER:
                // Лазер - одноразовый, проверяем наличие в collectables (еще не удален)
                const laserCollectable = this.collectables.find((c) => c.collectedBy === playerId && c.type === CollectableType.LASER);
                if (laserCollectable) {
                    // Удаляем после использования
                    const index = this.collectables.indexOf(laserCollectable);
                    if (index > -1) {
                        this.collectables.splice(index, 1);
                    }
                    return true;
                }
                return false;
            case CollectableType.SHIELD:
                return player.hasShield === true;
            case CollectableType.LASER_BLADE:
                return player.hasLaserBlade === true;
            default:
                return false;
        }
    }
    /**
     * Спавнит случайный collectable на карте
     */
    spawnCollectable() {
        const types = [
            CollectableType.REVERSE_TURN,
            CollectableType.LASER,
            CollectableType.SHIELD,
            CollectableType.LASER_BLADE,
        ];
        const randomType = types[Math.floor(Math.random() * types.length)];
        const collectable = {
            id: `collectable_${this.collectableIdCounter++}`,
            x: Math.random() * (GAME_WIDTH - 100) + 50,
            y: Math.random() * (GAME_HEIGHT - 100) + 50,
            type: randomType,
        };
        this.collectables.push(collectable);
    }
    /**
     * Проверяет столкновения игроков с collectables
     */
    checkCollectableCollisions() {
        const now = Date.now();
        this.collectables = this.collectables.filter((collectable) => {
            if (collectable.collectedBy)
                return true; // Уже собран
            this.players.forEach((player, playerId) => {
                if (!player.alive || !player.connected)
                    return;
                const dx = collectable.x - player.x;
                const dy = collectable.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < COLLECTABLE_COLLECTION_DISTANCE) {
                    collectable.collectedBy = playerId;
                    this.applyCollectableEffect(playerId, collectable.type, now);
                }
            });
            return !collectable.collectedBy; // Удаляем собранные
        });
    }
    /**
     * Применяет эффект collectable к игроку
     */
    applyCollectableEffect(playerId, type, now) {
        const player = this.players.get(playerId);
        if (!player)
            return;
        switch (type) {
            case CollectableType.REVERSE_TURN:
                // Инвертируем поворот для всех игроков
                this.players.forEach((p) => {
                    p.reverseTurnUntil = now + REVERSE_TURN_DURATION;
                });
                break;
            case CollectableType.LASER:
                // Лазер - одноразовый, не нужно хранить состояние
                // Эффект применяется при выстреле
                break;
            case CollectableType.SHIELD:
                player.hasShield = true;
                break;
            case CollectableType.LASER_BLADE:
                player.hasLaserBlade = true;
                break;
        }
    }
    /**
     * Размещает игроков по периметру карты, направленными в центр
     */
    positionPlayersOnPerimeter() {
        const connectedPlayers = Array.from(this.players.values()).filter((p) => p.connected);
        const playerCount = connectedPlayers.length;
        if (playerCount === 0)
            return;
        const centerX = GAME_WIDTH / 2;
        const centerY = GAME_HEIGHT / 2;
        const margin = 50; // Отступ от края карты
        connectedPlayers.forEach((player, index) => {
            // Вычисляем угол для равномерного распределения по периметру
            // Начинаем с угла -π/2 (верхняя точка) и распределяем по часовой стрелке
            const angle = (2 * Math.PI * index) / playerCount - Math.PI / 2;
            // Размещаем игрока на границе прямоугольника
            // Находим пересечение луча из центра с границей прямоугольника
            const halfWidth = GAME_WIDTH / 2 - margin;
            const halfHeight = GAME_HEIGHT / 2 - margin;
            // Параметрическое уравнение прямой: x = centerX + t*cos(angle), y = centerY + t*sin(angle)
            // Находим t, при котором точка попадает на границу прямоугольника
            let t = Infinity;
            let x = centerX + halfWidth * Math.cos(angle); // Fallback на эллипс
            let y = centerY + halfHeight * Math.sin(angle); // Fallback на эллипс
            // Проверяем пересечение с каждой стороной прямоугольника
            // Правая сторона: x = GAME_WIDTH - margin
            if (Math.cos(angle) > 0) {
                const tRight = (GAME_WIDTH - margin - centerX) / Math.cos(angle);
                const yRight = centerY + tRight * Math.sin(angle);
                if (yRight >= margin && yRight <= GAME_HEIGHT - margin && tRight < t) {
                    t = tRight;
                    x = GAME_WIDTH - margin;
                    y = yRight;
                }
            }
            // Левая сторона: x = margin
            if (Math.cos(angle) < 0) {
                const tLeft = (margin - centerX) / Math.cos(angle);
                const yLeft = centerY + tLeft * Math.sin(angle);
                if (yLeft >= margin && yLeft <= GAME_HEIGHT - margin && tLeft < t) {
                    t = tLeft;
                    x = margin;
                    y = yLeft;
                }
            }
            // Нижняя сторона: y = GAME_HEIGHT - margin
            if (Math.sin(angle) > 0) {
                const tBottom = (GAME_HEIGHT - margin - centerY) / Math.sin(angle);
                const xBottom = centerX + tBottom * Math.cos(angle);
                if (xBottom >= margin &&
                    xBottom <= GAME_WIDTH - margin &&
                    tBottom < t) {
                    t = tBottom;
                    x = xBottom;
                    y = GAME_HEIGHT - margin;
                }
            }
            // Верхняя сторона: y = margin
            if (Math.sin(angle) < 0) {
                const tTop = (margin - centerY) / Math.sin(angle);
                const xTop = centerX + tTop * Math.cos(angle);
                if (xTop >= margin && xTop <= GAME_WIDTH - margin && tTop < t) {
                    t = tTop;
                    x = xTop;
                    y = margin;
                }
            }
            // Если не нашли пересечение (не должно произойти), используем эллипс как fallback
            if (t === Infinity || x === undefined || y === undefined) {
                x = centerX + halfWidth * Math.cos(angle);
                y = centerY + halfHeight * Math.sin(angle);
            }
            player.x = x;
            player.y = y;
            // Направляем игрока в центр карты
            player.angle = Math.atan2(centerY - y, centerX - x);
        });
    }
    /**
     * Генерирует окружение: стены и астероиды
     */
    generateEnvironment() {
        this.asteroids = [];
        this.walls = [];
        this.asteroidIdCounter = 0;
        // Стены убраны - больше не генерируем стены в центре
        // Генерируем астероиды
        for (let i = 0; i < ASTEROID_COUNT; i++) {
            const radius = ASTEROID_MIN_RADIUS +
                Math.random() * (ASTEROID_MAX_RADIUS - ASTEROID_MIN_RADIUS);
            const types = [
                AsteroidType.EMPTY,
                AsteroidType.ORANGE,
                AsteroidType.ANTIGRAVITY,
            ];
            const randomType = types[Math.floor(Math.random() * types.length)];
            const asteroid = {
                id: `asteroid_${this.asteroidIdCounter++}`,
                x: Math.random() * (GAME_WIDTH - radius * 2) + radius,
                y: Math.random() * (GAME_HEIGHT - radius * 2) + radius,
                radius: radius,
                type: randomType,
                health: randomType === AsteroidType.EMPTY ||
                    randomType === AsteroidType.ORANGE
                    ? 1
                    : undefined,
            };
            this.asteroids.push(asteroid);
        }
    }
    startGame() {
        if (this.state !== GameState.LOBBY)
            return;
        if (this.players.size < 2)
            return;
        this.bullets = [];
        this.collectables = [];
        this.killLog = []; // Очищаем килл-лог при старте нового раунда
        this.lastTurnTime.clear(); // Очищаем время последних поворотов при старте игры
        this.turningPlayers.clear(); // Очищаем список поворачивающихся игроков
        this.turnStartTime.clear(); // Очищаем время начала поворотов
        this.lastCollectableSpawn = Date.now();
        this.generateEnvironment(); // Генерируем окружение
        const now = Date.now();
        this.players.forEach((player) => {
            if (player.connected) {
                player.alive = true;
                player.velocityX = 0;
                player.velocityY = 0;
                if (!player.kills)
                    player.kills = 0;
                if (!player.deaths)
                    player.deaths = 0;
                player.ammoReadyTime = this.initializeAmmo(now);
                // Сбрасываем эффекты collectables
                player.reverseTurnUntil = undefined;
                player.hasShield = false;
                player.hasLaserBlade = false;
            }
        });
        // Размещаем игроков по периметру карты
        this.positionPlayersOnPerimeter();
        this.startGameLoop();
    }
    startGameLoop() {
        if (this.gameLoop)
            return;
        this.state = GameState.PLAYING;
        this.gameLoop = setInterval(() => {
            this.updateGame();
            this.broadcastGameState();
        }, 1000 / GAME_FPS);
    }
    stopGameLoop() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
    }
    updateGame() {
        const now = Date.now();
        // Spawn collectables periodically
        if (now - this.lastCollectableSpawn >= COLLECTABLE_SPAWN_INTERVAL) {
            if (Math.random() < COLLECTABLE_SPAWN_CHANCE) {
                this.spawnCollectable();
            }
            this.lastCollectableSpawn = now;
        }
        // Apply turns for players who are turning
        this.applyTurns();
        // Check collectable collisions
        this.checkCollectableCollisions();
        // Apply antigravity forces
        this.applyAntigravityForce();
        // Update players
        this.players.forEach((player) => {
            if (!player.alive || !player.connected)
                return;
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
            // Check collisions with walls
            this.checkWallCollisions(player);
            // Update position
            player.x += player.velocityX;
            player.y += player.velocityY;
            // Wrap around screen
            if (player.x < 0)
                player.x = GAME_WIDTH;
            if (player.x > GAME_WIDTH)
                player.x = 0;
            if (player.y < 0)
                player.y = GAME_HEIGHT;
            if (player.y > GAME_HEIGHT)
                player.y = 0;
        });
        // Update pilots
        this.pilots = this.pilots.filter((pilot) => {
            if (!pilot.alive)
                return false;
            // Применяем трение
            pilot.velocityX *= FRICTION;
            pilot.velocityY *= FRICTION;
            // Ограничиваем скорость
            const speed = Math.sqrt(pilot.velocityX ** 2 + pilot.velocityY ** 2);
            if (speed > MAX_SPEED) {
                pilot.velocityX = (pilot.velocityX / speed) * MAX_SPEED;
                pilot.velocityY = (pilot.velocityY / speed) * MAX_SPEED;
            }
            // Обновляем позицию
            pilot.x += pilot.velocityX;
            pilot.y += pilot.velocityY;
            // Wrap around screen
            if (pilot.x < 0)
                pilot.x = GAME_WIDTH;
            if (pilot.x > GAME_WIDTH)
                pilot.x = 0;
            if (pilot.y < 0)
                pilot.y = GAME_HEIGHT;
            if (pilot.y > GAME_HEIGHT)
                pilot.y = 0;
            // Проверяем столкновения пилота с пулями
            let hitByBullet = false;
            this.bullets.forEach((bullet) => {
                const dx = bullet.x - pilot.x;
                const dy = bullet.y - pilot.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const pilotSize = SHIP_SIZE / 4;
                if (distance < pilotSize) {
                    // Пилот убит пулей
                    hitByBullet = true;
                    const killer = this.players.get(bullet.ownerId);
                    if (killer) {
                        killer.kills++;
                        const player = this.players.get(pilot.playerId);
                        if (player) {
                            player.deaths++;
                            // Добавляем запись в килл-лог
                            const killEntry = {
                                killerId: killer.id,
                                killerName: killer.name,
                                killerColor: killer.color,
                                victimId: player.id,
                                victimName: player.name,
                                victimColor: player.color,
                                timestamp: Date.now(),
                            };
                            this.killLog.push(killEntry);
                        }
                    }
                }
            });
            if (hitByBullet) {
                const player = this.players.get(pilot.playerId);
                if (player) {
                    player.pilotId = undefined;
                }
                return false; // Удаляем пилота
            }
            // Проверяем столкновения пилота с кораблями
            let hitByShip = false;
            for (const [, shipPlayer] of this.players.entries()) {
                if (!shipPlayer.alive || !shipPlayer.connected)
                    continue;
                const dx = pilot.x - shipPlayer.x;
                const dy = pilot.y - shipPlayer.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const pilotSize = SHIP_SIZE / 4;
                if (distance < SHIP_MAX_RADIUS + pilotSize) {
                    // Пилот убит столкновением с кораблем
                    hitByShip = true;
                    const player = this.players.get(pilot.playerId);
                    if (player) {
                        player.deaths++;
                        shipPlayer.kills++;
                        // Добавляем запись в килл-лог
                        const killEntry = {
                            killerId: shipPlayer.id,
                            killerName: shipPlayer.name,
                            killerColor: shipPlayer.color,
                            victimId: player.id,
                            victimName: player.name,
                            victimColor: player.color,
                            timestamp: Date.now(),
                        };
                        this.killLog.push(killEntry);
                        player.pilotId = undefined;
                    }
                    break; // Выходим из цикла, так как пилот уже убит
                }
            }
            if (hitByShip) {
                return false; // Удаляем пилота
            }
            return true; // Пилот жив
        });
        // Update bullets
        this.bullets = this.bullets.filter((bullet) => {
            bullet.x += Math.cos(bullet.angle) * BULLET_SPEED;
            bullet.y += Math.sin(bullet.angle) * BULLET_SPEED;
            // Лазерные пули не удаляются при выходе за границы сразу
            if (bullet.laser) {
                // Лазер проходит через всю карту, удаляем только при выходе далеко за границы
                if (bullet.x < -100 ||
                    bullet.x > GAME_WIDTH + 100 ||
                    bullet.y < -100 ||
                    bullet.y > GAME_HEIGHT + 100) {
                    return false;
                }
            }
            else {
                // Обычные пули удаляются при выходе за границы
                if (bullet.x < 0 ||
                    bullet.x > GAME_WIDTH ||
                    bullet.y < 0 ||
                    bullet.y > GAME_HEIGHT) {
                    return false;
                }
            }
            // Check collision with asteroids
            let asteroidHit = this.checkAsteroidCollisions(bullet);
            if (asteroidHit) {
                return false; // Пуля уничтожена
            }
            // Check collision with players
            let hit = false;
            for (const [playerId, player] of this.players.entries()) {
                if (!player.alive || playerId === bullet.ownerId)
                    continue;
                const dx = bullet.x - player.x;
                const dy = bullet.y - player.y;
                const distance = Math.sqrt(dx ** 2 + dy ** 2);
                if (distance < SHIP_SIZE * 0.6) {
                    // Проверяем щит
                    if (player.hasShield) {
                        player.hasShield = false;
                        hit = true;
                        break; // Пуля уничтожена, но игрок жив
                    }
                    // Спавним пилота вместо полного уничтожения
                    this.spawnPilot(playerId, player.x, player.y);
                    player.alive = false;
                    player.deaths++;
                    const killer = this.players.get(bullet.ownerId);
                    if (killer) {
                        killer.kills++;
                        // Добавляем запись в килл-лог
                        const killEntry = {
                            killerId: killer.id,
                            killerName: killer.name,
                            killerColor: killer.color,
                            victimId: player.id,
                            victimName: player.name,
                            victimColor: player.color,
                            timestamp: Date.now(),
                        };
                        this.killLog.push(killEntry);
                    }
                    hit = true;
                    break; // Пуля попала, выходим из цикла
                }
            }
            return !hit;
        });
        // Check if game should end
        const alivePlayers = Array.from(this.players.values()).filter((p) => p.alive && p.connected);
        if (alivePlayers.length <= 1 &&
            this.players.size > 1 &&
            this.state === GameState.PLAYING) {
            this.endRound();
        }
    }
    checkPlayerCollisions(player) {
        this.players.forEach((otherPlayer, otherId) => {
            if (player.id === otherId || !otherPlayer.alive || !otherPlayer.connected)
                return;
            const dx = player.x - otherPlayer.x;
            const dy = player.y - otherPlayer.y;
            const distance = Math.sqrt(dx ** 2 + dy ** 2);
            if (distance > COLLISION_DISTANCE)
                return;
            const ship1Points = this.getShipTrianglePoints(player.x, player.y, player.angle);
            const ship2Points = this.getShipTrianglePoints(otherPlayer.x, otherPlayer.y, otherPlayer.angle);
            const isColliding = this.trianglesCollide(ship1Points, ship2Points);
            if (isColliding && distance > 0) {
                // Проверяем клинок-лазер
                if (player.hasLaserBlade && otherPlayer.alive) {
                    // Игрок с клинком наносит урон при столкновении
                    if (otherPlayer.hasShield) {
                        otherPlayer.hasShield = false;
                    }
                    else {
                        otherPlayer.alive = false;
                        otherPlayer.deaths++;
                        player.kills++;
                        // Добавляем запись в килл-лог
                        const killEntry = {
                            killerId: player.id,
                            killerName: player.name,
                            killerColor: player.color,
                            victimId: otherPlayer.id,
                            victimName: otherPlayer.name,
                            victimColor: otherPlayer.color,
                            timestamp: Date.now(),
                        };
                        this.killLog.push(killEntry);
                    }
                }
                else if (otherPlayer.hasLaserBlade && player.alive) {
                    // Другой игрок с клинком наносит урон
                    if (player.hasShield) {
                        player.hasShield = false;
                    }
                    else {
                        // Спавним пилота вместо полного уничтожения
                        this.spawnPilot(player.id, player.x, player.y);
                        player.alive = false;
                        player.deaths++;
                        otherPlayer.kills++;
                        // Добавляем запись в килл-лог
                        const killEntry = {
                            killerId: otherPlayer.id,
                            killerName: otherPlayer.name,
                            killerColor: otherPlayer.color,
                            victimId: player.id,
                            victimName: player.name,
                            victimColor: player.color,
                            timestamp: Date.now(),
                        };
                        this.killLog.push(killEntry);
                    }
                }
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
                const relativeSpeedAlongNormal = relativeVelX * normalX + relativeVelY * normalY;
                if (relativeSpeedAlongNormal < 0) {
                    const impulseScalar = ((1 + RESTITUTION) * relativeSpeedAlongNormal) / 2;
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
    getShipTrianglePoints(x, y, angle) {
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
    pointInTriangle(px, py, p1, p2, p3) {
        const d1 = (px - p2.x) * (p1.y - p2.y) - (p1.x - p2.x) * (py - p2.y);
        const d2 = (px - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (py - p3.y);
        const d3 = (px - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (py - p1.y);
        return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
    }
    trianglesCollide(triangle1, triangle2) {
        for (const point of triangle1) {
            if (this.pointInTriangle(point.x, point.y, triangle2[0], triangle2[1], triangle2[2])) {
                return true;
            }
        }
        for (const point of triangle2) {
            if (this.pointInTriangle(point.x, point.y, triangle1[0], triangle1[1], triangle1[2])) {
                return true;
            }
        }
        return false;
    }
    /**
     * Спавнит пилота при уничтожении корабля
     */
    spawnPilot(playerId, x, y) {
        const player = this.players.get(playerId);
        if (!player)
            return;
        // Удаляем предыдущего пилота, если есть
        if (player.pilotId) {
            const oldPilot = this.pilots.find((p) => p.id === player.pilotId);
            if (oldPilot) {
                const index = this.pilots.indexOf(oldPilot);
                if (index > -1) {
                    this.pilots.splice(index, 1);
                }
            }
        }
        const pilot = {
            id: `pilot_${this.pilotIdCounter++}`,
            playerId: playerId,
            x: x,
            y: y,
            angle: player.angle,
            velocityX: 0,
            velocityY: 0,
            alive: true,
        };
        this.pilots.push(pilot);
        player.pilotId = pilot.id;
    }
    /**
     * Проверяет столкновения игрока со стенами
     */
    checkWallCollisions(player) {
        this.walls.forEach((wall) => {
            // Все стены неразрушаемые и блокируют движение
            // Проверяем расстояние от точки до отрезка
            const dx = wall.x2 - wall.x1;
            const dy = wall.y2 - wall.y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length === 0)
                return;
            const t = Math.max(0, Math.min(1, ((player.x - wall.x1) * dx + (player.y - wall.y1) * dy) /
                (length * length)));
            const closestX = wall.x1 + t * dx;
            const closestY = wall.y1 + t * dy;
            const distX = player.x - closestX;
            const distY = player.y - closestY;
            const distance = Math.sqrt(distX * distX + distY * distY);
            if (distance < SHIP_MAX_RADIUS + WALL_THICKNESS / 2) {
                // Отталкиваем игрока от стены
                const normalX = distX / distance;
                const normalY = distY / distance;
                const overlap = SHIP_MAX_RADIUS + WALL_THICKNESS / 2 - distance;
                player.x += normalX * overlap;
                player.y += normalY * overlap;
                // Отражение скорости
                const dot = player.velocityX * normalX + player.velocityY * normalY;
                player.velocityX -= 2 * dot * normalX * RESTITUTION;
                player.velocityY -= 2 * dot * normalY * RESTITUTION;
            }
        });
    }
    /**
     * Проверяет столкновения пуль с астероидами
     */
    checkAsteroidCollisions(bullet) {
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const asteroid = this.asteroids[i];
            if (asteroid.type === AsteroidType.ANTIGRAVITY)
                continue; // Антигравитационные не разрушаются
            const dx = bullet.x - asteroid.x;
            const dy = bullet.y - asteroid.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < asteroid.radius) {
                // Астероид разрушен
                if (asteroid.type === AsteroidType.ORANGE) {
                    // Спавним collectable из оранжевого астероида
                    this.spawnCollectableFromAsteroid(asteroid.x, asteroid.y);
                }
                this.asteroids.splice(i, 1);
                return true; // Пуля уничтожена
            }
        }
        return false;
    }
    // Метод checkDestructibleWallCollisions удален, так как разрушаемые стены убраны
    /**
     * Спавнит collectable из разрушенного оранжевого астероида
     */
    spawnCollectableFromAsteroid(x, y) {
        const types = [
            CollectableType.REVERSE_TURN,
            CollectableType.LASER,
            CollectableType.SHIELD,
            CollectableType.LASER_BLADE,
        ];
        const randomType = types[Math.floor(Math.random() * types.length)];
        const collectable = {
            id: `collectable_${this.collectableIdCounter++}`,
            x: x,
            y: y,
            type: randomType,
        };
        this.collectables.push(collectable);
    }
    /**
     * Применяет антигравитационные силы от астероидов
     */
    applyAntigravityForce() {
        this.asteroids.forEach((asteroid) => {
            if (asteroid.type !== AsteroidType.ANTIGRAVITY)
                return;
            // Применяем к игрокам
            this.players.forEach((player) => {
                if (!player.alive || !player.connected)
                    return;
                const dx = player.x - asteroid.x;
                const dy = player.y - asteroid.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < ANTIGRAVITY_RANGE && distance > 0) {
                    const force = ANTIGRAVITY_FORCE / (distance / ANTIGRAVITY_RANGE);
                    const normalX = dx / distance;
                    const normalY = dy / distance;
                    player.velocityX += normalX * force;
                    player.velocityY += normalY * force;
                }
            });
            // Применяем к пулям
            this.bullets.forEach((bullet) => {
                const dx = bullet.x - asteroid.x;
                const dy = bullet.y - asteroid.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < ANTIGRAVITY_RANGE && distance > 0) {
                    const force = ANTIGRAVITY_FORCE / (distance / ANTIGRAVITY_RANGE);
                    const normalX = dx / distance;
                    const normalY = dy / distance;
                    bullet.x += normalX * force;
                    bullet.y += normalY * force;
                }
            });
            // Применяем к пилотам
            this.pilots.forEach((pilot) => {
                if (!pilot.alive)
                    return;
                const dx = pilot.x - asteroid.x;
                const dy = pilot.y - asteroid.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < ANTIGRAVITY_RANGE && distance > 0) {
                    const force = ANTIGRAVITY_FORCE / (distance / ANTIGRAVITY_RANGE);
                    const normalX = dx / distance;
                    const normalY = dy / distance;
                    pilot.velocityX += normalX * force;
                    pilot.velocityY += normalY * force;
                }
            });
        });
    }
    endRound() {
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
            if (b.kills !== a.kills)
                return b.kills - a.kills;
            return a.deaths - b.deaths;
        });
        this.roundResults = results;
        // Вычисляем время перехода в лобби (без автоматического запуска следующего раунда)
        const now = Date.now();
        this.nextRoundTime = now + ROUND_END_DELAY;
        this.broadcastGameState();
        // Переход в лобби после показа результатов (без автоматического запуска следующего раунда)
        setTimeout(() => {
            this.resetToLobby();
        }, ROUND_END_DELAY);
    }
    resetToLobby() {
        this.state = GameState.LOBBY;
        this.bullets = [];
        this.roundResults = [];
        this.nextRoundTime = null; // Сбрасываем таймер при переходе в лобби
        // Не очищаем killLog здесь, чтобы он оставался для отображения на экране результатов
        const now = Date.now();
        this.players.forEach((player) => {
            if (player.connected) {
                player.alive = true;
                player.x = Math.random() * GAME_WIDTH;
                player.y = Math.random() * GAME_HEIGHT;
                player.angle = Math.random() * Math.PI * 2;
                player.velocityX = 0;
                player.velocityY = 0;
                player.ammoReadyTime = this.initializeAmmo(now);
            }
        });
        this.broadcastGameState();
    }
    getGameState() {
        const now = Date.now();
        const players = Array.from(this.players.entries()).map(([id, player]) => {
            // Подсчитываем количество готовых зарядов
            const ammoCount = player.ammoReadyTime.filter((readyTime) => readyTime <= now).length;
            return {
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
                ammoReadyTime: [...player.ammoReadyTime], // Копируем массив
                ammoCount: ammoCount,
            };
        });
        // Логируем количество игроков для отладки
        const connectedCount = players.filter((p) => p.connected).length;
        if (players.length > 0) {
            console.log(`getGameState: Total players: ${players.length}, Connected: ${connectedCount}`);
        }
        const bullets = this.bullets.map((bullet) => ({
            x: bullet.x,
            y: bullet.y,
            angle: bullet.angle,
            laser: bullet.laser,
        }));
        const collectables = this.collectables
            .filter((c) => !c.collectedBy)
            .map((c) => ({
            id: c.id,
            x: c.x,
            y: c.y,
            type: c.type,
        }));
        const asteroids = this.asteroids.map((a) => ({
            id: a.id,
            x: a.x,
            y: a.y,
            radius: a.radius,
            type: a.type,
        }));
        const walls = this.walls.map((w) => ({
            id: w.id,
            x1: w.x1,
            y1: w.y1,
            x2: w.x2,
            y2: w.y2,
            destructible: w.destructible,
        }));
        const pilots = this.pilots
            .filter((p) => p.alive)
            .map((p) => ({
            id: p.id,
            playerId: p.playerId,
            x: p.x,
            y: p.y,
            angle: p.angle,
            alive: p.alive,
        }));
        return {
            state: this.state,
            hostId: this.hostId,
            players,
            bullets,
            results: this.roundResults,
            nextRoundTime: this.nextRoundTime || undefined,
            killLog: [...this.killLog], // Всегда отправляем массив (может быть пустым)
            roomCode: this.roomCode || undefined,
            collectables: collectables.length > 0 ? collectables : undefined,
            asteroids: asteroids.length > 0 ? asteroids : undefined,
            walls: walls.length > 0 ? walls : undefined,
            pilots: pilots.length > 0 ? pilots : undefined,
        };
    }
    broadcastGameState() {
        const state = this.getGameState();
        const message = JSON.stringify({ type: "gameState", data: state });
        console.log(`broadcastGameState: Sending to ${this.clients.size} clients, players: ${state.players.length}`);
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                }
                catch (error) {
                    console.error("Error sending game state to client:", error);
                    this.clients.delete(client);
                }
            }
            else {
                console.log(`Client not ready, state: ${client.readyState}`);
            }
        });
    }
    getRandomColor(usedColors = []) {
        const availableColors = PLAYER_COLORS.filter((color) => !usedColors.includes(color));
        if (availableColors.length === 0) {
            return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
        }
        return availableColors[Math.floor(Math.random() * availableColors.length)];
    }
}
//# sourceMappingURL=game-manager.js.map