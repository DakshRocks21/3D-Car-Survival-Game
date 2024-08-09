window.focus();

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getDistance(coordinate1, coordinate2) {
  const horizontalDistance = coordinate2.x - coordinate1.x;
  const verticalDistance = coordinate2.y - coordinate1.y;
  return Math.sqrt(horizontalDistance ** 2 + verticalDistance ** 2);
}

const vehicleColors = [
  0x3498db,
  0xe74c3c,
  0x2ecc71,
  0xf39c12
];

const lawnGreen = "#01ad65";
const trackColor = "#3e4756";
const edgeColor = "#ecf92a";
const treeCrownColor = 0x1bad01;
const treeTrunkColor = 0x2a2b20;

const wheelGeometry = new THREE.BoxBufferGeometry(12, 33, 12);
const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
const treeTrunkGeometry = new THREE.BoxBufferGeometry(15, 15, 30);
const treeTrunkMaterial = new THREE.MeshLambertMaterial({
  color: treeTrunkColor
});
const treeCrownMaterial = new THREE.MeshLambertMaterial({
  color: treeCrownColor
});

const config = {
  showHitZones: false,
  shadows: true,
  trees: true,
  curbs: true,
  grid: false
};

let score;
let speed = 0.0017;
let speedMultiplier = 1;

const playerAngleInitial = Math.PI;
let playerAngleMoved;
let accelerate = false;
let decelerate = false;

let otherVehicles = [];
let ready;
let lastTimestamp;

const trackRadius = 225;
const trackWidth = 45;
const innerTrackRadius = trackRadius - trackWidth;
const outerTrackRadius = trackRadius + trackWidth;

const arcAngle1 = (1 / 3) * Math.PI;

const deltaY = Math.sin(arcAngle1) * innerTrackRadius;
const arcAngle2 = Math.asin(deltaY / outerTrackRadius);

const arcCenterX =
  (Math.cos(arcAngle1) * innerTrackRadius +
    Math.cos(arcAngle2) * outerTrackRadius) /
  2;

const arcAngle3 = Math.acos(arcCenterX / innerTrackRadius);

const arcAngle4 = Math.acos(arcCenterX / outerTrackRadius);

const scoreElement = document.getElementById("score");
const buttonsElement = document.getElementById("buttons");
const instructionsElement = document.getElementById("instructions");
const resultsElement = document.getElementById("results");
const accelerateButton = document.getElementById("accelerate");
const decelerateButton = document.getElementById("decelerate");
const speedMultiplierInput = document.getElementById("speedMultiplier");
const speedValue = document.getElementById("speedValue");

speedMultiplierInput.addEventListener("input", function () {
  speedMultiplier = parseFloat(this.value);
  speedValue.textContent = `${speedMultiplier}x`;
});

setTimeout(() => {
  if (ready) instructionsElement.style.opacity = 1;
  buttonsElement.style.opacity = 1;
}, 4000);

const aspectRatio = window.innerWidth / window.innerHeight;
const cameraWidth = 960;
const cameraHeight = cameraWidth / aspectRatio;

const camera = new THREE.OrthographicCamera(
  cameraWidth / -2,
  cameraWidth / 2,
  cameraHeight / 2,
  cameraHeight / -2,
  50,
  700
);

camera.position.set(0, -210, 300);
camera.lookAt(0, 0, 0);

const scene = new THREE.Scene();

const playerCar = Car();
scene.add(playerCar);

renderMap(cameraWidth, cameraHeight * 2);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(100, -300, 300);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.left = -400;
dirLight.shadow.camera.right = 350;
dirLight.shadow.camera.top = 400;
dirLight.shadow.camera.bottom = -300;
dirLight.shadow.camera.near = 100;
dirLight.shadow.camera.far = 800;
scene.add(dirLight);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
if (config.shadows) renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

reset();

