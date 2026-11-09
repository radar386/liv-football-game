const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreHomeEl = document.getElementById('score-home');
const scoreAwayEl = document.getElementById('score-away');
const timeEl = document.getElementById('match-time');
const statusEl = document.getElementById('match-status');
const messageEl = document.getElementById('game-message');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayCopy = document.getElementById('overlay-copy');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const restartButton = document.getElementById('restart-button');

const field = { width: canvas.width, height: canvas.height };
const matchDuration = 90;
const homeFormation = [
  [52, 270], [172, 105], [155, 220], [155, 320], [172, 435],
  [305, 270], [330, 155], [330, 385], [430, 105], [430, 270], [430, 435],
];
const awayFormation = [
  [908, 270], [788, 435], [805, 320], [805, 220], [788, 105],
  [655, 270], [630, 385], [630, 155], [530, 435], [530, 270], [530, 105],
];

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  sprint: false,
  shoot: false,
  pass: false,
  tackle: false,
  switch: false,
};

const state = {
  homeScore: 0,
  awayScore: 0,
  elapsed: 0,
  phase: 'ready',
  activeIndex: 9,
  ownerTeam: 'home',
  ownerIndex: 9,
  targetTeam: '',
  targetIndex: -1,
  goalPause: 0,
  goalFlash: 0,
  messageTimer: 0,
  cpuDecisionTimer: 1.2,
  lastFrame: 0,
};

const ball = {
  x: field.width / 2,
  y: field.height / 2,
  radius: 8,
  vx: 0,
  vy: 0,
};

function createSquad(team, formation) {
  return formation.map(([x, y], index) => ({
    team,
    number: index + 1,
    x,
    y,
    baseX: x,
    baseY: y,
    radius: index === 0 ? 13 : 12,
    speed: index === 0 ? 142 : 178,
    faceX: team === 'home' ? 1 : -1,
    faceY: 0,
  }));
}

let homeSquad = createSquad('home', homeFormation);
let awaySquad = createSquad('away', awayFormation);

function squadFor(team) {
  return team === 'home' ? homeSquad : awaySquad;
}

function setMessage(text, seconds = 2) {
  messageEl.textContent = text;
  state.messageTimer = seconds;
}

function updateClock() {
  const remaining = Math.max(0, Math.ceil(matchDuration - state.elapsed));
  timeEl.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
}

function setPhase(phase) {
  state.phase = phase;
  const playing = phase === 'playing';
  pauseButton.disabled = !playing && phase !== 'paused';
  pauseButton.textContent = phase === 'paused' ? 'Resume' : 'Pause';
  statusEl.textContent = phase === 'playing'
    ? 'LIVE'
    : phase === 'paused'
      ? 'PAUSED'
      : phase === 'finished'
        ? 'FULL TIME'
        : 'READY';

  overlay.hidden = playing;
  if (phase === 'paused') {
    overlayTitle.textContent = 'Match paused';
    overlayCopy.textContent = 'Take a breather. Your match is waiting.';
    startButton.textContent = 'Resume';
  } else if (phase === 'finished') {
    overlayTitle.textContent = 'Full time';
    overlayCopy.textContent = `Final score: Lions FC ${state.homeScore} – ${state.awayScore} Rivals.`;
    startButton.textContent = 'Play again';
  } else if (phase === 'ready') {
    overlayTitle.textContent = 'Ready for kickoff?';
    overlayCopy.textContent = 'Control your selected player, create a chance, and score before full time.';
    startButton.textContent = 'Kick off';
  }
}

function clearInput() {
  for (const key of Object.keys(input)) input[key] = false;
}

function givePossession(team, index) {
  state.ownerTeam = team;
  state.ownerIndex = index;
  state.targetTeam = '';
  state.targetIndex = -1;
  ball.vx = 0;
  ball.vy = 0;
  syncBallToOwner();
}

function syncBallToOwner() {
  if (!state.ownerTeam) return;
  const owner = squadFor(state.ownerTeam)[state.ownerIndex];
  if (!owner) return;
  const facingLength = Math.hypot(owner.faceX, owner.faceY) || 1;
  ball.x = owner.x + (owner.faceX / facingLength) * (owner.radius + ball.radius + 3);
  ball.y = owner.y + (owner.faceY / facingLength) * (owner.radius + ball.radius + 3);
}

