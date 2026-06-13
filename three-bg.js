/**
 * Pedro Sites — three-bg.js
 * Animação 3D de cristais flutuantes no fundo
 * Usa Three.js r128 via CDN
 */
(function () {
  "use strict";

  function initThreeBg() {
    const canvas = document.getElementById("bg3d");
    if (!canvas || typeof THREE === "undefined") return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 18;

    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    // Lights
    const ambLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambLight);

    const ptLight1 = new THREE.PointLight(0x6366f1, 3, 30);
    ptLight1.position.set(5, 8, 5);
    scene.add(ptLight1);

    const ptLight2 = new THREE.PointLight(0x8b5cf6, 2, 25);
    ptLight2.position.set(-6, -5, 3);
    scene.add(ptLight2);

    const ptLight3 = new THREE.PointLight(0x22d3ee, 1.5, 20);
    ptLight3.position.set(0, 0, 8);
    scene.add(ptLight3);

    // Crystal geometries pool
    const geos = [
      new THREE.OctahedronGeometry(1, 0),
      new THREE.TetrahedronGeometry(1, 0),
      new THREE.IcosahedronGeometry(0.8, 0),
      new THREE.OctahedronGeometry(0.6, 0),
    ];

    const colors = [0x6366f1, 0x8b5cf6, 0xa78bfa, 0x22d3ee, 0xec4899, 0x6366f1, 0x818cf8];

    const crystals = [];
    const COUNT = 28;

    for (let i = 0; i < COUNT; i++) {
      const geo = geos[Math.floor(Math.random() * geos.length)].clone();
      const color = colors[Math.floor(Math.random() * colors.length)];
      const isMetal = Math.random() > 0.4;

      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: isMetal ? 0.05 : 0.3,
        metalness: isMetal ? 0.9 : 0.1,
        transparent: true,
        opacity: 0.55 + Math.random() * 0.4,
        wireframe: Math.random() > 0.75,
      });

      const mesh = new THREE.Mesh(geo, mat);
      const scale = 0.3 + Math.random() * 1.1;
      mesh.scale.set(scale, scale * (0.7 + Math.random() * 0.8), scale);

      // Spread across wide area, pushed back
      mesh.position.set(
        (Math.random() - 0.5) * 32,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 14 - 4
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      scene.add(mesh);
      crystals.push({
        mesh,
        speed: { x: (Math.random() - 0.5) * 0.003, y: (Math.random() - 0.5) * 0.004, z: (Math.random() - 0.5) * 0.002 },
        rotSpeed: { x: (Math.random() - 0.5) * 0.008, y: (Math.random() - 0.5) * 0.01, z: (Math.random() - 0.5) * 0.006 },
        floatAmp: 0.02 + Math.random() * 0.05,
        floatFreq: 0.3 + Math.random() * 0.7,
        floatOffset: Math.random() * Math.PI * 2,
        baseY: mesh.position.y,
        baseX: mesh.position.x,
      });
    }

    // Mouse parallax
    let mouseX = 0, mouseY = 0;
    document.addEventListener("mousemove", (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    let t = 0;
    function animate() {
      requestAnimationFrame(animate);
      t += 0.016;

      // Light orbit
      ptLight1.position.x = Math.sin(t * 0.4) * 8;
      ptLight1.position.z = Math.cos(t * 0.4) * 6;
      ptLight2.position.x = Math.cos(t * 0.3) * 7;
      ptLight2.position.z = Math.sin(t * 0.3) * 5;

      // Camera subtle drift with mouse
      camera.position.x += (mouseX * 1.5 - camera.position.x) * 0.02;
      camera.position.y += (-mouseY * 1.0 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);

      crystals.forEach((c) => {
        c.mesh.rotation.x += c.rotSpeed.x;
        c.mesh.rotation.y += c.rotSpeed.y;
        c.mesh.rotation.z += c.rotSpeed.z;
        c.mesh.position.y = c.baseY + Math.sin(t * c.floatFreq + c.floatOffset) * c.floatAmp * 8;
        c.mesh.position.x = c.baseX + Math.cos(t * c.floatFreq * 0.6 + c.floatOffset) * c.floatAmp * 4;

        // Wrap edges
        if (c.mesh.position.x > 18) c.mesh.position.x = -18;
        if (c.mesh.position.x < -18) c.mesh.position.x = 18;
        if (c.mesh.position.y > 12) c.mesh.position.y = -12;
        if (c.mesh.position.y < -12) c.mesh.position.y = 12;
      });

      renderer.render(scene, camera);
    }
    animate();
  }

  // Wait for THREE.js to load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initThreeBg);
  } else {
    initThreeBg();
  }
})();
