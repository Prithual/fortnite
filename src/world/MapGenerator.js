import * as THREE from 'three';

export class MapGenerator {
  constructor(scene) {
    this.scene = scene;
    this.harvestables = []; // { id, mesh, type, material, hp, maxHp, bounds }
    this.chests = [];       // { id, mesh, aura, opened, x, y, z }
    this.terrain = null;

    this.initTerrain();
    this.initWater();
    this.initFoliageAndProps();
    this.initBuildings();
  }

  // Smooth mathematical heightmap for the island
  getElevation(x, z) {
    const distFromCenter = Math.hypot(x, z);
    const maxRadius = 260;

    // Ocean falloff
    if (distFromCenter > maxRadius) {
      return -5;
    }

    // Base hill rolling function
    const h1 = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 8;
    const h2 = Math.sin(x * 0.05 + 1.2) * Math.cos(z * 0.05 + 0.8) * 4;
    const h3 = Math.sin(x * 0.01) * 6;

    // Mountain in the north-east
    const mountainDist = Math.hypot(x - 90, z - 80);
    const mountain = Math.max(0, (60 - mountainDist) * 0.6);

    // Island dropoff near beaches
    const edgeFactor = Math.cos((distFromCenter / maxRadius) * (Math.PI / 2));
    const height = (h1 + h2 + h3 + mountain + 8) * edgeFactor;

    return Math.max(0.5, height);
  }