function resetTeams(kickoffTeam = 'home') {
  homeSquad = createSquad('home', homeFormation);
  awaySquad = createSquad('away', awayFormation);
  state.activeIndex = 9;
  givePossession(kickoffTeam, 9);
}

function resetMatch() {
  state.homeScore = 0;
  state.awayScore = 0;
  state.elapsed = 0;
  state.goalPause = 0;
  state.goalFlash = 0;
  state.messageTimer = 0;
  state.cpuDecisionTimer = 1.2;
  scoreHomeEl.textContent = '0';
  scoreAwayEl.textContent = '0';
  updateClock();
  resetTeams('home');
  setMessage('Control the highlighted player and play toward goal.', 0);
  clearInput();
  setPhase('ready');
}

function startMatch() {
  if (state.phase === 'finished') resetMatch();
  setPhase('playing');
  if (state.elapsed === 0 && state.homeScore === 0 && state.awayScore === 0) {
    setMessage('Kickoff! Move into space and find a pass.', 3);
  } else {
    setMessage('Play on!', 1.5);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function moveToward(player, targetX, targetY, dt, speed = player.speed) {
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return;
  const step = Math.min(distance, speed * dt);
  player.x += (dx / distance) * step;
  player.y += (dy / distance) * step;
  player.faceX = dx / distance;
  player.faceY = dy / distance;
}

function closestPlayer(team, x, y, excludeIndex = -1) {
  const squad = squadFor(team);
  let closest = -1;
  let bestDistance = Infinity;
  squad.forEach((player, index) => {
    if (index === excludeIndex) return;
    const distance = Math.hypot(player.x - x, player.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = index;
    }
  });
  return { index: closest, distance: bestDistance };
}

function switchPlayer() {
  const nearest = closestPlayer('home', ball.x, ball.y, state.activeIndex);
  if (nearest.index >= 0) state.activeIndex = nearest.index;
}

function releaseBall(dx, dy, power, targetTeam = '', targetIndex = -1) {
  const owner = squadFor(state.ownerTeam)[state.ownerIndex];
  if (owner) {
    const length = Math.hypot(dx, dy) || 1;
    ball.x = owner.x + (dx / length) * (owner.radius + ball.radius + 4);
    ball.y = owner.y + (dy / length) * (owner.radius + ball.radius + 4);
    ball.vx = (dx / length) * power;
    ball.vy = (dy / length) * power;
  }
  state.ownerTeam = '';
  state.ownerIndex = -1;
  state.targetTeam = targetTeam;
  state.targetIndex = targetIndex;
}

function passBall(team, fromIndex) {
  if (state.ownerTeam !== team || state.ownerIndex !== fromIndex) return false;
  const squad = squadFor(team);
  const carrier = squad[fromIndex];
  let targetIndex = -1;
  let targetScore = Infinity;
  squad.forEach((teammate, index) => {
    if (index === fromIndex) return;
    const dx = (teammate.x - carrier.x) * (team === 'home' ? 1 : -1);
    const dy = teammate.y - carrier.y;
    const distance = Math.hypot(dx, dy);
    const score = distance + (dx < -20 ? 220 : 0) + Math.abs(dy) * 0.12;
    if (score < targetScore) {
      targetIndex = index;
      targetScore = score;
    }
  });
  if (targetIndex < 0) return false;

  const target = squad[targetIndex];
  const dx = target.x - carrier.x;
  const dy = target.y - carrier.y;
  releaseBall(dx, dy, 330, team, targetIndex);
  if (team === 'home') state.activeIndex = targetIndex;
  setMessage(team === 'home' ? 'Pass played. Move into the space!' : 'The Rivals play a pass.', 1.5);
  return true;
}

function shootBall(team, fromIndex) {
  if (state.ownerTeam !== team || state.ownerIndex !== fromIndex) return false;
  const carrier = squadFor(team)[fromIndex];
  const goalX = team === 'home' ? field.width + 20 : -20;
  const goalY = field.height / 2 + clamp((carrier.y - field.height / 2) * 0.15, -28, 28);
  releaseBall(goalX - carrier.x, goalY - carrier.y, 560);
  setMessage(team === 'home' ? 'Shot taken!' : 'The Rivals shoot!', 1.2);
  return true;
}

function tackle() {
  if (state.ownerTeam !== 'away') {
    setMessage('Close down an opponent to tackle.', 1.2);
    return;
  }
  const tackler = homeSquad[state.activeIndex];
  const carrier = awaySquad[state.ownerIndex];
  if (Math.hypot(tackler.x - carrier.x, tackler.y - carrier.y) < 44) {
    givePossession('home', state.activeIndex);
    setMessage('Great tackle! You won the ball.', 1.7);
  } else {
    setMessage('Get closer to make the tackle.', 1.1);
  }
}

function score(team) {
  if (state.phase !== 'playing' || state.goalPause > 0) return;
  if (team === 'home') {
    state.homeScore += 1;
    scoreHomeEl.textContent = state.homeScore;
    setMessage('GOAL! Lions FC find the net.', 2.2);
    resetTeams('away');
  } else {
    state.awayScore += 1;
    scoreAwayEl.textContent = state.awayScore;
    setMessage('The Rivals score. Win it back!', 2.2);
    resetTeams('home');
  }
  state.goalPause = 1.1;
  state.goalFlash = 0.55;
}

function updateControlledPlayer(dt) {
  const player = homeSquad[state.activeIndex];
  let dx = Number(input.right) - Number(input.left);
  let dy = Number(input.down) - Number(input.up);
  const length = Math.hypot(dx, dy);

  if (length > 0) {
    dx /= length;
    dy /= length;
    player.faceX = dx;
    player.faceY = dy;
    const carrying = state.ownerTeam === 'home' && state.ownerIndex === state.activeIndex;
    const speed = player.speed * (input.sprint ? 1.3 : 1) * (carrying ? 0.84 : 1);
    player.x += dx * speed * dt;
    player.y += dy * speed * dt;
  }

  player.x = clamp(player.x, 20, field.width - 20);
  player.y = clamp(player.y, 30, field.height - 30);
  if (state.ownerTeam === 'home' && state.ownerIndex === state.activeIndex) syncBallToOwner();
}

function updateTeammates(dt) {
  const ballProgress = (ball.x - field.width / 2) / 4;
  homeSquad.forEach((player, index) => {
    if (index === state.activeIndex) return;
    let targetX = player.baseX + ballProgress;
    let targetY = player.baseY + (ball.y - field.height / 2) * 0.12;
    if (state.ownerTeam === 'home' && state.ownerIndex === index) {
      targetX += 58;
      targetY += player.baseY < field.height / 2 ? -14 : 14;
    } else if (state.ownerTeam === 'away' && index !== 0) {
      const nearest = closestPlayer('home', ball.x, ball.y);
      if (nearest.index === index) {
        targetX = ball.x + 22;
        targetY = ball.y;
      }
    }
    moveToward(player, clamp(targetX, 28, field.width - 28), clamp(targetY, 35, field.height - 35), dt);
  });
}

function updateOpponents(dt) {
  const ballProgress = (field.width / 2 - ball.x) / 4;
  awaySquad.forEach((player, index) => {
    if (state.ownerTeam === 'away' && state.ownerIndex === index) return;
    let targetX = player.baseX - ballProgress;
    let targetY = player.baseY + (ball.y - field.height / 2) * 0.12;
    const nearest = closestPlayer('away', ball.x, ball.y);
    if (state.ownerTeam === 'home' && nearest.index === index && index !== 0) {
      targetX = ball.x - 24;
      targetY = ball.y;
    }
    if (!state.ownerTeam && nearest.index === index) {
      targetX = ball.x;
      targetY = ball.y;
    }
    moveToward(player, clamp(targetX, 28, field.width - 28), clamp(targetY, 35, field.height - 35), dt);
  });

  if (state.ownerTeam === 'home') {
    const nearest = closestPlayer('away', ball.x, ball.y);
    if (nearest.distance < 25 && Math.random() < dt * 0.45) {
      givePossession('away', nearest.index);
      setMessage('The Rivals win the ball. Close them down!', 1.6);
    }
  }
}

function updateCpuCarrier(dt) {
  if (!state.ownerTeam || state.ownerIndex < 0) return;
  const owner = squadFor(state.ownerTeam)[state.ownerIndex];
  const attackingLeft = state.ownerTeam === 'away';

  if (state.ownerTeam === 'home' && state.ownerIndex !== state.activeIndex) {
    moveToward(owner, Math.min(field.width - 110, owner.x + 84), field.height / 2, dt, owner.speed * 0.7);
  } else if (attackingLeft) {
    moveToward(owner, Math.max(125, owner.x - 92), field.height / 2, dt, owner.speed * 0.8);
  } else {
    return;
  }

  syncBallToOwner();
  state.cpuDecisionTimer -= dt;
  if (state.cpuDecisionTimer > 0) return;
  state.cpuDecisionTimer = 0.8 + Math.random() * 0.7;

  if (attackingLeft) {
    const pressure = closestPlayer('home', owner.x, owner.y).distance;
    if (owner.x < 370 || pressure < 52) {
      if (owner.x < 300 || Math.random() < 0.55) shootBall('away', state.ownerIndex);
      else passBall('away', state.ownerIndex);
    }
  } else if (owner.x > 690 && Math.random() < 0.45) {
    shootBall('home', state.ownerIndex);
  } else if (Math.random() < 0.24) {
    passBall('home', state.ownerIndex);
  }
}

function updateLooseBall(dt) {
  const nextX = ball.x + ball.vx * dt;
  const nextY = ball.y + ball.vy * dt;
  const inGoal = nextY >= 218 && nextY <= 322;
  if (nextX <= ball.radius && inGoal) {
    score('away');
    return;
  }
  if (nextX >= field.width - ball.radius && inGoal) {
    score('home');
    return;
  }

  ball.x = nextX;
  ball.y = nextY;
  const friction = Math.pow(0.992, dt * 60);
  ball.vx *= friction;
  ball.vy *= friction;
  if (Math.abs(ball.vx) < 7) ball.vx = 0;
  if (Math.abs(ball.vy) < 7) ball.vy = 0;

  const top = ball.radius + 10;
  const bottom = field.height - ball.radius - 10;
  if (ball.y < top) {
    ball.y = top;
    ball.vy = Math.abs(ball.vy) * 0.7;
  } else if (ball.y > bottom) {
    ball.y = bottom;
    ball.vy = -Math.abs(ball.vy) * 0.7;
  }

  const speed = Math.hypot(ball.vx, ball.vy);
  if (state.targetTeam && state.targetIndex >= 0) {
    const receiver = squadFor(state.targetTeam)[state.targetIndex];
    if (receiver && Math.hypot(receiver.x - ball.x, receiver.y - ball.y) < 28) {
      givePossession(state.targetTeam, state.targetIndex);
      return;
    }
  }

  if (speed < 330) {
    const nearestHome = closestPlayer('home', ball.x, ball.y);
    const nearestAway = closestPlayer('away', ball.x, ball.y);
    if (Math.min(nearestHome.distance, nearestAway.distance) < 23) {
      if (nearestHome.distance <= nearestAway.distance) {
        givePossession('home', nearestHome.index);
        state.activeIndex = nearestHome.index;
      } else {
        givePossession('away', nearestAway.index);
      }
    }
  }
}

function processActions() {
  if (input.switch) switchPlayer();
  if (input.pass) passBall('home', state.activeIndex);
  if (input.shoot) shootBall('home', state.activeIndex);
  if (input.tackle) tackle();
  input.switch = false;
  input.pass = false;
  input.shoot = false;
  input.tackle = false;
}

function update(dt) {
  if (state.phase !== 'playing') return;
  state.elapsed = Math.min(matchDuration, state.elapsed + dt);
  updateClock();
  if (state.elapsed >= matchDuration) {
    setPhase('finished');
    setMessage('Full time. Start a new match to play again.', 0);
    clearInput();
    return;
  }

  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) setMessage('Move into space to control your player.', 0);
  }
  if (state.goalFlash > 0) state.goalFlash = Math.max(0, state.goalFlash - dt);
  if (state.goalPause > 0) {
    state.goalPause = Math.max(0, state.goalPause - dt);
    return;
  }

  processActions();
  updateControlledPlayer(dt);
  updateTeammates(dt);
  updateOpponents(dt);
  updateCpuCarrier(dt);
  if (!state.ownerTeam) updateLooseBall(dt);
  if (state.ownerTeam) syncBallToOwner();
}

