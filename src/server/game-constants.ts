// Game configuration constants
export const MAX_PLAYERS = 10;
export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

// Physics constants
export const ACCELERATION = 0.15; // Ship acceleration
export const MAX_SPEED = 5; // Maximum speed
export const FRICTION = 0.98; // Friction (inertia)
export const BULLET_SPEED = 8;
export const TURN_SPEED = 0.03; // Базовая скорость поворота
export const TURN_SPEED_MAX = 0.15; // Максимальная скорость поворота
export const TURN_ACCELERATION_TIME = 3000; // Время в мс для достижения максимальной скорости поворота

// Ship dimensions
export const SHIP_SIZE = 30; // Ship size (length from nose to tail)
export const SHIP_MAX_RADIUS = Math.max(
  SHIP_SIZE,
  Math.sqrt(Math.pow(SHIP_SIZE * 0.6, 2) + Math.pow(SHIP_SIZE * 0.5, 2))
);

// Collision constants
export const COLLISION_DISTANCE = SHIP_MAX_RADIUS * 2; // Minimum distance between ship centers
export const COLLISION_FORCE = 0.8; // Repulsion force on collision
export const RESTITUTION = 0.6; // Coefficient of restitution (elasticity, 0-1)
export const SHIP_MASS = 1.0; // Ship mass (same for all)

// Available player colors - максимально контрастные цвета для лучшей различимости
// Цвета равномерно распределены по цветовому кругу (каждые 36 градусов для 10 игроков)
// Используются яркие, насыщенные цвета для видимости на темном фоне
export const PLAYER_COLORS = [
  "#FF0000", // 1. Красный - чистый красный
  "#FF8800", // 2. Оранжевый - яркий оранжевый
  "#FFDD00", // 3. Желтый - яркий желтый
  "#88FF00", // 4. Лайм - яркий лаймовый
  "#00FF00", // 5. Зеленый - чистый зеленый
  "#00FF88", // 6. Аквамарин - зелено-голубой
  "#00FFFF", // 7. Циан - чистый голубой
  "#0088FF", // 8. Синий - яркий синий
  "#8800FF", // 9. Фиолетовый - яркий фиолетовый
  "#FF00FF", // 10. Пурпурный/Магента - чистый пурпурный
];

// Game timing
export const GAME_FPS = 60;
export const ROUND_END_DELAY = 10000; // 10 seconds
export const LOBBY_DELAY = 3000; // 3 seconds

// Drift mechanics
export const DOUBLE_TAP_TIME = 300; // Время в мс для определения двойного нажатия
export const DRIFT_ANGLE = Math.PI / 2; // 90 градусов для дрифта
export const DRIFT_BOOST = 8; // Импульс скорости при дрифте