function reset() {
  playerAngleMoved = 0;
  score = 0;
  scoreElement.innerText = "Press UP";

  otherVehicles.forEach((vehicle) => {
    scene.remove(vehicle.mesh);
    if (vehicle.mesh.userData.hitZone1)
      scene.remove(vehicle.mesh.userData.hitZone1);
    if (vehicle.mesh.userData.hitZone2)
      scene.remove(vehicle.mesh.userData.hitZone2);
    if (vehicle.mesh.userData.hitZone3)
      scene.remove(vehicle.mesh.userData.hitZone3);
  });
  otherVehicles = [];

  resultsElement.style.display = "none";
  lastTimestamp = undefined;

  movePlayerCar(0);
  renderer.render(scene, camera);

  ready = true;
}

function startGame() {
  if (ready) {
    ready = false;
    scoreElement.innerText = 0;
    buttonsElement.style.opacity = 1;
    instructionsElement.style.opacity = 0;
    renderer.setAnimationLoop(animation);
  }
}

function positionScoreElement() {
  const arcCenterXinPixels = (arcCenterX / cameraWidth) * window.innerWidth;
  scoreElement.style.cssText = `
    left: ${window.innerWidth / 2 - arcCenterXinPixels * 1.3}px;
    top: ${window.innerHeight / 2}px
  `;
}

function getLineMarkings(mapWidth, mapHeight) {
  const canvas = document.createElement("canvas");
  canvas.width = mapWidth;
  canvas.height = mapHeight;
  const context = canvas.getContext("2d");

  context.fillStyle = trackColor;
  context.fillRect(0, 0, mapWidth, mapHeight);

  context.lineWidth = 2;
  context.strokeStyle = "#d35400";
  context.setLineDash([10, 14]);

  context.beginPath();
  context.arc(
    mapWidth / 2 - arcCenterX,
    mapHeight / 2,
    trackRadius,
    0,
    Math.PI * 2
  );
  context.stroke();

  context.beginPath();
  context.arc(
    mapWidth / 2 + arcCenterX,
    mapHeight / 2,
    trackRadius,
    0,
    Math.PI * 2
  );
  context.stroke();

  return new THREE.CanvasTexture(canvas);
}

function getCurbsTexture(mapWidth, mapHeight) {
  const canvas = document.createElement("canvas");
  canvas.width = mapWidth;
  canvas.height = mapHeight;
  const context = canvas.getContext("2d");

  context.fillStyle = lawnGreen;
  context.fillRect(0, 0, mapWidth, mapHeight);

  context.lineWidth = 65;
  context.strokeStyle = "#e67e22";
  context.beginPath();
  context.arc(
    mapWidth / 2 - arcCenterX,
    mapHeight / 2,
    innerTrackRadius,
    arcAngle1,
    -arcAngle1
  );
  context.arc(
    mapWidth / 2 + arcCenterX,
    mapHeight / 2,
    outerTrackRadius,
    Math.PI + arcAngle2,
    Math.PI - arcAngle2,
    true
  );
  context.stroke();

  context.beginPath();
  context.arc(
    mapWidth / 2 + arcCenterX,
    mapHeight / 2,
    innerTrackRadius,
    Math.PI + arcAngle1,
    Math.PI - arcAngle1
  );
  context.arc(
    mapWidth / 2 - arcCenterX,
    mapHeight / 2,
    outerTrackRadius,
    arcAngle2,
    -arcAngle2,
    true
  );
  context.stroke();

  context.lineWidth = 60;
  context.strokeStyle = lawnGreen;
  context.beginPath();
  context.arc(
    mapWidth / 2 - arcCenterX,
    mapHeight / 2,
    innerTrackRadius,
    arcAngle1,
    -arcAngle1
  );
  context.arc(
    mapWidth / 2 + arcCenterX,
    mapHeight / 2,
    outerTrackRadius,
    Math.PI + arcAngle2,
    Math.PI - arcAngle2,
    true
  );
  context.arc(
    mapWidth / 2 + arcCenterX,
    mapHeight / 2,
    innerTrackRadius,
    Math.PI + arcAngle1,
    Math.PI - arcAngle1
  );
  context.arc(
    mapWidth / 2 - arcCenterX,
    mapHeight / 2,
    outerTrackRadius,
    arcAngle2,
    -arcAngle2,
    true
  );
  context.stroke();

  context.lineWidth = 6;
  context.strokeStyle = edgeColor;

  context.beginPath();
  context.arc(
    mapWidth / 2 - arcCenterX,
    mapHeight / 2,
    outerTrackRadius,
    0,
    Math.PI * 2
  );
  context.stroke();

  context.beginPath();
  context.arc(
    mapWidth / 2 + arcCenterX,
    mapHeight / 2,
    outerTrackRadius,
    0,
    Math.PI * 2
  );
  context.stroke();

  context.beginPath();
  context.arc(
    mapWidth / 2 - arcCenterX,
    mapHeight / 2,
    innerTrackRadius,
    0,
    Math.PI * 2
  );
  context.stroke();

  context.beginPath();
  context.arc(
    mapWidth / 2 + arcCenterX,
    mapHeight / 2,
    innerTrackRadius,
    0,
    Math.PI * 2
  );
  context.stroke();

  return new THREE.CanvasTexture(canvas);
}

