// Game configuration constants
export const MAX_PLAYERS = 15;
export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;
// Physics constants
export const ACCELERATION = 0.15; // Ship acceleration
export const MAX_SPEED = 5; // Maximum speed
export const FRICTION = 0.98; // Friction (inertia)
export const BULLET_SPEED = 8;
// Ammo system constants
export const AMMO_CLIP_SIZE = 3; // Размер обоймы (количество зарядов)
export const AMMO_RELOAD_TIME = 2000; // Время перезарядки одного заряда в миллисекундах
export const TURN_SPEED = 0.03; // Базовая скорость поворота
export const TURN_SPEED_MAX = 0.15; // Максимальная скорость поворота
export const TURN_ACCELERATION_TIME = 3000; // Время в мс для достижения максимальной скорости поворота
// Ship dimensions
export const SHIP_SIZE = 30; // Ship size (length from nose to tail)
export const SHIP_MAX_RADIUS = Math.max(SHIP_SIZE, Math.sqrt(Math.pow(SHIP_SIZE * 0.6, 2) + Math.pow(SHIP_SIZE * 0.5, 2)));
// Collision constants
export const COLLISION_DISTANCE = SHIP_MAX_RADIUS * 2; // Minimum distance between ship centers
export const COLLISION_FORCE = 0.8; // Repulsion force on collision
export const RESTITUTION = 0.6; // Coefficient of restitution (elasticity, 0-1)
export const SHIP_MASS = 1.0; // Ship mass (same for all)
// Available player colors - максимально контрастные цвета для лучшей различимости
// Цвета равномерно распределены по цветовому кругу (каждые 24 градуса для 15 игроков)
// Используются яркие, насыщенные цвета для видимости на темном фоне
// Функция для конвертации HSL в RGB
function hslToRgb(h, s, l) {
    h = h / 360;
    s = s / 100;
    l = l / 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l; // achromatic
    }
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0)
                t += 1;
            if (t > 1)
                t -= 1;
            if (t < 1 / 6)
                return p + (q - p) * 6 * t;
            if (t < 1 / 2)
                return q;
            if (t < 2 / 3)
                return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (c) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
// Генерируем 15 цветов, равномерно распределенных по цветовому кругу
// Каждый цвет на 24 градуса (360 / 15) от предыдущего
export const PLAYER_COLORS = [];
for (let i = 0; i < 15; i++) {
    const hue = (i * 24) % 360; // 24 градуса между цветами
    const saturation = 100; // Полная насыщенность для ярких цветов
    const lightness = 50; // Средняя яркость для хорошей видимости
    PLAYER_COLORS.push(hslToRgb(hue, saturation, lightness));
}
// Game timing
export const GAME_FPS = 60;
export const ROUND_END_DELAY = 10000; // 10 seconds
// Drift mechanics
export const DOUBLE_TAP_TIME = 300; // Время в мс для определения двойного нажатия
export const DRIFT_ANGLE = Math.PI / 2; // 90 градусов для дрифта
export const DRIFT_BOOST = 8; // Импульс скорости при дрифте
// Collectables constants
export const COLLECTABLE_SIZE = 20; // Размер collectable объекта
export const COLLECTABLE_SPAWN_INTERVAL = 20000; // Интервал спавна в мс (20 секунд, увеличено)
export const COLLECTABLE_SPAWN_CHANCE = 0.25; // Вероятность появления при каждом интервале (25%, уменьшено)
export const REVERSE_TURN_DURATION = 5000; // Длительность эффекта реверса поворота (5 секунд)
export const LASER_BACKWARD_FORCE = 3; // Сила отбрасывания при выстреле лазером
export const COLLECTABLE_COLLECTION_DISTANCE = 40; // Расстояние для сбора collectable
// Environment constants
export const WALL_THICKNESS = 10; // Толщина стен
export const ASTEROID_MIN_RADIUS = 15; // Минимальный радиус астероида (меньше размера корабля)
export const ASTEROID_MAX_RADIUS = 25; // Максимальный радиус астероида (меньше размера корабля)
export const ASTEROID_COUNT = 8; // Количество астероидов на карте (уменьшено)
export const WALL_COUNT = 5; // Количество стен на карте
export const DESTRUCTIBLE_WALL_COUNT = 10; // Количество разрушаемых стен
export const ANTIGRAVITY_FORCE = 0.5; // Сила отталкивания антигравитационных астероидов
export const ANTIGRAVITY_RANGE = 200; // Радиус действия антигравитации
//# sourceMappingURL=game-constants.js.map