  initTerrain() {
    const size = 600;
    const segments = 120;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = [];
    const colorGrass = new THREE.Color(0x56a632);  // Classic vibrant Fortnite green
    const colorDirt = new THREE.Color(0x8a6f44);   // Trail/dirt brown
    const colorBeach = new THREE.Color(0xedd59e);  // Golden sand
    const colorRock = new THREE.Color(0x7a838b);   // Mountain rock

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getElevation(x, z);
      pos.setY(i, y);

      const dist = Math.hypot(x, z);
      let c = colorGrass.clone();

      if (dist > 230 || y < 1.8) {
        c = colorBeach;
      } else if (y > 22) {
        c = colorRock;
      } else if ((Math.sin(x * 0.1) * Math.cos(z * 0.1)) > 0.8) {
        c = colorDirt;
      }

      colors.push(c.r, c.g, c.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true
    });

    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }

  initWater() {
    const waterGeo = new THREE.PlaneGeometry(1000, 1000);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshBasicMaterial({
      color: 0x1ca3ec,
      transparent: true,
      opacity: 0.75
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = 0;
    this.scene.add(water);
  }

  initFoliageAndProps() {
    // 1. Procedural Trees (Pine & Oak) - Harvestable Wood
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * 210;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = this.getElevation(x, z);

      if (y > 1.5) {
        this.createTree(x, y, z, `tree_${i}`, i % 2 === 0 ? 'pine' : 'oak');
      }
    }

    // 2. Procedural Boulders - Harvestable Stone
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 200;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = this.getElevation(x, z);

      if (y > 1.5) {
        this.createRock(x, y, z, `rock_${i}`);
      }
    }

    // 3. Metal Props & Containers - Harvestable Metal
    const metalPositions = [
      { x: 30, z: -35 }, { x: -45, z: 20 }, { x: 75, z: 55 },
      { x: -85, z: -75 }, { x: 115, z: -25 }, { x: -125, z: 105 }
    ];
    metalPositions.forEach((pos, idx) => {
      const y = this.getElevation(pos.x, pos.z);
      this.createMetalProp(pos.x, y, pos.z, `metal_${idx}`);
    });
  }

  createTree(x, y, z, id, type = 'pine') {
    const group = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3.5, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6e4726 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.75;
    trunk.castShadow = true;
    group.add(trunk);

    // Leaves
    const leafMat = new THREE.MeshLambertMaterial({
      color: type === 'pine' ? 0x2e6f2b : 0x3e8e35,
      flatShading: true
    });

    if (type === 'pine') {
      for (let layer = 0; layer < 3; layer++) {
        const coneGeo = new THREE.ConeGeometry(2.2 - layer * 0.5, 2.5, 6);
        const cone = new THREE.Mesh(coneGeo, leafMat);
        cone.position.y = 3.2 + layer * 1.6;
        cone.castShadow = true;
        group.add(cone);
      }
    } else {
      const sphereGeo = new THREE.DodecahedronGeometry(2.3);
      const canopy = new THREE.Mesh(sphereGeo, leafMat);
      canopy.position.y = 4.2;
      canopy.scale.set(1.1, 1.3, 1.1);
      canopy.castShadow = true;
      group.add(canopy);
    }

    group.position.set(x, y, z);
    this.scene.add(group);

    this.harvestables.push({
      id,
      mesh: group,
      type: 'tree',
      material: 'wood',
      hp: 150,
      maxHp: 150,
      resourceYield: 30,
      x, y, z,
      radius: 1.5
    });
  }

  createRock(x, y, z, id) {
    const rockGeo = new THREE.DodecahedronGeometry(1.6 + Math.random() * 0.6);
    const rockMat = new THREE.MeshLambertMaterial({
      color: 0x828892,
      flatShading: true
    });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, y + 1.2, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    this.scene.add(rock);

    this.harvestables.push({
      id,
      mesh: rock,
      type: 'rock',
      material: 'stone',
      hp: 200,
      maxHp: 200,
      resourceYield: 35,
      x, y, z,
      radius: 1.8
    });
  }

  createMetalProp(x, y, z, id) {
    const group = new THREE.Group();
    // Shipping container or rusted vehicle body
    const boxGeo = new THREE.BoxGeometry(4.2, 2.2, 2.4);
    const boxMat = new THREE.MeshLambertMaterial({
      color: 0x3d6e99, // Blue shipping container
      flatShading: true
    });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.y = 1.1;
    box.castShadow = true;
    group.add(box);

    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI;
    this.scene.add(group);

    this.harvestables.push({
      id,
      mesh: group,
      type: 'container',
      material: 'metal',
      hp: 300,
      maxHp: 300,
      resourceYield: 45,
      x, y, z,
      radius: 2.5
    });
  }

  initBuildings() {
    // Village POI - Pleasant Park style houses
    const houses = [
      { x: 0, z: 0 },
      { x: 35, z: -40 },
      { x: -50, z: 25 },
      { x: 80, z: 60 },
      { x: -90, z: -80 }
    ];

    houses.forEach((h, idx) => {
      const y = this.getElevation(h.x, h.z);
      this.createHouse(h.x, y, h.z, `house_${idx}`);
    });
  }

  createHouse(x, y, z, id) {
    const group = new THREE.Group();

    // Wooden walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x9c7a4b });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x7c3527 });

    // Main floor box
    const houseBody = new THREE.Mesh(
      new THREE.BoxGeometry(9, 5, 9),
      wallMat
    );
    houseBody.position.y = 2.5;
    houseBody.castShadow = true;
    group.add(houseBody);

    // Pitched Roof
    const roofGeo = new THREE.ConeGeometry(7.2, 3.2, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 6.6;
    roof.castShadow = true;
    group.add(roof);

    group.position.set(x, y, z);
    this.scene.add(group);

    // Place a Golden Chest in the house
    this.createChest(x, y + 5.2, z, `chest_${id}`);
  }

  createChest(x, y, z, id) {
    const chestGroup = new THREE.Group();

    // Golden Chest Chest Body
    const chestMat = new THREE.MeshLambertMaterial({
      color: 0xfaad14,
      emissive: 0x664400
    });
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.7, 0.8);
    const body = new THREE.Mesh(bodyGeo, chestMat);
    body.position.y = 0.35;
    body.castShadow = true;
    chestGroup.add(body);

    // Golden glowing beacon beam
    const beamGeo = new THREE.CylinderGeometry(0.15, 0.3, 14, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 0.35
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 7;
    chestGroup.add(beam);

    chestGroup.position.set(x, y, z);
    this.scene.add(chestGroup);

    this.chests.push({
      id,
      mesh: chestGroup,
      beam,
      opened: false,
      x, y, z,
      radius: 3.5
    });
  }

  removeHarvestable(id) {
    const idx = this.harvestables.findIndex(h => h.id === id);
    if (idx !== -1) {
      const h = this.harvestables.splice(idx, 1)[0];
      this.scene.remove(h.mesh);
    }
  }

  openChest(id) {
    const chest = this.chests.find(c => c.id === id);
    if (chest && !chest.opened) {
      chest.opened = true;
      if (chest.beam) {
        this.scene.remove(chest.beam);
      }
      // Rotate chest lid open
      chest.mesh.children[0].material.color.setHex(0x555555);
    }
  }
}