function getLeftIsland() {
  const islandLeft = new THREE.Shape();
  islandLeft.absarc(
    -arcCenterX,
    0,
    innerTrackRadius,
    arcAngle1,
    -arcAngle1,
    false
  );
  islandLeft.absarc(
    arcCenterX,
    0,
    outerTrackRadius,
    Math.PI + arcAngle2,
    Math.PI - arcAngle2,
    true
  );
  return islandLeft;
}

function getMiddleIsland() {
  const islandMiddle = new THREE.Shape();
  islandMiddle.absarc(
    -arcCenterX,
    0,
    innerTrackRadius,
    arcAngle3,
    -arcAngle3,
    true
  );
  islandMiddle.absarc(
    arcCenterX,
    0,
    innerTrackRadius,
    Math.PI + arcAngle3,
    Math.PI - arcAngle3,
    true
  );
  return islandMiddle;
}

function getRightIsland() {
  const islandRight = new THREE.Shape();
  islandRight.absarc(
    arcCenterX,
    0,
    innerTrackRadius,
    Math.PI - arcAngle1,
    Math.PI + arcAngle1,
    true
  );
  islandRight.absarc(
    -arcCenterX,
    0,
    outerTrackRadius,
    -arcAngle2,
    arcAngle2,
    false
  );
  return islandRight;
}

function getOuterField(mapWidth, mapHeight) {
  const field = new THREE.Shape();
  field.moveTo(-mapWidth / 2, -mapHeight / 2);
  field.lineTo(0, -mapHeight / 2);

  field.absarc(-arcCenterX, 0, outerTrackRadius, -arcAngle4, arcAngle4, true);

  field.absarc(
    arcCenterX,
    0,
    outerTrackRadius,
    Math.PI - arcAngle4,
    Math.PI + arcAngle4,
    true
  );

  field.lineTo(0, -mapHeight / 2);
  field.lineTo(mapWidth / 2, -mapHeight / 2);
  field.lineTo(mapWidth / 2, mapHeight / 2);
  field.lineTo(-mapWidth / 2, mapHeight / 2);

  return field;
}

