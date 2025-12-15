// Load Images
const playerImg = new Image()
// playerImg.src = "img/wizard1_blue.png" // Set dynamically
const enemyImg = new Image()
// enemyImg.src = "img/wizard1_red.png" // Set dynamically
const cloudImg = new Image()
cloudImg.src = "img/darkcloud.png"

const imageCache = {}
function getImage(src) {
    if (!imageCache[src]) {
        const img = new Image()
        img.src = src
        imageCache[src] = img
    }
    return imageCache[src]
}

function setEntitySprites(p1Src, p2Src) {
    playerImg.src = p1Src
    enemyImg.src = p2Src
}

let lastShot = null
let particles = []

function visualizeShot(slope, intercept, caster, duration, parameters, modifiers) {
    lastShot = { slope, intercept, caster, time: Date.now(), duration, parameters, modifiers }
}

function createImpactParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 1.0,
            color: color,
        })
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.life -= 0.02
        if (p.life <= 0) {
            particles.splice(i, 1)
        }
    }
}

function drawParticles() {
    particles.forEach((p) => {
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fill()
    })
    ctx.globalAlpha = 1.0
}

function draw() {
    // Clear background
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Determine Reference Y (Current Player's Y)
    const currentWizard = currentTurn === "player" ? player : enemy

    const referenceGridY = currentWizard.y
    const referenceScreenY = ORIGIN_Y - referenceGridY * PIXELS_PER_Y_UNIT

    // Draw Axes
    ctx.strokeStyle = "white"
    ctx.lineWidth = 2

    // Left Y Axis (Player 1)
    ctx.beginPath()
    ctx.moveTo(ORIGIN_X, 0)
    ctx.lineTo(ORIGIN_X, canvas.height)
    ctx.stroke()

    // Right Y Axis (Player 2)
    const rightAxisX = ORIGIN_X + AXIS_LENGTH
    ctx.beginPath()
    ctx.moveTo(rightAxisX, 0)
    ctx.lineTo(rightAxisX, canvas.height)
    ctx.stroke()

    // X Axis (Dynamic - at Reference Y)
    ctx.beginPath()
    ctx.moveTo(ORIGIN_X, referenceScreenY)
    ctx.lineTo(rightAxisX, referenceScreenY)
    ctx.stroke()

    // Grid Lines (Vertical every 0.5)
    ctx.strokeStyle = "#333"
    ctx.lineWidth = 1
    for (let x = 0; x <= 1; x += 0.5) {
        const screenX = ORIGIN_X + x * AXIS_LENGTH
        ctx.beginPath()
        ctx.moveTo(screenX, 0)
        ctx.lineTo(screenX, canvas.height)
        ctx.stroke()

        // Optional: Add small label for 0.5
        if (x === 0.5) {
            ctx.fillStyle = "#555"
            ctx.font = "12px Arial"
            ctx.fillText("0.5", screenX, canvas.height - 5)
        }
    }

    // Ticks
    ctx.font = "20px Arial" // Bigger font as per screenshot style
    ctx.fillStyle = "#00ff00" // Green color as per screenshot
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // X Ticks (0 and 1) - Drawn at Bottom Edge (Outside)
    const bottomY = canvas.height - 20
    // 0
    ctx.fillText("0", ORIGIN_X, bottomY)
    // 1
    ctx.fillText("1", rightAxisX, bottomY)

    // Y Ticks (-1 to 1) - Drawn at Left Edge (Outside)
    // Labels relative to reference Y
    for (let i = -1; i <= 1; i++) {
        const y = ORIGIN_Y - i * PIXELS_PER_Y_UNIT

        // Left Axis Ticks
        ctx.strokeStyle = "white"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(ORIGIN_X - 10, y)
        ctx.lineTo(ORIGIN_X, y)
        ctx.stroke()

        // Right Axis Ticks
        ctx.beginPath()
        ctx.moveTo(rightAxisX, y)
        ctx.lineTo(rightAxisX + 10, y)
        ctx.stroke()

        // Labels - Only show for active player
        if (currentTurn === "player") {
            // Left Axis Labels
            const labelValueLeft = i - referenceGridY
            ctx.textAlign = "right"
            // Moved further left to avoid overlap (ORIGIN_X - 40)
            ctx.fillText(labelValueLeft.toFixed(0), ORIGIN_X - 40, y)
        } else {
            // Right Axis Labels
            const labelValueRight = i - enemy.y // Relative to Enemy
            ctx.textAlign = "left"
            ctx.fillText(labelValueRight.toFixed(0), rightAxisX + 20, y)
        }

        // Grid line (Horizontal)
        ctx.strokeStyle = "#333"
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(ORIGIN_X, y)
        ctx.lineTo(rightAxisX, y)
        ctx.stroke()
    }

    // Draw Player (Left)
    // Player at x=0, y=player.y
    const playerScreenX = ORIGIN_X
    const playerScreenY = ORIGIN_Y - player.y * PIXELS_PER_Y_UNIT

    ctx.save()
    ctx.translate(playerScreenX, playerScreenY)
    ctx.scale(-1, 1) // Mirror horizontally
    // Draw centered
    ctx.drawImage(playerImg, -player.width / 2, -player.height / 2, player.width, player.height)
    ctx.restore()

    // Draw Enemy (Right, at x=1, y=enemy.y)
    const enemyScreenX = ORIGIN_X + 1 * AXIS_LENGTH
    const enemyScreenY = ORIGIN_Y - enemy.y * PIXELS_PER_Y_UNIT

    ctx.drawImage(enemyImg, enemyScreenX - enemy.width / 2, enemyScreenY - enemy.height / 2, enemy.width, enemy.height)

    // Draw Last Shot
    if (lastShot && Date.now() - lastShot.time < lastShot.duration + 500) {
        // Draw CI Shaded Area (if offensive spell)
        if (lastShot.parameters && lastShot.parameters.beta_x_min !== undefined) {
            const p = lastShot.parameters
            const m = lastShot.modifiers || { beta_x: 0, beta_zero: 0 }
            const casterY = lastShot.caster.y

            // Calculate Bounds
            const minSlope = p.beta_x_min + m.beta_x
            const maxSlope = p.beta_x_max + m.beta_x
            const minIntercept = p.beta_zero_min + m.beta_zero + casterY
            const maxIntercept = p.beta_zero_max + m.beta_zero + casterY

            ctx.fillStyle = "rgba(255, 255, 255, 0.1)" // Faint white/gray
            ctx.beginPath()

            if (lastShot.caster === player) {
                // Player: x=0 to x=1
                // x=0
                const y0_min = minIntercept
                const y0_max = maxIntercept
                // x=1
                const y1_min = minSlope * 1 + minIntercept
                const y1_max = maxSlope * 1 + maxIntercept

                // Convert to Screen Coords
                const sy0_min = ORIGIN_Y - y0_min * PIXELS_PER_Y_UNIT
                const sy0_max = ORIGIN_Y - y0_max * PIXELS_PER_Y_UNIT
                const sy1_min = ORIGIN_Y - y1_min * PIXELS_PER_Y_UNIT
                const sy1_max = ORIGIN_Y - y1_max * PIXELS_PER_Y_UNIT

                const sx0 = ORIGIN_X
                const sx1 = ORIGIN_X + AXIS_LENGTH

                ctx.moveTo(sx0, sy0_min)
                ctx.lineTo(sx1, sy1_min)
                ctx.lineTo(sx1, sy1_max)
                ctx.lineTo(sx0, sy0_max)
            } else {
                // Enemy: x=1 to x=0
                // At x=1 (Origin for enemy shot)
                const y1_min = minIntercept
                const y1_max = maxIntercept
                // At x=0 (Target)
                // hitY = -slope * (0 - 1) + intercept = slope + intercept
                const y0_min = minSlope + minIntercept
                const y0_max = maxSlope + maxIntercept

                // Convert to Screen Coords
                const sy1_min = ORIGIN_Y - y1_min * PIXELS_PER_Y_UNIT
                const sy1_max = ORIGIN_Y - y1_max * PIXELS_PER_Y_UNIT
                const sy0_min = ORIGIN_Y - y0_min * PIXELS_PER_Y_UNIT
                const sy0_max = ORIGIN_Y - y0_max * PIXELS_PER_Y_UNIT

                const sx0 = ORIGIN_X
                const sx1 = ORIGIN_X + AXIS_LENGTH

                ctx.moveTo(sx1, sy1_min)
                ctx.lineTo(sx0, sy0_min)
                ctx.lineTo(sx0, sy0_max)
                ctx.lineTo(sx1, sy1_max)
            }
            ctx.closePath()
            ctx.fill()
        }

        // Animation Progress
        const duration = lastShot.duration || 1000
        const elapsed = Date.now() - lastShot.time
        const progress = Math.min(elapsed / duration, 1)

        let startX, startY, endX, endY

        if (lastShot.caster && lastShot.caster === enemy) {
            // Enemy shoots from Right (x=1) to Left (x=0)
            startX = 1
            startY = -lastShot.slope * (startX - 1) + lastShot.intercept

            // Target X moves from 1 down to 0 based on progress
            const currentTargetX = 1 - 1 * progress

            endX = currentTargetX
            endY = -lastShot.slope * (endX - 1) + lastShot.intercept
        } else {
            // Player shoots from Left (x=0) to Right (x=1)
            startX = 0
            startY = lastShot.slope * startX + lastShot.intercept

            // Target X moves from 0 up to 1 based on progress
            const currentTargetX = 0 + 1 * progress

            endX = currentTargetX
            endY = lastShot.slope * endX + lastShot.intercept
        }

        const screenStartX = ORIGIN_X + startX * AXIS_LENGTH
        const screenStartY = ORIGIN_Y - startY * PIXELS_PER_Y_UNIT

        const screenEndX = ORIGIN_X + endX * AXIS_LENGTH
        const screenEndY = ORIGIN_Y - endY * PIXELS_PER_Y_UNIT

        if (lastShot.parameters && lastShot.parameters.visual_type === "projectile") {
            if (lastShot.parameters.animation_projectile) {
                const img = getImage(lastShot.parameters.animation_projectile)
                // Draw centered, 64x64 size for projectile
                ctx.drawImage(img, screenEndX - 32, screenEndY - 32, 64, 64)
            } else {
                // Draw Projectile (Circle)
                ctx.fillStyle = lastShot.parameters.visual_color || "orange"
                ctx.beginPath()
                ctx.arc(screenEndX, screenEndY, 10, 0, Math.PI * 2)
                ctx.fill()
            }
        } else {
            // Draw Ray (Line)
            ctx.strokeStyle = (lastShot.parameters && lastShot.parameters.visual_color) || "lightblue"
            ctx.lineWidth = 10 // Thicker beam
            ctx.lineCap = "round" // Smoother ends
            ctx.beginPath()
            ctx.moveTo(screenStartX, screenStartY)
            ctx.lineTo(screenEndX, screenEndY)
            ctx.stroke()
        }

        // Pre-spell Animation (Cloud or Portal) - Drawn AFTER ray to be "above"
        const prespellImgSrc =
            (lastShot.modifiers && lastShot.modifiers.animation_prespell) || (lastShot.parameters && lastShot.parameters.animation_prespell)

        if (prespellImgSrc) {
            const img = getImage(prespellImgSrc)
            // Draw at origin of spell
            // Origin is screenStartX, screenStartY
            // 120x120
            ctx.drawImage(img, screenStartX - 60, screenStartY - 60, 120, 120)
        }
    }

    updateParticles()
    drawParticles()
}