function drawField() {
  ctx.clearRect(0, 0, field.width, field.height);
  ctx.fillStyle = '#187841';
  ctx.fillRect(0, 0, field.width, field.height);
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(6,70,32,0.12)' : 'rgba(94,191,110,0.08)';
    ctx.fillRect(i * field.width / 8, 0, field.width / 8, field.height);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, field.width - 36, field.height - 36);
  ctx.beginPath();
  ctx.moveTo(field.width / 2, 18);
  ctx.lineTo(field.width / 2, field.height - 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(field.width / 2, field.height / 2, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(field.width / 2, field.height / 2, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.strokeRect(18, 130, 145, 280);
  ctx.strokeRect(field.width - 163, 130, 145, 280);
  ctx.strokeRect(18, 210, 55, 120);
  ctx.strokeRect(field.width - 73, 210, 55, 120);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(0, 218, 8, 104);
  ctx.fillRect(field.width - 8, 218, 8, 104);
}

function drawPlayer(player, active) {
  ctx.beginPath();
  ctx.arc(player.x, player.y, active ? player.radius + 5 : player.radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = active ? 'rgba(200,241,105,0.2)' : 'rgba(0,0,0,0.18)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = player.team === 'home' ? '#eaf5e0' : '#f6e5e3';
  ctx.fill();
  ctx.lineWidth = active ? 3 : 2;
  ctx.strokeStyle = player.team === 'home' ? '#a4d95f' : '#ef7065';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius * 0.53, 0, Math.PI * 2);
  ctx.fillStyle = player.team === 'home' ? '#87ba43' : '#d94f48';
  ctx.fill();
  if (active) {
    ctx.fillStyle = '#18220e';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(player.number), player.x, player.y);
  }
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#f7f8f2';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ball.x - 2, ball.y - 2, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = '#243328';
  ctx.fill();
}

function render() {
  drawField();
  homeSquad.forEach((player, index) => drawPlayer(player, index === state.activeIndex));
  awaySquad.forEach((player) => drawPlayer(player, false));
  drawBall();
  if (state.goalFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.goalFlash * 0.2})`;
    ctx.fillRect(0, 0, field.width, field.height);
  }
}

function gameLoop() {
  const now = performance.now();
  const dt = state.lastFrame ? Math.min((now - state.lastFrame) / 1000, 0.05) : 0;
  state.lastFrame = now;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function bindHoldButton(button, key) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    input[key] = true;
    button.setPointerCapture(event.pointerId);
  });
  const release = (event) => {
    event.preventDefault();
    input[key] = false;
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', () => {
    input[key] = false;
  });
}

function bindActionButton(button, action) {
  button.addEventListener('click', () => {
    if (state.phase === 'playing') input[action] = true;
  });
}

document.querySelectorAll('[data-control]').forEach((button) => {
  bindHoldButton(button, button.dataset.control);
});
bindActionButton(document.getElementById('tackle-button'), 'tackle');
bindActionButton(document.getElementById('shoot-button'), 'shoot');
bindActionButton(document.getElementById('pass-button'), 'pass');
bindActionButton(document.getElementById('switch-button'), 'switch');

window.addEventListener('keydown', (event) => {
  if (state.phase !== 'playing') return;
  const key = event.key.toLowerCase();
  if (key.startsWith('arrow') || event.code === 'Space') event.preventDefault();
  if (key === 'arrowup' || key === 'w') input.up = true;
  if (key === 'arrowdown' || key === 's') input.down = true;
  if (key === 'arrowleft' || key === 'a') input.left = true;
  if (key === 'arrowright' || key === 'd') input.right = true;
  if (key === 'shift') input.sprint = true;
  if (event.code === 'Space' && !event.repeat) input.shoot = true;
  if (key === 'e' && !event.repeat) input.pass = true;
  if ((key === 'q' || key === 'tab') && !event.repeat) {
    input.switch = true;
    if (key === 'tab') event.preventDefault();
  }
  if (key === 'f' && !event.repeat) input.tackle = true;
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'arrowup' || key === 'w') input.up = false;
  if (key === 'arrowdown' || key === 's') input.down = false;
  if (key === 'arrowleft' || key === 'a') input.left = false;
  if (key === 'arrowright' || key === 'd') input.right = false;
  if (key === 'shift') input.sprint = false;
});

window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.phase === 'playing') {
    clearInput();
    setPhase('paused');
  }
});

startButton.addEventListener('click', startMatch);
pauseButton.addEventListener('click', () => {
  if (state.phase === 'playing') {
    clearInput();
    setPhase('paused');
  } else if (state.phase === 'paused') {
    startMatch();
  }
});
restartButton.addEventListener('click', resetMatch);

resetMatch();
requestAnimationFrame(gameLoop);