function renderMap(mapWidth, mapHeight) {
  const lineMarkingsTexture = getLineMarkings(mapWidth, mapHeight);

  const planeGeometry = new THREE.PlaneBufferGeometry(mapWidth, mapHeight);
  const planeMaterial = new THREE.MeshLambertMaterial({
    map: lineMarkingsTexture
  });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.receiveShadow = true;
  plane.matrixAutoUpdate = false;
  scene.add(plane);

  const islandLeft = getLeftIsland();
  const islandMiddle = getMiddleIsland();
  const islandRight = getRightIsland();
  const outerField = getOuterField(mapWidth, mapHeight);

  const curbsTexture = getCurbsTexture(mapWidth, mapHeight);
  curbsTexture.offset = new THREE.Vector2(0.5, 0.5);
  curbsTexture.repeat.set(1 / mapWidth, 1 / mapHeight);

  const fieldGeometry = new THREE.ExtrudeBufferGeometry(
    [islandLeft, islandRight, islandMiddle, outerField],
    { depth: 6, bevelEnabled: false }
  );

  const fieldMesh = new THREE.Mesh(fieldGeometry, [
    new THREE.MeshLambertMaterial({
      color: !config.curbs && lawnGreen,
      map: config.curbs && curbsTexture
    }),
    new THREE.MeshLambertMaterial({ color: 0x23311c })
  ]);
  fieldMesh.receiveShadow = true;
  fieldMesh.matrixAutoUpdate = false;
  scene.add(fieldMesh);

  positionScoreElement();

  if (config.trees) {
    const tree1 = Tree();
    tree1.position.x = arcCenterX * 1.3;
    scene.add(tree1);

    const tree2 = Tree();
    tree2.position.y = arcCenterX * 1.9;
    tree2.position.x = arcCenterX * 1.3;
    scene.add(tree2);

    const tree3 = Tree();
    tree3.position.x = arcCenterX * 0.8;
    tree3.position.y = arcCenterX * 2;
    scene.add(tree3);

    const tree4 = Tree();
    tree4.position.x = arcCenterX * 1.8;
    tree4.position.y = arcCenterX * 2;
    scene.add(tree4);

    const tree5 = Tree();
    tree5.position.x = -arcCenterX * 1;
    tree5.position.y = arcCenterX * 2;
    scene.add(tree5);

    const tree6 = Tree();
    tree6.position.x = -arcCenterX * 2;
    tree6.position.y = arcCenterX * 1.8;
    scene.add(tree6);

    const tree7 = Tree();
    tree7.position.x = arcCenterX * 0.8;
    tree7.position.y = -arcCenterX * 2;
    scene.add(tree7);

    const tree8 = Tree();
    tree8.position.x = arcCenterX * 1.8;
    tree8.position.y = -arcCenterX * 2;
    scene.add(tree8);

    const tree9 = Tree();
    tree9.position.x = -arcCenterX * 1;
    tree9.position.y = -arcCenterX * 2;
    scene.add(tree9);

    const tree10 = Tree();
    tree10.position.x = -arcCenterX * 2;
    tree10.position.y = -arcCenterX * 1.8;
    scene.add(tree10);

    const tree11 = Tree();
    tree11.position.x = arcCenterX * 0.6;
    tree11.position.y = -arcCenterX * 2.3;
    scene.add(tree11);

    const tree12 = Tree();
    tree12.position.x = arcCenterX * 1.5;
    tree12.position.y = -arcCenterX * 2.4;
    scene.add(tree12);

    const tree13 = Tree();
    tree13.position.x = -arcCenterX * 0.7;
    tree13.position.y = -arcCenterX * 2.4;
    scene.add(tree13);

    const tree14 = Tree();
    tree14.position.x = -arcCenterX * 1.5;
    tree14.position.y = -arcCenterX * 1.8;
    scene.add(tree14);
  }
}

function getCarFrontTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 32;
  const context = canvas.getContext("2d");

  context.fillStyle = "#1abc9c";
  context.fillRect(0, 0, 64, 32);

  context.fillStyle = "#34495e";
  context.fillRect(8, 8, 48, 24);

  return new THREE.CanvasTexture(canvas);
}

function getCarSideTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 32;
  const context = canvas.getContext("2d");

  context.fillStyle = "#1abc9c";
  context.fillRect(0, 0, 128, 32);

  context.fillStyle = "#34495e";
  context.fillRect(10, 8, 38, 24);
  context.fillRect(58, 8, 60, 24);

  return new THREE.CanvasTexture(canvas);
}

function Car() {
  const car = new THREE.Group();

  const color = pickRandom(vehicleColors);

  const main = new THREE.Mesh(
    new THREE.BoxBufferGeometry(60, 30, 15),
    new THREE.MeshLambertMaterial({ color })
  );
  main.position.z = 12;
  main.castShadow = true;
  main.receiveShadow = true;
  car.add(main);

  const carFrontTexture = getCarFrontTexture();
  carFrontTexture.center = new THREE.Vector2(0.5, 0.5);
  carFrontTexture.rotation = Math.PI / 2;

  const carBackTexture = getCarFrontTexture();
  carBackTexture.center = new THREE.Vector2(0.5, 0.5);
  carBackTexture.rotation = -Math.PI / 2;

  const carLeftSideTexture = getCarSideTexture();
  carLeftSideTexture.flipY = false;

  const carRightSideTexture = getCarSideTexture();

  const cabin = new THREE.Mesh(new THREE.BoxBufferGeometry(33, 24, 12), [
    new THREE.MeshLambertMaterial({ map: carFrontTexture }),
    new THREE.MeshLambertMaterial({ map: carBackTexture }),
    new THREE.MeshLambertMaterial({ map: carLeftSideTexture }),
    new THREE.MeshLambertMaterial({ map: carRightSideTexture }),
    new THREE.MeshLambertMaterial({ color: 0x2c3e50 }),
    new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
  ]);
  cabin.position.x = -6;
  cabin.position.z = 25.5;
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  car.add(cabin);

  const backWheel = new Wheel();
  backWheel.position.x = -18;
  car.add(backWheel);

  const frontWheel = new Wheel();
  frontWheel.position.x = 18;
  car.add(frontWheel);

  return car;
}

function getTruckFrontTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");

  context.fillStyle = "#27ae60";
  context.fillRect(0, 0, 32, 32);

  context.fillStyle = "#34495e";
  context.fillRect(0, 5, 32, 10);

  return new THREE.CanvasTexture(canvas);
}

function getTruckSideTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");

  context.fillStyle = "#27ae60";
  context.fillRect(0, 0, 32, 32);

  context.fillStyle = "#34495e";
  context.fillRect(17, 5, 15, 10);

  return new THREE.CanvasTexture(canvas);
}

function Truck() {
  const truck = new THREE.Group();
  const color = pickRandom(vehicleColors);

  const base = new THREE.Mesh(
    new THREE.BoxBufferGeometry(100, 25, 5),
    new THREE.MeshLambertMaterial({ color: 0x27ae60 })
  );
  base.position.z = 10;
  truck.add(base);

  const cargo = new THREE.Mesh(
    new THREE.BoxBufferGeometry(75, 35, 40),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  cargo.position.x = -15;
  cargo.position.z = 30;
  cargo.castShadow = true;
  cargo.receiveShadow = true;
  truck.add(cargo);

  const truckFrontTexture = getTruckFrontTexture();
  truckFrontTexture.center = new THREE.Vector2(0.5, 0.5);
  truckFrontTexture.rotation = Math.PI / 2;

  const truckLeftTexture = getTruckSideTexture();
  truckLeftTexture.flipY = false;

  const truckRightTexture = getTruckSideTexture();

  const cabin = new THREE.Mesh(new THREE.BoxBufferGeometry(25, 30, 30), [
    new THREE.MeshLambertMaterial({ color, map: truckFrontTexture }),
    new THREE.MeshLambertMaterial({ color }),
    new THREE.MeshLambertMaterial({ color, map: truckLeftTexture }),
    new THREE.MeshLambertMaterial({ color, map: truckRightTexture }),
    new THREE.MeshLambertMaterial({ color }),
    new THREE.MeshLambertMaterial({ color })
  ]);
  cabin.position.x = 40;
  cabin.position.z = 20;
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  truck.add(cabin);

  const backWheel = Wheel();
  backWheel.position.x = -30;
  truck.add(backWheel);

  const middleWheel = Wheel();
  middleWheel.position.x = 10;
  truck.add(middleWheel);

  const frontWheel = Wheel();
  frontWheel.position.x = 38;
  truck.add(frontWheel);

  return truck;
}

function Wheel() {
  const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  wheel.position.z = 6;
  wheel.castShadow = false;
  wheel.receiveShadow = false;
  return wheel;
}

function Tree() {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(treeTrunkGeometry, treeTrunkMaterial);
  trunk.position.z = 10;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.matrixAutoUpdate = false;
  tree.add(trunk);

  const treeHeights = [45, 60, 75];
  const height = pickRandom(treeHeights);

  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(height / 2, 30, 30),
    treeCrownMaterial
  );
  crown.position.z = height / 2 + 30;
  crown.castShadow = true;
  crown.receiveShadow = false;
  tree.add(crown);

  return tree;
}

