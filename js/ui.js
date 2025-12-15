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

        card.innerHTML += `<strong>${spell.name}</strong> <span style="position:absolute; top:5px; left:5px; color:purple; font-weight:bold; font-size: 12px;">${spell.parameters.cost}</span>`

        if (spell.type === SpellType.ATTACK && spell.parameters.beta_x !== undefined) {
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
        updateUI()
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
    const playerActionsContainer = document.getElementById("player-actions")
    const enemyActionsContainer = document.getElementById("enemy-actions")

    playerActionsContainer.innerHTML = ""
    enemyActionsContainer.innerHTML = ""

    const currentCost = selectedCards.reduce((sum, idx) => sum + deck[idx].parameters.cost, 0)
    const displayActions = actionsRemaining - currentCost

    const targetContainer = currentTurn === "player" ? playerActionsContainer : enemyActionsContainer

    for (let i = 0; i < displayActions; i++) {
        const circle = document.createElement("span")
        circle.style.display = "inline-block"
        circle.style.width = "15px"
        circle.style.height = "15px"
        circle.style.backgroundColor = "purple"
        circle.style.borderRadius = "50%"
        circle.style.marginRight = "5px"
        targetContainer.appendChild(circle)
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

function renderDeckBuilder(compendium, selectedIndices, onToggle, onComplete, playerName, character) {
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
    const offensiveCount = selectedIndices.filter((i) => compendium[i].type === SpellType.ATTACK).length
    const defensiveCount = selectedIndices.filter((i) => compendium[i].type !== SpellType.ATTACK).length
    title.innerText = `${playerName} (${character ? character.name : "God"}): Select Spells`
    overlay.appendChild(title)

    const container = document.createElement("div")
    container.style.display = "flex"
    container.style.width = "90%"
    container.style.height = "70vh"
    container.style.gap = "20px"
    overlay.appendChild(container)

    // Offensive Column
    const offensiveCol = document.createElement("div")
    offensiveCol.style.flex = "1"
    offensiveCol.style.border = "1px solid #444"
    offensiveCol.style.padding = "10px"
    offensiveCol.style.overflowY = "auto"
    const maxOffensive = character ? character.n_spells_offensive : 3
    offensiveCol.innerHTML = `<h3>Offensive Spells (${offensiveCount}/${maxOffensive})</h3>`
    const offensiveGrid = document.createElement("div")
    offensiveGrid.style.display = "flex"
    offensiveGrid.style.flexWrap = "wrap"
    offensiveGrid.style.gap = "10px"
    offensiveGrid.style.justifyContent = "center"
    offensiveCol.appendChild(offensiveGrid)
    container.appendChild(offensiveCol)

    // Defensive Column
    const defensiveCol = document.createElement("div")
    defensiveCol.style.flex = "1"
    defensiveCol.style.border = "1px solid #444"
    defensiveCol.style.padding = "10px"
    defensiveCol.style.overflowY = "auto"
    const maxDefensive = character ? character.n_spells_defensive : 3
    defensiveCol.innerHTML = `<h3>Defensive Spells (${defensiveCount}/${maxDefensive})</h3>`
    const defensiveGrid = document.createElement("div")
    defensiveGrid.style.display = "flex"
    defensiveGrid.style.flexWrap = "wrap"
    defensiveGrid.style.gap = "10px"
    defensiveGrid.style.justifyContent = "center"
    defensiveCol.appendChild(defensiveGrid)
    container.appendChild(defensiveCol)

    compendium.forEach((spell, index) => {
        // Filter by character
        if (character && !character.spells.includes(spell.id)) return

        // Determine how many times this spell is selected
        const count = selectedIndices.filter((i) => i === index).length

        const card = document.createElement("div")
        card.className = "card"
        card.style.backgroundColor = spell.color
        card.style.color = "black"
        card.style.position = "relative"
        card.style.cursor = "pointer"
        // card.style.width = "100%" // Removed to allow natural size from CSS

        if (count > 0) {
            card.style.border = "3px solid gold"
        }

        card.innerHTML = `<strong>${spell.name}</strong>`

        if (spell.type === SpellType.ATTACK && spell.parameters.beta_x !== undefined) {
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
        if (count > 0) {
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
        }

        card.onclick = () => onToggle(index, "add")
        card.oncontextmenu = (e) => {
            e.preventDefault()
            onToggle(index, "remove")
        }
        if (spell.type === SpellType.ATTACK) {
            offensiveGrid.appendChild(card)
        } else {
            defensiveGrid.appendChild(card)
        }
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

function renderCharacterSelection(onSelect, playerNum) {
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
    title.innerText = `Player ${playerNum}: Select Character`
    overlay.appendChild(title)

    const container = document.createElement("div")
    container.style.display = "flex"
    container.style.gap = "20px"
    overlay.appendChild(container)

    Object.keys(Characters).forEach((key) => {
        const char = Characters[key]
        const card = document.createElement("div")
        card.className = "card"
        card.style.width = "200px"
        card.style.height = "300px"
        card.style.cursor = "pointer"

        card.innerHTML = `
            <h3>${char.name}</h3>
            <img src="${char.sprite}" style="width:100px; height:100px; object-fit:contain;">
            <p>Spells: ${char.spells.length}</p>
        `
        card.onclick = () => {
            overlay.remove()
            onSelect(char)
        }
        container.appendChild(card)
    })
}

function showToast(message) {
    let toast = document.getElementById("toast-message")
    if (!toast) {
        toast = document.createElement("div")
        toast.id = "toast-message"
        toast.style.position = "fixed"
        toast.style.top = "20%"
        toast.style.left = "50%"
        toast.style.transform = "translate(-50%, -50%)"
        toast.style.backgroundColor = "rgba(255, 0, 0, 0.8)"
        toast.style.color = "white"
        toast.style.padding = "15px 30px"
        toast.style.borderRadius = "5px"
        toast.style.fontSize = "20px"
        toast.style.zIndex = "2000"
        toast.style.pointerEvents = "none"
        document.body.appendChild(toast)
    }
    toast.innerText = message
    toast.style.display = "block"
    setTimeout(() => {
        toast.style.display = "none"
    }, 1500)
}
