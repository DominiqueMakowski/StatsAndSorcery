function renderHand() {
    const handContainer = document.getElementById("hand-container")
    const bottomBar = document.getElementById("bottom-bar")

    handContainer.innerHTML = ""

    // Align hand based on turn
    bottomBar.className = "" // Reset classes
    if (currentTurn === "player") {
        bottomBar.classList.add("align-left")
    } else if (currentTurn === "enemy" && gameMode === "pvp") {
        bottomBar.classList.add("align-right")
    }

    deck.forEach((spell, index) => {
        const card = document.createElement("div")
        card.className = "card"
        card.style.backgroundColor = spell.color // Use spell color
        card.style.color = "black" // Ensure text is readable on light backgrounds

        // Check selection
        const selectionIndices = []
        selectedCards.forEach((cardIndex, i) => {
            if (cardIndex === index) {
                selectionIndices.push(i + 1)
            }
        })

        if (selectionIndices.length > 0) {
            card.classList.add("selected")

            // Add badges
            selectionIndices.forEach((order, i) => {
                const badge = document.createElement("div")
                badge.className = "card-order-badge"
                badge.innerText = order
                badge.style.right = `${5 + i * 25}px`
                card.appendChild(badge)
            })
        }

        card.innerHTML += `<strong>${spell.name}</strong> <span style="position:absolute; top:5px; left:5px; color:purple; font-weight:bold; font-size: 12px;">${spell.cost}</span>`

        if (spell.type === SpellType.ATTACK) {
            const e = spell.parameters
            const ciLevel = (e.beta_x_ci || 0.95) * 100

            card.innerHTML += `
            <table class="spell-stats">
                <thead>
                    <tr><th></th><th>Effect</th><th>${ciLevel}% CI</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>B(0)</td>
                        <td>${e.beta_zero.toFixed(1)}</td>
                        <td>[${e.beta_zero_min.toFixed(1)}, ${e.beta_zero_max.toFixed(1)}]</td>
                    </tr>
                    <tr>
                        <td>B(x)</td>
                        <td>${e.beta_x.toFixed(1)}</td>
                        <td>[${e.beta_x_min.toFixed(1)}, ${e.beta_x_max.toFixed(1)}]</td>
                    </tr>
                </tbody>
            </table>`
        } else {
            card.innerHTML += `<br><small>${spell.description}</small>`
        }

        card.onclick = () => selectCard(index)
        card.oncontextmenu = (e) => {
            e.preventDefault()
            deselectCard(index)
        }
        handContainer.appendChild(card)
    })
}

function deselectCard(index) {
    if (gameMode === "pve" && currentTurn === "enemy") return

    // Remove the LAST instance of this card from selectedCards
    // Find the last index of 'index' in selectedCards
    const lastIndex = selectedCards.lastIndexOf(index)
    if (lastIndex > -1) {
        selectedCards.splice(lastIndex, 1)
        renderHand()
    }
}

function updateUI() {
    // Render Player HP as circles
    const playerHpContainer = document.getElementById("player-hp-container")
    playerHpContainer.innerHTML = ""
    for (let i = 0; i < player.maxHp; i++) {
        const circle = document.createElement("div")
        circle.className = "hp-circle"
        if (i >= player.hp) {
            circle.classList.add("lost")
        }
        playerHpContainer.appendChild(circle)
    }

    // Render actions as purple circles
    const actionsContainer = document.getElementById("player-actions")
    actionsContainer.innerHTML = "" // Clear previous content
    for (let i = 0; i < actionsRemaining; i++) {
        const circle = document.createElement("span")
        circle.style.display = "inline-block"
        circle.style.width = "15px"
        circle.style.height = "15px"
        circle.style.backgroundColor = "purple"
        circle.style.borderRadius = "50%"
        circle.style.marginRight = "5px"
        actionsContainer.appendChild(circle)
    }

    // Render Enemy HP as circles
    const enemyHpContainer = document.getElementById("enemy-hp-container")
    enemyHpContainer.innerHTML = ""
    for (let i = 0; i < enemy.maxHp; i++) {
        const circle = document.createElement("div")
        circle.className = "hp-circle"
        if (i >= enemy.hp) {
            circle.classList.add("lost")
        }
        enemyHpContainer.appendChild(circle)
    }

    const turnName = currentTurn === "player" ? "Player 1" : gameMode === "pvp" ? "Player 2" : "Enemy"
    document.getElementById("turn-indicator").innerText = `${turnName}'s Turn`

    const endTurnBtn = document.getElementById("end-turn-btn")
    if (gameMode === "pvp") {
        endTurnBtn.disabled = false
    } else {
        endTurnBtn.disabled = currentTurn !== "player"
    }
}

