const canvas = document.getElementById("game-canvas")
const ctx = canvas.getContext("2d")

// Game Constants
const GRID_SIZE = 50
const ORIGIN_X = 60
const ORIGIN_Y = 300 // Vertical Middle (600 / 2)
const AXIS_LENGTH = 680 // 800 - 60 - 60
const PIXELS_PER_UNIT = AXIS_LENGTH // 1 unit = full width
const PIXELS_PER_Y_UNIT = 200
