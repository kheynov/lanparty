import { GameManager } from "./game-manager.js";
export declare class RoomManager {
    private rooms;
    private roomCodes;
    /**
     * Генерирует уникальный 6-значный код комнаты
     */
    private generateRoomCode;
    /**
     * Создает новую комнату и возвращает её код
     */
    createRoom(): string;
    /**
     * Получает GameManager для комнаты по коду
     */
    getRoom(roomCode: string): GameManager | null;
    /**
     * Проверяет существование комнаты
     */
    roomExists(roomCode: string): boolean;
    /**
     * Удаляет комнату (например, когда все игроки вышли)
     */
    removeRoom(roomCode: string): void;
    /**
     * Получает все активные комнаты
     */
    getAllRooms(): Map<string, GameManager>;
}
//# sourceMappingURL=room-manager.d.ts.map