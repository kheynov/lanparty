import { GameManager } from "./game-manager.js";

export class RoomManager {
  private rooms: Map<string, GameManager> = new Map();
  private roomCodes: Set<string> = new Set();

  /**
   * Генерирует уникальный 6-значный код комнаты
   */
  private generateRoomCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code: string;
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
  public createRoom(): string {
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
  public getRoom(roomCode: string): GameManager | null {
    return this.rooms.get(roomCode) || null;
  }

  /**
   * Проверяет существование комнаты
   */
  public roomExists(roomCode: string): boolean {
    return this.rooms.has(roomCode);
  }

  /**
   * Удаляет комнату (например, когда все игроки вышли)
   */
  public removeRoom(roomCode: string): void {
    this.rooms.delete(roomCode);
    this.roomCodes.delete(roomCode);
    console.log(`Room ${roomCode} removed`);
  }

  /**
   * Получает все активные комнаты
   */
  public getAllRooms(): Map<string, GameManager> {
    return this.rooms;
  }
}