accelerateButton.addEventListener("mousedown", function () {
  startGame();
  accelerate = true;
});
decelerateButton.addEventListener("mousedown", function () {
  startGame();
  decelerate = true;
});
accelerateButton.addEventListener("mouseup", function () {
  accelerate = false;
});
decelerateButton.addEventListener("mouseup", function () {
  decelerate = false;
});
window.addEventListener("keydown", function (event) {
  if (event.key == "ArrowUp") {
    startGame();
    accelerate = true;
    return;
  }
  if (event.key == "ArrowDown") {
    decelerate = true;
    return;
  }
  if (event.key == "R" || event.key == "r") {
    reset();
    return;
  }
});
window.addEventListener("keyup", function (event) {
  if (event.key == "ArrowUp") {
    accelerate = false;
    return;
  }
  if (event.key == "ArrowDown") {
    decelerate = false;
    return;
  }
});

function animation(timestamp) {
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
    return;
  }

  const timeDelta = timestamp - lastTimestamp;

  movePlayerCar(timeDelta);

  const laps = Math.floor(Math.abs(playerAngleMoved) / (Math.PI * 2));

  if (laps != score) {
    score = laps;
    scoreElement.innerText = score;
  }

  if (otherVehicles.length < (laps + 1) / 5) addVehicle();

  moveOtherVehicles(timeDelta);

  hitDetection();

  renderer.render(scene, camera);
  lastTimestamp = timestamp;
}

function movePlayerCar(timeDelta) {
  const playerSpeed = getPlayerSpeed();
  playerAngleMoved -= playerSpeed * timeDelta;

  const totalPlayerAngle = playerAngleInitial + playerAngleMoved;

  const playerX = Math.cos(totalPlayerAngle) * trackRadius - arcCenterX;
  const playerY = Math.sin(totalPlayerAngle) * trackRadius;

  playerCar.position.x = playerX;
  playerCar.position.y = playerY;

  playerCar.rotation.z = totalPlayerAngle - Math.PI / 2;
}

function moveOtherVehicles(timeDelta) {
  otherVehicles.forEach((vehicle) => {
    if (vehicle.clockwise) {
      vehicle.angle -= speed * timeDelta * vehicle.speed;
    } else {
      vehicle.angle += speed * timeDelta * vehicle.speed;
    }

    const vehicleX = Math.cos(vehicle.angle) * trackRadius + arcCenterX;
    const vehicleY = Math.sin(vehicle.angle) * trackRadius;
    const rotation =
      vehicle.angle + (vehicle.clockwise ? -Math.PI / 2 : Math.PI / 2);
    vehicle.mesh.position.x = vehicleX;
    vehicle.mesh.position.y = vehicleY;
    vehicle.mesh.rotation.z = rotation;
  });
}

