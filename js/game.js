// Game State
let player
let enemy
let currentTurn = "player" // 'player' or 'enemy'
let deck = [] // Current Hand (3 cards)
let actionsRemaining = 2
let selectedCards = []
let gameLog = []
let gameMode = "pve" // 'pve' or 'pvp'
let p1Character = null
let p2Character = null

// Temporary storage for deck building
let p1DeckIndices = []
let p2DeckIndices = []

function startGame(mode) {
    document.getElementById("main-menu").style.display = "none"
    gameMode = mode || "pve"

    if (gameMode === "pvp") {
        startCharacterSelection(1)
    } else {
        // PvE Defaults
        p1Character = Characters.Player
        p2Character = Characters.Quicksilver
        startDeckBuilding(1)
    }
}

function startCharacterSelection(playerNum) {
    renderCharacterSelection((char) => {
        if (playerNum === 1) {
            p1Character = char
            startCharacterSelection(2)
        } else {
            p2Character = char
            startDeckBuilding(1)
        }
    }, playerNum)
}

function startDeckBuilding(playerNum) {
    let selectedIndices = []
    updateDeckBuilderUI(selectedIndices, playerNum)
}

function updateDeckBuilderUI(selectedIndices, playerNum) {
    const playerName = playerNum === 1 ? "Player 1" : "Player 2"
    const character = playerNum === 1 ? p1Character : p2Character

    renderDeckBuilder(
        Compendium,
        selectedIndices,
        (index, action) => {
            // Toggle Logic
            const spell = Compendium[index]
            const isOffensive = spell.type === SpellType.ATTACK

            // Count current selections
            const offensiveCount = selectedIndices.filter((i) => Compendium[i].type === SpellType.ATTACK).length
            const defensiveCount = selectedIndices.filter((i) => Compendium[i].type !== SpellType.ATTACK).length

            if (action === "remove") {
                const idx = selectedIndices.indexOf(index)
                if (idx > -1) {
                    selectedIndices.splice(idx, 1)
                }
            } else {
                // Add
                if (isOffensive) {
                    if (offensiveCount < character.n_spells_offensive) selectedIndices.push(index)
                } else {
                    if (defensiveCount < character.n_spells_defensive) selectedIndices.push(index)
                }
            }

            updateDeckBuilderUI(selectedIndices, playerNum)
        },
        () => {
            // On Complete
            // Validate deck size
            const offensiveCount = selectedIndices.filter((i) => Compendium[i].type === SpellType.ATTACK).length
            const defensiveCount = selectedIndices.filter((i) => Compendium[i].type !== SpellType.ATTACK).length

            if (offensiveCount !== character.n_spells_offensive || defensiveCount !== character.n_spells_defensive) {
                alert(
                    `You must select exactly ${character.n_spells_offensive} offensive and ${character.n_spells_defensive} defensive spells.`
                )
                return
            }

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
        playerName,
        character
    )
}

function generateAiDeck() {
    p2DeckIndices = []
    // AI picks from its character spells
    const character = p2Character || Characters.Quicksilver // Fallback
    const availableIndices = Compendium.map((s, i) => ({ s, i }))
        .filter((item) => character.spells.includes(item.s.id))
        .map((x) => x.i)

    const offensiveIndices = availableIndices.filter((i) => Compendium[i].type === SpellType.ATTACK)
    const defensiveIndices = availableIndices.filter((i) => Compendium[i].type !== SpellType.ATTACK)

    // Pick n_spells_offensive
    const shuffledOffensive = [...offensiveIndices].sort(() => 0.5 - Math.random())
    p2DeckIndices.push(...shuffledOffensive.slice(0, character.n_spells_offensive))

    // Pick n_spells_defensive
    const shuffledDefensive = [...defensiveIndices].sort(() => 0.5 - Math.random())
    p2DeckIndices.push(...shuffledDefensive.slice(0, character.n_spells_defensive))
}

function init() {
    // Initialize entities
    // Player on left
    player = new Wizard("Player", 4, 0, 0, "blue", p1Character ? p1Character.sprite : "img/character_player.png")
    const p1Spells = p1DeckIndices.map((i) => Compendium[i])
    player.setSpellBook(p1Spells)

    // Enemy on right
    enemy = new Wizard(
        gameMode === "pvp" ? "Player 2" : "Enemy",
        4,
        1,
        0,
        "red",
        p2Character ? p2Character.sprite : "img/character_quicksilver.png"
    )
    const p2Spells = p2DeckIndices.map((i) => Compendium[i])
    enemy.setSpellBook(p2Spells)

    // Set Sprites in Renderer
    setEntitySprites(player.sprite, enemy.sprite)

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
    const character = currentTurn === "player" ? p1Character : p2Character
    const handSize = character ? character.n_spells_hand : 3

    // Ensure at least 1 offensive and 1 defensive spell if possible
    const offensiveSpells = spellBook.filter((s) => s.type === SpellType.ATTACK)
    const defensiveSpells = spellBook.filter((s) => s.type !== SpellType.ATTACK)

    if (offensiveSpells.length > 0) {
        const rand = Math.floor(Math.random() * offensiveSpells.length)
        deck.push(offensiveSpells[rand])
    }

    if (defensiveSpells.length > 0) {
        const rand = Math.floor(Math.random() * defensiveSpells.length)
        deck.push(defensiveSpells[rand])
    }

    // Fill remaining slots (up to handSize)
    while (deck.length < handSize) {
        if (spellBook.length === 0) break
        const randomIndex = Math.floor(Math.random() * spellBook.length)
        deck.push(spellBook[randomIndex])
    }
    renderHand()
}

function selectCard(index) {
    if (gameMode === "pve" && currentTurn === "enemy") return

    // Single selection per turn check
    // (keep the logic for multiple selection in but make a note that it might be useful when we implement a skill tree with skills allowing for re-use of spells)
    if (selectedCards.includes(index)) return

    // Select if we have enough action points
    const currentCost = selectedCards.reduce((sum, idx) => sum + deck[idx].parameters.cost, 0)
    const cardCost = deck[index].parameters.cost

    if (currentCost + cardCost <= actionsRemaining) {
        selectedCards.push(index)
    } else {
        showToast("Not enough AP")
    }

    renderHand()
    updateUI()

    // Check if we have used all action points
    const totalCost = selectedCards.reduce((sum, idx) => sum + deck[idx].parameters.cost, 0)
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
    // Simple AI: Select random cards that fit in AP
    const indices = deck.map((_, i) => i) // Available indices
    // Shuffle
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }

    let currentCost = 0
    const aiSelected = []

    for (const idx of indices) {
        const card = deck[idx]
        if (currentCost + card.parameters.cost <= actionsRemaining) {
            aiSelected.push(idx)
            currentCost += card.parameters.cost
        }
    }

    // Simulate selection
    if (aiSelected.length > 0) {
        selectedCards.push(aiSelected[0])
        renderHand()

        if (aiSelected.length > 1) {
            setTimeout(() => {
                selectedCards.push(aiSelected[1])
                renderHand()
                setTimeout(executeSequence, 500)
            }, 1000)
        } else {
            setTimeout(executeSequence, 1000)
        }
    } else {
        // No cards selected (shouldn't happen if costs are low, but possible)
        setTimeout(switchTurn, 1000)
    }
}

