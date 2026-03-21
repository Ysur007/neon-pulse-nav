import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  DoubleSide,
  EdgesGeometry,
  EllipseCurve,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

const palettes = {
  laser: {
    accent: "#68f4ff",
    secondary: "#7d6dff",
    highlight: "#edf7ff",
    ring: "#8ff8c3",
  },
  sunset: {
    accent: "#ffb36d",
    secondary: "#ff5d73",
    highlight: "#fff0e6",
    ring: "#ffd86d",
  },
  matrix: {
    accent: "#70f7af",
    secondary: "#18c275",
    highlight: "#effff5",
    ring: "#b9ff6f",
  },
};

function blendColor(colorA, colorB, mix) {
  return colorA.clone().lerp(colorB, mix);
}

function createOrbit(radius, tiltX, tiltY, color, opacity) {
  const curve = new EllipseCurve(0, 0, radius, radius * 0.58, 0, Math.PI * 2);
  const points = curve
    .getPoints(180)
    .map((point) => new Vector3(point.x, point.y, 0));
  const geometry = new BufferGeometry().setFromPoints(points);
  const material = new LineBasicMaterial({
    color,
    transparent: true,
    opacity,
  });

  const orbit = new LineLoop(geometry, material);
  orbit.rotation.x = tiltX;
  orbit.rotation.y = tiltY;
  return orbit;
}

