// Game State
let player
let enemy
let currentTurn = "player" // 'player' or 'enemy'
let deck = [] // Current Hand (3 cards)
let actionsRemaining = 2
let selectedCards = []
let gameLog = []
let gameMode = "pve" // 'pve' or 'pvp'

// Temporary storage for deck building
let p1DeckIndices = []
let p2DeckIndices = []

function startGame(mode) {
    document.getElementById("main-menu").style.display = "none"
    gameMode = mode || "pve"

    // Start Deck Building Phase for Player 1
    startDeckBuilding(1)
}

function startDeckBuilding(playerNum) {
    let selectedIndices = []
    updateDeckBuilderUI(selectedIndices, playerNum)
}

function updateDeckBuilderUI(selectedIndices, playerNum) {
    const playerName = playerNum === 1 ? "Player 1" : "Player 2"

    renderDeckBuilder(
        Compendium,
        selectedIndices,
        (index) => {
            // Toggle Logic
            // Unlimited selection allowed if available > 0
            const spell = Compendium[index]

            if (selectedIndices.length < 4) {
                selectedIndices.push(index)
            } else {
                const idx = selectedIndices.indexOf(index)
                if (idx > -1) selectedIndices.splice(idx, 1)
            }

            updateDeckBuilderUI(selectedIndices, playerNum)
        },
        () => {
            // On Complete
            if (playerNum === 1) {
                p1DeckIndices = [...selectedIndices]

                if (gameMode === "pvp") {
                    // Start P2 Selection
                    startDeckBuilding(2)
                } else {
                    // Generate AI Deck
                    generateAiDeck()
                    init()
                }
            } else {
                // P2 Complete
                p2DeckIndices = [...selectedIndices]
                init()
            }
        },
        playerName
    )
}

function generateAiDeck() {
    p2DeckIndices = []
    // "AI picks randomly one of each"
    // Interpretation: Pick 4 random cards from available ones.
    // Filter available > 0
    const availableIndices = Compendium.map((s, i) => ({ s, i }))
        .filter((x) => x.s.available > 0)
        .map((x) => x.i)

    for (let i = 0; i < 4; i++) {
        const rand = availableIndices[Math.floor(Math.random() * availableIndices.length)]
        p2DeckIndices.push(rand)
    }
}

function init() {
    // Get Move Spells (always included)
    const moveSpells = Compendium.filter((s) => s.type === SpellType.MOVE)

    // Initialize entities
    // Player on left
    player = new Wizard("Player", 4, 0, 0, "blue")
    const p1Spells = p1DeckIndices.map((i) => Compendium[i]).concat(moveSpells)
    player.setSpellBook(p1Spells)

    // Enemy on right
    enemy = new Wizard(gameMode === "pvp" ? "Player 2" : "Enemy", 4, 1, 0, "red")
    const p2Spells = p2DeckIndices.map((i) => Compendium[i]).concat(moveSpells)
    enemy.setSpellBook(p2Spells)

    // Initial Draw
    currentTurn = "player" // Start with player
    startTurn()
    gameLoop()
}

function startTurn() {
    actionsRemaining = 2 // Action Points
    selectedCards = []

    const currentWizard = currentTurn === "player" ? player : enemy
    currentWizard.resetModifiers()

    drawCards()
    updateUI()

    if (gameMode === "pve" && currentTurn === "enemy") {
        setTimeout(performAiTurn, 1000)
    }
}

function drawCards() {
    deck = []
    const currentWizard = currentTurn === "player" ? player : enemy
    const spellBook = currentWizard.spellBook

    // Sample 3 random cards from SpellBook
    for (let i = 0; i < 3; i++) {
        if (spellBook.length === 0) break
        const randomIndex = Math.floor(Math.random() * spellBook.length)
        deck.push(spellBook[randomIndex])
    }
    renderHand()
}

function selectCard(index) {
    if (gameMode === "pve" && currentTurn === "enemy") return

    // Select if we have enough action points
    const currentCost = selectedCards.reduce((sum, idx) => sum + deck[idx].cost, 0)
    const cardCost = deck[index].cost

    if (currentCost + cardCost <= actionsRemaining) {
        selectedCards.push(index)
    }

    renderHand()

    // Check if we have used all action points
    const totalCost = selectedCards.reduce((sum, idx) => sum + deck[idx].cost, 0)
    if (totalCost === actionsRemaining) {
        // Small delay to show the selection before executing
        setTimeout(executeSequence, 500)
    }
}

async function executeSequence() {
    // Disable interaction during execution
    const handContainer = document.getElementById("hand-container")
    handContainer.style.pointerEvents = "none"

    // Highlight battlefield
    const canvas = document.getElementById("game-canvas")
    canvas.classList.add("active")

    const caster = currentTurn === "player" ? player : enemy
    const target = currentTurn === "player" ? enemy : player

    // Execute cards in order
    for (const cardIndex of selectedCards) {
        const spell = deck[cardIndex]
        castSpell(caster, target, spell)

        // Wait for animation/effect
        await new Promise((resolve) => setTimeout(resolve, 1500))
    }

    // Remove highlight
    canvas.classList.remove("active")

    // Clear selection but keep deck for visual history until next turn
    selectedCards = []
    actionsRemaining = 0 // All actions used

    updateUI()
    renderHand()

    handContainer.style.pointerEvents = "auto"

    // End turn
    setTimeout(switchTurn, 500)
}

function switchTurn() {
    if (currentTurn === "player") {
        currentTurn = "enemy"
    } else {
        currentTurn = "player"
    }
    startTurn()
}