function getPlayerSpeed() {
  if (accelerate) return speed * 2*speedMultiplier;
  if (decelerate) return speed * 0.5;
  return speed;
}

function addVehicle() {
  const vehicleTypes = ["car", "truck"];

  const type = pickRandom(vehicleTypes);
  const speed = getVehicleSpeed(type);
  const clockwise = Math.random() >= 0.5;

  const angle = clockwise ? Math.PI / 2 : -Math.PI / 2;

  const mesh = type == "car" ? Car() : Truck();
  scene.add(mesh);

  otherVehicles.push({ mesh, type, speed, clockwise, angle });
}

function getVehicleSpeed(type) {
  if (type == "car") {
    const minimumSpeed = 1;
    const maximumSpeed = 2;
    return minimumSpeed + Math.random() * (maximumSpeed - minimumSpeed);
  }
  if (type == "truck") {
    const minimumSpeed = 0.6;
    const maximumSpeed = 1.5;
    return minimumSpeed + Math.random() * (maximumSpeed - minimumSpeed);
  }
}

function getHitZonePosition(center, angle, clockwise, distance) {
  const directionAngle = angle + clockwise ? -Math.PI / 2 : +Math.PI / 2;
  return {
    x: center.x + Math.cos(directionAngle) * distance,
    y: center.y + Math.sin(directionAngle) * distance
  };
}

function hitDetection() {
  const playerHitZone1 = getHitZonePosition(
    playerCar.position,
    playerAngleInitial + playerAngleMoved,
    true,
    15
  );

  const playerHitZone2 = getHitZonePosition(
    playerCar.position,
    playerAngleInitial + playerAngleMoved,
    true,
    -15
  );

  const hit = otherVehicles.some((vehicle) => {
    if (vehicle.type == "car") {
      const vehicleHitZone1 = getHitZonePosition(
        vehicle.mesh.position,
        vehicle.angle,
        vehicle.clockwise,
        15
      );

      const vehicleHitZone2 = getHitZonePosition(
        vehicle.mesh.position,
        vehicle.angle,
        vehicle.clockwise,
        -15
      );

      if (getDistance(playerHitZone1, vehicleHitZone1) < 40) return true;
      if (getDistance(playerHitZone1, vehicleHitZone2) < 40) return true;

      if (getDistance(playerHitZone2, vehicleHitZone1) < 40) return true;
    }

    if (vehicle.type == "truck") {
      const vehicleHitZone1 = getHitZonePosition(
        vehicle.mesh.position,
        vehicle.angle,
        vehicle.clockwise,
        35
      );

      const vehicleHitZone2 = getHitZonePosition(
        vehicle.mesh.position,
        vehicle.angle,
        vehicle.clockwise,
        0
      );

      const vehicleHitZone3 = getHitZonePosition(
        vehicle.mesh.position,
        vehicle.angle,
        vehicle.clockwise,
        -35
      );

      if (getDistance(playerHitZone1, vehicleHitZone1) < 40) return true;
      if (getDistance(playerHitZone1, vehicleHitZone2) < 40) return true;
      if (getDistance(playerHitZone1, vehicleHitZone3) < 40) return true;

      if (getDistance(playerHitZone2, vehicleHitZone1) < 40) return true;
    }
  });

  if (hit) {
    if (resultsElement) resultsElement.style.display = "flex";
    renderer.setAnimationLoop(null);
  }
}

window.addEventListener("resize", () => {
  const newAspectRatio = window.innerWidth / window.innerHeight;
  const adjustedCameraHeight = cameraWidth / newAspectRatio;

  camera.top = adjustedCameraHeight / 2;
  camera.bottom = adjustedCameraHeight / -2;
  camera.updateProjectionMatrix();

  positionScoreElement();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
});