function renderDeckBuilder(compendium, selectedIndices, onToggle, onComplete, playerName) {
    // Create or get overlay
    let overlay = document.getElementById("deck-builder-overlay")
    if (!overlay) {
        overlay = document.createElement("div")
        overlay.id = "deck-builder-overlay"
        overlay.style.position = "fixed"
        overlay.style.top = "0"
        overlay.style.left = "0"
        overlay.style.width = "100%"
        overlay.style.height = "100%"
        overlay.style.backgroundColor = "rgba(0,0,0,0.9)"
        overlay.style.zIndex = "1000"
        overlay.style.display = "flex"
        overlay.style.flexDirection = "column"
        overlay.style.alignItems = "center"
        overlay.style.justifyContent = "center"
        overlay.style.color = "white"
        document.body.appendChild(overlay)
    }

    overlay.innerHTML = ""

    const title = document.createElement("h2")
    title.innerText = `${playerName}: Select up to 4 Spells (${selectedIndices.length}/4)`
    overlay.appendChild(title)

    const grid = document.createElement("div")
    grid.style.display = "grid"
    grid.style.gridTemplateColumns = "repeat(4, 1fr)"
    grid.style.gap = "10px"
    grid.style.maxHeight = "70vh"
    grid.style.overflowY = "auto"
    grid.style.padding = "20px"
    overlay.appendChild(grid)

    compendium.forEach((spell, index) => {
        if (spell.available === 0) return

        // Determine how many times this spell is selected
        const count = selectedIndices.filter((i) => i === index).length
        // Unlimited selection allowed if available > 0
        // const max = spell.available

        const card = document.createElement("div")
        card.className = "card"
        card.style.backgroundColor = spell.color
        card.style.color = "black"
        card.style.position = "relative"
        card.style.cursor = "pointer"

        if (count > 0) {
            card.style.border = "3px solid gold"
        }

        card.innerHTML = `<strong>${spell.name}</strong>`

        if (spell.type === SpellType.ATTACK) {
            const e = spell.parameters
            const ciLevel = (e.beta_x_ci || 0.95) * 100

            card.innerHTML += `
            <table class="spell-stats">
                <thead>
                    <tr><th></th><th>Effect</th><th>${ciLevel}% CI</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>B(0)</td>
                        <td>${e.beta_zero.toFixed(1)}</td>
                        <td>[${e.beta_zero_min.toFixed(1)}, ${e.beta_zero_max.toFixed(1)}]</td>
                    </tr>
                    <tr>
                        <td>B(x)</td>
                        <td>${e.beta_x.toFixed(1)}</td>
                        <td>[${e.beta_x_min.toFixed(1)}, ${e.beta_x_max.toFixed(1)}]</td>
                    </tr>
                </tbody>
            </table>`
        } else {
            card.innerHTML += `<br><small>${spell.description}</small>`
        }

        // Counter badge
        const badge = document.createElement("div")
        badge.style.position = "absolute"
        badge.style.top = "5px"
        badge.style.right = "5px"
        badge.style.backgroundColor = "black"
        badge.style.color = "white"
        badge.style.borderRadius = "50%"
        badge.style.width = "20px"
        badge.style.height = "20px"
        badge.style.display = "flex"
        badge.style.alignItems = "center"
        badge.style.justifyContent = "center"
        badge.style.fontSize = "12px"
        badge.innerText = `${count}`
        card.appendChild(badge)

        card.onclick = () => onToggle(index)
        grid.appendChild(card)
    })

    const confirmBtn = document.createElement("button")
    confirmBtn.innerText = "Confirm Deck"
    confirmBtn.style.marginTop = "20px"
    confirmBtn.style.padding = "10px 20px"
    confirmBtn.style.fontSize = "18px"
    confirmBtn.disabled = selectedIndices.length === 0
    confirmBtn.onclick = () => {
        overlay.remove()
        onComplete()
    }
    overlay.appendChild(confirmBtn)
}