function castSpell(caster, target, spell) {
    console.log(`${caster.name} casts ${spell.name}`)

    if (spell.type === SpellType.MODIFIER) {
        if (spell.parameters.beta_x_modify) caster.modifiers.beta_x += spell.parameters.beta_x_modify
        if (spell.parameters.beta_zero_modify) caster.modifiers.beta_zero += spell.parameters.beta_zero_modify
        if (spell.parameters.animation_prespell) caster.modifiers.animation_prespell = spell.parameters.animation_prespell
    } else if (spell.type === SpellType.MOVE) {
        let moved = false
        if (spell.parameters.move_self_y) {
            const oldY = caster.targetY
            caster.targetY += spell.parameters.move_self_y
            // Clamp to grid (-1 to 1)
            caster.targetY = Math.max(-1, Math.min(1, caster.targetY))
            if (caster.targetY !== oldY) moved = true
        }
        if (spell.parameters.move_target_y) {
            const oldY = target.targetY
            target.targetY += spell.parameters.move_target_y
            // Clamp to grid (-1 to 1)
            target.targetY = Math.max(-1, Math.min(1, target.targetY))
            if (target.targetY !== oldY) moved = true
        }
        if (!moved) flashCanvas("miss")
    } else if (spell.type === SpellType.ATTACK) {
        // Handle Move-based Attacks (e.g. Strong Wind)
        if (spell.parameters.move_self_y || spell.parameters.move_target_y) {
            let moved = false
            if (spell.parameters.move_self_y) {
                const oldY = caster.targetY
                caster.targetY += spell.parameters.move_self_y
                caster.targetY = Math.max(-1, Math.min(1, caster.targetY))
                if (caster.targetY !== oldY) moved = true
            }
            if (spell.parameters.move_target_y) {
                const oldY = target.targetY
                target.targetY += spell.parameters.move_target_y
                target.targetY = Math.max(-1, Math.min(1, target.targetY))
                if (target.targetY !== oldY) moved = true
            }
            if (!moved) flashCanvas("miss")
            // If it doesn't have attack parameters, stop here
            if (spell.parameters.beta_x === undefined) return
        }

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
            flashCanvas("hit")
            // Delay damage until animation hits
            setTimeout(() => {
                const damage = spell.parameters.damage || 1
                target.takeDamage(damage)
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
            flashCanvas("miss")
        }
    }
}

function flashCanvas(type) {
    const canvas = document.getElementById("game-canvas")
    canvas.classList.add(type)
    setTimeout(() => {
        canvas.classList.remove(type)
    }, 500)
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
    if (selectedCards.length > 0) {
        executeSequence()
    } else {
        if (currentTurn === "player") {
            switchTurn()
        } else if (gameMode === "pvp" && currentTurn === "enemy") {
            switchTurn()
        }
    }
}