export function createNebulaScene(canvas, initialTheme = "laser") {
  const isCoarse = window.matchMedia("(pointer: coarse)").matches;
  const maxPixelRatio = isCoarse ? 1.5 : 2;
  const renderer = new WebGLRenderer({
    canvas,
    antialias: !isCoarse,
    alpha: true,
    powerPreference: "high-performance",
  });

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));

  const scene = new Scene();
  const camera = new PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.set(0, 0, 18);

  const root = new Group();
  scene.add(root);

  const ambientLight = new AmbientLight(0xffffff, 1.35);
  const keyLight = new PointLight(0xffffff, 10, 60);
  const fillLight = new PointLight(0xffffff, 8, 50);
  keyLight.position.set(8, 7, 12);
  fillLight.position.set(-9, -5, 10);
  scene.add(ambientLight, keyLight, fillLight);

  const shellMaterial = new LineBasicMaterial({
    transparent: true,
    opacity: isCoarse ? 0.24 : 0.38,
  });

  const shell = new LineSegments(
    new EdgesGeometry(new IcosahedronGeometry(isCoarse ? 4.7 : 5.2, 1)),
    shellMaterial
  );
  shell.rotation.set(0.45, 0.85, 0.08);
  root.add(shell);

  const orbitA = createOrbit(7.4, 1.04, 0.24, 0xffffff, 0.16);
  const orbitB = createOrbit(6.1, 0.46, -0.82, 0xffffff, 0.14);
  const orbitC = createOrbit(5.3, -0.68, 0.58, 0xffffff, 0.1);
  root.add(orbitA, orbitB, orbitC);

  const halo = new Mesh(
    new RingGeometry(3.8, 4.55, 96),
    new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
      side: DoubleSide,
    })
  );
  halo.rotation.x = Math.PI / 2.35;
  root.add(halo);

  const particleCount = isCoarse ? 520 : 980;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const seeds = new Float32Array(particleCount * 5);

  for (let index = 0; index < particleCount; index += 1) {
    const radius = 5 + Math.random() * 6.8;
    const angle = Math.random() * Math.PI * 2;
    const band = (Math.random() - 0.5) * (isCoarse ? 8.8 : 11.4);
    const speed = 0.18 + Math.random() * 0.55;
    const wobble = Math.random() * Math.PI * 2;
    const base = index * 5;
    const offset = index * 3;

    seeds[base] = radius;
    seeds[base + 1] = angle;
    seeds[base + 2] = band;
    seeds[base + 3] = speed;
    seeds[base + 4] = wobble;

    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = band;
    positions[offset + 2] = Math.sin(angle) * radius * 0.72;
  }

  const particleGeometry = new BufferGeometry();
  particleGeometry.setAttribute("position", new BufferAttribute(positions, 3));
  particleGeometry.setAttribute("color", new BufferAttribute(colors, 3));

  const particleMaterial = new PointsMaterial({
    size: isCoarse ? 0.07 : 0.09,
    transparent: true,
    opacity: 0.95,
    sizeAttenuation: true,
    vertexColors: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const particles = new Points(particleGeometry, particleMaterial);
  root.add(particles);

  const pointer = new Vector2(0, 0);
  const clock = new Clock();
  let elapsed = 0;
  let resizeFrameId = 0;
  let currentWidth = 0;
  let currentHeight = 0;
  let currentPixelRatio = 0;
  let animationRunning = false;

  function applyPalette(themeKey) {
    const palette = palettes[themeKey] ?? palettes.laser;
    const accent = new Color(palette.accent);
    const secondary = new Color(palette.secondary);
    const highlight = new Color(palette.highlight);
    const ring = new Color(palette.ring);

    shellMaterial.color.copy(secondary);
    orbitA.material.color.copy(accent);
    orbitB.material.color.copy(highlight);
    orbitC.material.color.copy(ring);
    halo.material.color.copy(accent);
    keyLight.color.copy(accent);
    fillLight.color.copy(secondary);

    for (let index = 0; index < particleCount; index += 1) {
      const offset = index * 3;
      const mixPrimary = (index % 11) / 10;
      const mixSecondary = (index % 7) / 6;
      const color = blendColor(accent, highlight, mixPrimary * 0.55).lerp(
        secondary,
        mixSecondary * 0.28
      );

      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    }

    particleGeometry.attributes.color.needsUpdate = true;
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, maxPixelRatio);

    if (
      width === currentWidth &&
      height === currentHeight &&
      pixelRatio === currentPixelRatio
    ) {
      return;
    }

    currentWidth = width;
    currentHeight = height;
    currentPixelRatio = pixelRatio;

    renderer.setSize(width, height, false);
    renderer.setPixelRatio(pixelRatio);

    camera.aspect = width / height;
    camera.position.z = width < 720 ? 19.5 : 18;
    camera.updateProjectionMatrix();
  }

  function scheduleResize() {
    if (resizeFrameId) {
      return;
    }

    resizeFrameId = window.requestAnimationFrame(() => {
      resizeFrameId = 0;
      resize();
    });
  }

  function handlePointerMove(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  function render() {
    elapsed += Math.min(clock.getDelta(), 0.05);
    const positionArray = particleGeometry.attributes.position.array;

    root.rotation.x += ((pointer.y * 0.22) - root.rotation.x) * 0.035;
    root.rotation.y += ((pointer.x * 0.3) - root.rotation.y) * 0.035;

    shell.rotation.x += 0.0015;
    shell.rotation.y += 0.002;
    orbitA.rotation.z += 0.0016;
    orbitB.rotation.z -= 0.0011;
    orbitC.rotation.z += 0.0008;
    halo.rotation.z -= 0.004;
    particles.rotation.y -= 0.00075;
    particles.rotation.z += 0.00035;

    for (let index = 0; index < particleCount; index += 1) {
      const seedOffset = index * 5;
      const positionOffset = index * 3;
      const radius = seeds[seedOffset];
      const baseAngle = seeds[seedOffset + 1];
      const band = seeds[seedOffset + 2];
      const speed = seeds[seedOffset + 3];
      const wobble = seeds[seedOffset + 4];
      const angle = baseAngle + elapsed * speed;
      const ripple = Math.sin(elapsed * 1.1 + wobble) * 0.42;
      const lift = Math.cos(angle * 2 + wobble) * 0.58;

      positionArray[positionOffset] = Math.cos(angle) * (radius + ripple);
      positionArray[positionOffset + 1] =
        band + Math.sin(angle * 1.65 + wobble) * 0.92;
      positionArray[positionOffset + 2] =
        Math.sin(angle) * (radius * 0.72) + lift;
    }

    particleGeometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  }

  function startAnimationLoop() {
    if (animationRunning) {
      return;
    }

    clock.start();
    renderer.setAnimationLoop(render);
    animationRunning = true;
  }

  function stopAnimationLoop() {
    if (!animationRunning) {
      return;
    }

    renderer.setAnimationLoop(null);
    clock.stop();
    animationRunning = false;
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      stopAnimationLoop();
      return;
    }

    scheduleResize();
    startAnimationLoop();
  }

  resize();
  applyPalette(initialTheme);
  startAnimationLoop();

  window.addEventListener("resize", scheduleResize);
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return {
    setTheme(themeKey) {
      applyPalette(themeKey);
    },
    destroy() {
      stopAnimationLoop();
      if (resizeFrameId) {
        window.cancelAnimationFrame(resizeFrameId);
      }
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      particleGeometry.dispose();
      particleMaterial.dispose();
      shell.geometry.dispose();
      shellMaterial.dispose();
      orbitA.geometry.dispose();
      orbitA.material.dispose();
      orbitB.geometry.dispose();
      orbitB.material.dispose();
      orbitC.geometry.dispose();
      orbitC.material.dispose();
      halo.geometry.dispose();
      halo.material.dispose();
      renderer.dispose();
    },
  };
}
