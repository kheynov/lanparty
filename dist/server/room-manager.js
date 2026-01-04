import { GameManager } from "./game-manager.js";
export class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.roomCodes = new Set();
    }
    /**
     * Генерирует уникальный 6-значный код комнаты
     */
    generateRoomCode() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let code;
        do {
            code = "";
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        } while (this.roomCodes.has(code));
        return code;
    }
    /**
     * Создает новую комнату и возвращает её код
     */
    createRoom() {
        const code = this.generateRoomCode();
        const gameManager = new GameManager(code);
        this.rooms.set(code, gameManager);
        this.roomCodes.add(code);
        console.log(`Room created with code: ${code}`);
        return code;
    }
    /**
     * Получает GameManager для комнаты по коду
     */
    getRoom(roomCode) {
        return this.rooms.get(roomCode) || null;
    }
    /**
     * Проверяет существование комнаты
     */
    roomExists(roomCode) {
        return this.rooms.has(roomCode);
    }
    /**
     * Удаляет комнату (например, когда все игроки вышли)
     */
    removeRoom(roomCode) {
        this.rooms.delete(roomCode);
        this.roomCodes.delete(roomCode);
        console.log(`Room ${roomCode} removed`);
    }
    /**
     * Получает все активные комнаты
     */
    getAllRooms() {
        return this.rooms;
    }
}
//# sourceMappingURL=room-manager.js.map