function performAiTurn() {
    // Simple AI: Select 2 random cards
    const indices = [0, 1, 2]
    // Shuffle
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }

    const pick1 = indices[0]
    const pick2 = indices[1]

    // Simulate selection
    selectedCards.push(pick1)
    renderHand()

    setTimeout(() => {
        selectedCards.push(pick2)
        renderHand()
        setTimeout(executeSequence, 500)
    }, 1000)
}

function castSpell(caster, target, spell) {
    console.log(`${caster.name} casts ${spell.name}`)

    if (spell.type === SpellType.MODIFIER) {
        if (spell.parameters.beta_x_modify) caster.modifiers.beta_x += spell.parameters.beta_x_modify
        if (spell.parameters.beta_zero_modify) caster.modifiers.beta_zero += spell.parameters.beta_zero_modify
    } else if (spell.type === SpellType.MOVE) {
        if (spell.parameters.move_self_y) {
            caster.targetY += spell.parameters.move_self_y
            // Clamp to grid (-1 to 1)
            caster.targetY = Math.max(-1, Math.min(1, caster.targetY))
        }
        if (spell.parameters.move_target_y) {
            target.targetY += spell.parameters.move_target_y
            // Clamp to grid (-1 to 1)
            target.targetY = Math.max(-1, Math.min(1, target.targetY))
        }
    } else if (spell.type === SpellType.ATTACK) {
        // Calculate trajectory with CI noise
        let baseSlope = spell.parameters.beta_x
        if (spell.parameters.beta_x_min !== undefined && spell.parameters.beta_x_max !== undefined) {
            baseSlope = spell.parameters.beta_x_min + Math.random() * (spell.parameters.beta_x_max - spell.parameters.beta_x_min)
        }

        let baseIntercept = spell.parameters.beta_zero
        if (spell.parameters.beta_zero_min !== undefined && spell.parameters.beta_zero_max !== undefined) {
            baseIntercept =
                spell.parameters.beta_zero_min + Math.random() * (spell.parameters.beta_zero_max - spell.parameters.beta_zero_min)
        }

        const slope = baseSlope + caster.modifiers.beta_x
        // Intercept is relative to caster's Y position
        const relativeIntercept = baseIntercept + caster.modifiers.beta_zero
        const intercept = relativeIntercept + caster.y

        // Capture modifiers before reset
        const currentModifiers = { ...caster.modifiers }

        // Reset modifiers after attack
        caster.resetModifiers()

        // Check hit
        // Determine target X based on who is being targeted
        // Player is at x=0, Enemy is at x=1
        const targetX = target.name === "Player" ? 0 : 1
        const targetY = target.y // Use target's actual Y position

        let hitY

        if (caster.name === "Player") {
            // Player shoots from Left to Right (Standard)
            // y = mx + c (where c is now absolute intercept)
            hitY = slope * targetX + intercept
            visualizeShot(slope, intercept, caster, spell.parameters.duration, spell.parameters, currentModifiers)
        } else {
            // Enemy shoots from Right to Left (Perspective)
            hitY = -slope * (targetX - caster.x) + intercept
            visualizeShot(slope, intercept, caster, spell.parameters.duration, spell.parameters, currentModifiers)
        }

        // Hit check with tolerance
        // Use PIXELS_PER_Y_UNIT for Y tolerance
        const tolerance = target.height / 2 / PIXELS_PER_Y_UNIT

        if (Math.abs(hitY - targetY) <= tolerance) {
            console.log("Hit!")
            // Delay damage until animation hits
            setTimeout(() => {
                target.takeDamage(1)
                updateUI() // Update UI to reflect damage
                checkGameOver()

                // Create particles at target location
                // Target is at targetX, targetY
                // Convert to screen coordinates
                // X: If targetX is 0, ORIGIN_X. If targetX is 1, ORIGIN_X + AXIS_LENGTH.
                const screenX = ORIGIN_X + targetX * AXIS_LENGTH
                const screenY = ORIGIN_Y - targetY * PIXELS_PER_Y_UNIT
                createImpactParticles(screenX, screenY, "cyan") // Ice color
            }, spell.parameters.duration)
        } else {
            console.log(`Miss! Shot at y=${hitY}, target at y=${targetY}`)
        }
    }
}

function checkGameOver() {
    if (!player.isAlive() || !enemy.isAlive()) {
        const gameOverScreen = document.getElementById("game-over-screen")
        const title = document.getElementById("game-over-title")
        const message = document.getElementById("game-over-message")

        gameOverScreen.style.display = "flex"

        if (!player.isAlive()) {
            if (gameMode === "pve") {
                title.innerText = "Game Over"
                message.innerText = "You have been defeated!"
            } else {
                title.innerText = "Player 2 Wins!"
                message.innerText = "Player 1 has been defeated!"
            }
        } else {
            if (gameMode === "pve") {
                title.innerText = "Well Done!"
                message.innerText = "You have defeated the enemy!"
            } else {
                title.innerText = "Player 1 Wins!"
                message.innerText = "Player 2 has been defeated!"
            }
        }
    }
}

function update() {
    // Animate Player Movement
    if (player.y !== player.targetY) {
        const diff = player.targetY - player.y
        if (Math.abs(diff) < 0.01) {
            player.y = player.targetY
        } else {
            player.y += diff * 0.1
        }
    }

    // Animate Enemy Movement
    if (enemy.y !== enemy.targetY) {
        const diff = enemy.targetY - enemy.y
        if (Math.abs(diff) < 0.01) {
            enemy.y = enemy.targetY
        } else {
            enemy.y += diff * 0.1
        }
    }

    updateParticles()
}

function gameLoop() {
    update()
    draw()
    requestAnimationFrame(gameLoop)
}

document.getElementById("end-turn-btn").onclick = () => {
    if (currentTurn === "player") {
        switchTurn()
    } else if (gameMode === "pvp" && currentTurn === "enemy") {
        switchTurn()
    }
}
