const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const keys = {};

document.addEventListener("keydown", function (e) {
  if (e.keyCode === 32 && !keys[32]) {
    // Spacja
    keys[32] = true;
    if (!gameOver) {
      hero.attackCharging = true;
      hero.chargeTime = 0;
    }
  } else if (e.keyCode === 13 && gameOver) {
    // Enter
    restartGame();
  } else {
    keys[e.keyCode] = true;
  }
});

document.addEventListener("keyup", function (e) {
  if (e.keyCode === 32) {
    keys[32] = false;
    if (hero.attackCharging) {
      heroAttack();
      hero.attackCharging = false;
    }
  } else {
    delete keys[e.keyCode];
  }
});

const hero = {
  x: 0,
  y: 0,
  size: 20,
  speed: 3,
  hp: 30,
  maxHp: 30,
  gold: 0,
  inCombat: false,
  attackCooldown: 0,
  regenCooldown: 0,
  attackCharging: false,
  chargeTime: 0,
  rotationAngle: 0,
  attackAnimationTime: 0,
  attackAnimationDuration: 20,
};

let gameOver = false;

class Monster {
  constructor(type = "medium") {
    this.type = type;

    if (type === "small") {
      this.size = 15;
      this.hp = Math.floor(Math.random() * 6) + 3; // 3-8
      this.damage = 1;
      this.speed = 2;
    } else if (type === "large") {
      this.size = 30;
      this.hp = Math.floor(Math.random() * 11) + 20; // 20-30
      this.damage = 5;
      this.speed = 0.5;
    } else {
      // Średni
      this.size = 20;
      this.hp = Math.floor(Math.random() * 11) + 10; // 10-20
      this.damage = 3;
      this.speed = 1;
    }

    this.maxHp = this.hp;
    this.sleeping = true;
    this.aggroRange = 100;
    this.attackCooldown = 0;
    this.damageCooldown = 0;
    this.attackAnimationTime = 0;
    this.attackAnimationDuration = 20;

    do {
      this.x = Math.random() * (canvas.width - this.size) + this.size / 2;
      this.y = Math.random() * (canvas.height - this.size) + this.size / 2;
    } while (isInsideObstacle(this.x, this.y, this.size));

    this.targetX = this.x + (Math.random() - 0.5) * 100;
    this.targetY = this.y + (Math.random() - 0.5) * 100;
  }

  update() {
    const dx = hero.x - this.x;
    const dy = hero.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance < this.aggroRange) {
      this.sleeping = false;
    }

