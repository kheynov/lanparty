// Game state types
export var GameState;
(function (GameState) {
    GameState["LOBBY"] = "lobby";
    GameState["PLAYING"] = "playing";
    GameState["FINISHED"] = "finished";
})(GameState || (GameState = {}));
// Collectable types
export var CollectableType;
(function (CollectableType) {
    CollectableType["REVERSE_TURN"] = "reverseTurn";
    CollectableType["LASER"] = "laser";
    CollectableType["SHIELD"] = "shield";
    CollectableType["LASER_BLADE"] = "laserBlade";
})(CollectableType || (CollectableType = {}));
// Asteroid types
export var AsteroidType;
(function (AsteroidType) {
    AsteroidType["EMPTY"] = "empty";
    AsteroidType["ORANGE"] = "orange";
    AsteroidType["ANTIGRAVITY"] = "antigravity";
})(AsteroidType || (AsteroidType = {}));
//# sourceMappingURL=game-types.js.map