    if (this.sleeping) {
      // Poruszanie w małym obszarze
      if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 5) {
        this.targetX = this.x + (Math.random() - 0.5) * 100;
        this.targetY = this.y + (Math.random() - 0.5) * 100;
      } else {
        const angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
        const moveX = Math.cos(angle) * this.speed * 0.5;
        const moveY = Math.sin(angle) * this.speed * 0.5;

        if (!checkCollision(this, moveX, 0)) {
          this.targetX = this.x + (Math.random() - 0.5) * 100;
        } else {
          this.x += moveX;
        }

        if (!checkCollision(this, 0, moveY)) {
          this.targetY = this.y + (Math.random() - 0.5) * 100;
        } else {
          this.y += moveY;
        }
      }
    } else {
      // Atakowanie bohatera
      const angle = Math.atan2(dy, dx);
      const moveX = Math.cos(angle) * this.speed * 2;
      const moveY = Math.sin(angle) * this.speed * 2;

      if (distance > this.size / 2 + hero.size / 2 + 5) {
        if (!checkCollision(this, moveX, 0)) {
          this.sleeping = true;
        } else {
          this.x += moveX;
        }

        if (!checkCollision(this, 0, moveY)) {
          this.sleeping = true;
        } else {
          this.y += moveY;
        }
      }

      if (distance < this.size / 2 + hero.size / 2 + 5) {
        if (this.damageCooldown <= 0) {
          hero.hp -= this.damage;
          this.damageCooldown = 120; // 2 sekundy przy 60 FPS
          hero.inCombat = true;
          this.attackAnimationTime = this.attackAnimationDuration;
        }
      }
    }

    if (this.damageCooldown > 0) {
      this.damageCooldown--;
    }

    if (this.attackAnimationTime > 0) {
      this.attackAnimationTime--;
    }
  }

  draw() {
    ctx.fillStyle = "brown";
    ctx.fillRect(
      this.x - this.size / 2,
      this.y - this.size / 2,
      this.size,
      this.size
    );

    // Animacja ataku potwora
    if (this.attackAnimationTime > 0) {
      const animationProgress =
        this.attackAnimationTime / this.attackAnimationDuration;
      ctx.beginPath();
      ctx.arc(
        this.x,
        this.y,
        this.size + 5 * (1 - animationProgress),
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = `rgba(255, 0, 0, ${animationProgress})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Pasek życia
    ctx.fillStyle = "red";
    ctx.fillRect(this.x - this.size / 2, this.y - this.size, this.size, 5);
    ctx.fillStyle = "green";
    ctx.fillRect(
      this.x - this.size / 2,
      this.y - this.size,
      this.size * (this.hp / this.maxHp),
      5
    );
  }
}

class Obstacle {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  draw() {
    ctx.fillStyle = "grey";
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

const monsters = [];
const obstacles = [];

function generateObstacles() {
  obstacles.length = 0;
  for (let i = 0; i < 10; i++) {
    const width = Math.random() * 50 + 30;
    const height = Math.random() * 50 + 30;
    const x = Math.random() * (canvas.width - width);
    const y = Math.random() * (canvas.height - height);
    obstacles.push(new Obstacle(x, y, width, height));
  }
}

function isInsideObstacle(x, y, size) {
  const entityBox = {
    x: x - size / 2,
    y: y - size / 2,
    width: size,
    height: size,
  };
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (rectIntersect(entityBox, obs)) {
      return true;
    }
  }
  return false;
}

function spawnMonster() {
  const monsterTypes = ["small", "medium", "large"];
  const randomType =
    monsterTypes[Math.floor(Math.random() * monsterTypes.length)];
  const monster = new Monster(randomType);
  monsters.push(monster);
}

function scheduleNextMonsterSpawn() {
  const spawnDelay = Math.random() * 3000 + 2000; // 2000ms do 5000ms
  setTimeout(() => {
    spawnMonster();
    scheduleNextMonsterSpawn();
  }, spawnDelay);
}

function heroAttack() {
  if (hero.attackCooldown <= 0) {
    const chargeRatio = hero.chargeTime / 120;
    const damage = Math.round(chargeRatio * 9 + 1); // Od 1 do 10
    const radius = chargeRatio * 70 + 30; // Od 30 do 100 pikseli

    // Rozpoczęcie animacji ataku
    hero.attackAnimationTime = hero.attackAnimationDuration;
    hero.chargeRatio = chargeRatio; // Zapamiętanie chargeRatio dla animacji

    // Sprawdzenie trafienia potworów
    monsters.forEach((monster, index) => {
      const dx = hero.x - monster.x;
      const dy = hero.y - monster.y;
      const distance = Math.hypot(dx, dy);
      if (distance < radius) {
        monster.hp -= damage;
        if (monster.hp <= 0) {
          monsters.splice(index, 1);
          hero.gold += 10;
          hero.inCombat = false;
        }
      }
    });

    hero.attackCooldown = 30; // 0.5 sekundy przy 60 FPS
    hero.chargeTime = 0;
  }
}

function checkCollision(entity, dx, dy) {
  const newX = entity.x + dx;
  const newY = entity.y + dy;

  const entityBox = {
    x: newX - entity.size / 2,
    y: newY - entity.size / 2,
    width: entity.size,
    height: entity.size,
  };

  // Sprawdzanie kolizji z granicami ekranu
  if (
    entityBox.x < 0 ||
    entityBox.x + entityBox.width > canvas.width ||
    entityBox.y < 0 ||
    entityBox.y + entityBox.height > canvas.height
  ) {
    return false; // Kolizja z granicą ekranu
  }

  // Sprawdzanie kolizji z przeszkodami
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (rectIntersect(entityBox, obs)) {
      return false; // Kolizja wykryta
    }
  }

  // Sprawdzanie kolizji z bohaterem (dla potworów)
  if (
    entity !== hero &&
    rectIntersect(entityBox, {
      x: hero.x - hero.size / 2,
      y: hero.y - hero.size / 2,
      width: hero.size,
      height: hero.size,
    })
  ) {
    return false;
  }

  // Sprawdzanie kolizji z potworami (dla bohatera i potworów)
  for (let i = 0; i < monsters.length; i++) {
    const monster = monsters[i];
    if (
      monster !== entity &&
      rectIntersect(entityBox, {
        x: monster.x - monster.size / 2,
        y: monster.y - monster.size / 2,
        width: monster.size,
        height: monster.size,
      })
    ) {
      return false;
    }
  }

  return true; // Brak kolizji
}

function rectIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function update() {
  if (gameOver) return;

  let moveX = 0;
  let moveY = 0;

  if (keys[37]) moveX -= hero.speed; // Lewo
  if (keys[38]) moveY -= hero.speed; // Góra
  if (keys[39]) moveX += hero.speed; // Prawo
  if (keys[40]) moveY += hero.speed; // Dół

  // Sprawdzanie kolizji
  if (checkCollision(hero, moveX, 0)) {
    hero.x += moveX;
  }
  if (checkCollision(hero, 0, moveY)) {
    hero.y += moveY;
  }

  // Aktualizacja potworów
  monsters.forEach((monster) => monster.update());

  // Ładowanie ataku bohatera
  if (hero.attackCharging) {
    hero.chargeTime++;
    if (hero.chargeTime > 120) {
      hero.chargeTime = 120; // Maksymalne naładowanie
    }
  }

  // Animacja ataku bohatera
  if (hero.attackAnimationTime > 0) {
    hero.attackAnimationTime--;
    // Aktualizacja kąta obrotu
    hero.rotationAngle += hero.chargeRatio * 20; // Dostosuj mnożnik dla prędkości obrotu
    if (hero.attackAnimationTime === 0) {
      hero.rotationAngle = 0; // Reset obrotu
    }
  }

  // Cooldown ataku bohatera
  if (hero.attackCooldown > 0) {
    hero.attackCooldown--;
  }

  // Regeneracja życia bohatera
  if (!hero.inCombat) {
    if (hero.regenCooldown <= 0 && hero.hp < hero.maxHp) {
      hero.hp += 1;
      hero.regenCooldown = 60; // 1 sekunda przy 60 FPS
    } else {
      hero.regenCooldown--;
    }
  }

  // Sprawdzenie, czy bohater żyje
  if (hero.hp <= 0) {
    hero.hp = 0;
    gameOver = true;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Rysowanie przeszkód
  obstacles.forEach((obstacle) => obstacle.draw());

  // Rysowanie bohatera
  ctx.save();
  ctx.translate(hero.x, hero.y);
  ctx.rotate((hero.rotationAngle * Math.PI) / 180); // Konwersja stopni na radiany
  ctx.fillStyle = "black";
  ctx.fillRect(-hero.size / 2, -hero.size / 2, hero.size, hero.size);
  ctx.restore();

  // Rysowanie ładowania ataku
  if (hero.attackCharging) {
    const chargeRatio = hero.chargeTime / 120;
    const radius = chargeRatio * 70 + 30;
    ctx.beginPath();
    ctx.arc(hero.x, hero.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,0,0,${0.5 + 0.5 * Math.sin(Date.now() / 100)})`;
    ctx.lineWidth = 2 + 2 * chargeRatio;
    ctx.stroke();
  }

  // Animacja ataku bohatera
  if (hero.attackAnimationTime > 0) {
    const animationProgress =
      hero.attackAnimationTime / hero.attackAnimationDuration;
    const radius = hero.chargeRatio * 70 + 30;
    ctx.beginPath();
    ctx.arc(hero.x, hero.y, radius * (1 - animationProgress), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,0,255,${animationProgress})`;
    ctx.lineWidth = 10 * animationProgress;
    ctx.stroke();
  }

  // Pasek życia bohatera
  ctx.fillStyle = "red";
  ctx.fillRect(10, canvas.height - 20, 200, 10);
  ctx.fillStyle = "green";
  ctx.fillRect(10, canvas.height - 20, 200 * (hero.hp / hero.maxHp), 10);

  // Licznik złota
  ctx.fillStyle = "black";
  ctx.font = "16px Arial";
  ctx.fillText("Złoto: " + hero.gold, 10, canvas.height - 30);

  // Rysowanie potworów
  monsters.forEach((monster) => monster.draw());

  // Wyświetlenie komunikatu o końcu gry
  if (gameOver) {
    ctx.fillStyle = "black";
    ctx.font = "48px Arial";
    ctx.fillText("Koniec gry", canvas.width / 2 - 100, canvas.height / 2);
    ctx.font = "24px Arial";
    ctx.fillText(
      "Naciśnij Enter, aby zagrać ponownie",
      canvas.width / 2 - 150,
      canvas.height / 2 + 40
    );
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

function restartGame() {
  // Resetowanie stanu gry
  do {
    hero.x = Math.random() * (canvas.width - hero.size) + hero.size / 2;
    hero.y = Math.random() * (canvas.height - hero.size) + hero.size / 2;
  } while (isInsideObstacle(hero.x, hero.y, hero.size));

  hero.hp = hero.maxHp;
  hero.gold = 0;
  hero.inCombat = false;
  hero.attackCharging = false;
  hero.chargeTime = 0;
  hero.rotationAngle = 0;
  hero.attackAnimationTime = 0;
  hero.attackCooldown = 0;
  hero.regenCooldown = 0;
  gameOver = false;

  monsters.length = 0;
  generateObstacles();

  // Początkowe spawn'owanie potworów
  for (let i = 0; i < 5; i++) {
    spawnMonster();
  }
}

// Inicjalizacja gry
generateObstacles();

// Ustawienie początkowej pozycji bohatera
do {
  hero.x = Math.random() * (canvas.width - hero.size) + hero.size / 2;
  hero.y = Math.random() * (canvas.height - hero.size) + hero.size / 2;
} while (isInsideObstacle(hero.x, hero.y, hero.size));

// Początkowe spawn'owanie potworów
for (let i = 0; i < 5; i++) {
  spawnMonster();
}

// Rozpoczęcie losowego spawn'owania potworów
scheduleNextMonsterSpawn();

gameLoop();
