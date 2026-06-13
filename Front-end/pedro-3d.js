/**
 * pedro-3d.js — Seção 3D "Pedro Dev de Elite"
 * Requer: Three.js r128 (já incluso no seu site via three-bg.js)
 * Coloque: <script src="pedro-3d.js"></script> APÓS o Three.js
 */
(function () {
  "use strict";

  /* ── Dados das tecnologias ── */
  const SKILLS = [
    { label: "HTML5",       color: 0xe34f26, geo: "octa",  size: 1.1  },
    { label: "CSS3",        color: 0x1572b6, geo: "icosa", size: 1.0  },
    { label: "JavaScript",  color: 0xf7df1e, geo: "cube",  size: 1.05 },
    { label: "React",       color: 0x61dafb, geo: "octa",  size: 0.95 },
    { label: "Node.js",     color: 0x339933, geo: "tetra", size: 1.0  },
    { label: "Python",      color: 0x3776ab, geo: "icosa", size: 1.05 },
    { label: "UI/UX",       color: 0xec4899, geo: "octa",  size: 0.9  },
    { label: "Three.js",    color: 0x8b5cf6, geo: "cube",  size: 1.1  },
    { label: "Git",         color: 0xf05032, geo: "tetra", size: 0.85 },
    { label: "SQL",         color: 0x00758f, geo: "icosa", size: 0.95 },
  ];

  /* ── Descrições para o tooltip (ao clicar) ── */
  const SKILL_INFO = {
    "HTML5":      "Estrutura semântica, acessível e moderna.",
    "CSS3":       "Animações, layouts Grid/Flex, design responsivo.",
    "JavaScript": "Lógica de front, APIs, interatividade completa.",
    "React":      "Componentes reutilizáveis, SPAs de alta performance.",
    "Node.js":    "Back-end robusto, APIs REST e tempo real.",
    "Python":     "Scripts, automações e lógica de servidor.",
    "UI/UX":      "Interfaces bonitas e experiências intuitivas.",
    "Three.js":   "Gráficos 3D no navegador, como este aqui! 🚀",
    "Git":        "Versionamento limpo, branches e deploys seguros.",
    "SQL":        "Bancos de dados relacionais, queries otimizadas.",
  };

  function init() {
    const wrap   = document.getElementById("dev3dWrap");
    const canvas = document.getElementById("dev3dCanvas");
    const overlay = document.getElementById("dev3dOverlay");
    const tooltip = document.getElementById("dev3dTooltip");

    if (!wrap || !canvas || typeof THREE === "undefined") return;

    const W = wrap.clientWidth;
    const H = wrap.clientHeight;

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x0a0a14, 1);

    /* ── Cena e câmera ── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 0, 14);

    /* ── Iluminação ── */
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const l1 = new THREE.PointLight(0x6366f1, 5, 40);
    l1.position.set(6, 8, 6); scene.add(l1);
    const l2 = new THREE.PointLight(0xa78bfa, 4, 35);
    l2.position.set(-7, -5, 4); scene.add(l2);
    const l3 = new THREE.PointLight(0x22d3ee, 3, 30);
    l3.position.set(0, 0, 10); scene.add(l3);

    /* ── Helpers de geometria ── */
    function makeGeo(type, s) {
      switch (type) {
        case "octa":  return new THREE.OctahedronGeometry(s, 0);
        case "icosa": return new THREE.IcosahedronGeometry(s, 0);
        case "tetra": return new THREE.TetrahedronGeometry(s, 0);
        default:      return new THREE.BoxGeometry(s * 1.4, s * 1.4, s * 1.4);
      }
    }

    /* ── Orb central ── */
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1, roughness: 0.0, metalness: 1.0,
      transparent: true, opacity: 0.75,
    });
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 2), orbMat);
    scene.add(orb);

    /* Anéis ao redor do orb */
    const ringGeo = new THREE.TorusGeometry(2.4, 0.045, 8, 64);
    const ring1 = new THREE.Mesh(ringGeo,
      new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.1, metalness: 0.9 }));
    const ring2 = ring1.clone();
    ring2.rotation.x = Math.PI / 2;
    scene.add(ring1); scene.add(ring2);

    /* ── Objetos de skill ── */
    const group   = new THREE.Group();
    const objects = [];
    const golden  = Math.PI * (3 - Math.sqrt(5));

    SKILLS.forEach((sk, i) => {
      const t   = i / SKILLS.length;
      const inc = Math.acos(1 - 2 * t);
      const az  = golden * i;
      const r   = 5.5;
      const x   = r * Math.sin(inc) * Math.cos(az);
      const y   = r * Math.cos(inc) * 0.7;
      const z   = r * Math.sin(inc) * Math.sin(az) - 1;

      const mesh = new THREE.Mesh(
        makeGeo(sk.geo, sk.size),
        new THREE.MeshStandardMaterial({
          color: sk.color, roughness: 0.08, metalness: 0.85,
          transparent: true, opacity: 0.88,
        })
      );
      mesh.position.set(x, y, z);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      group.add(mesh);

      /* Badge flutuante */
      const badge = document.createElement("div");
      badge.className = "d3-badge";
      badge.textContent = sk.label;
      const cr = (sk.color >> 16) & 255;
      const cg = (sk.color >> 8) & 255;
      const cb = sk.color & 255;
      badge.style.background    = `rgba(${cr},${cg},${cb},.28)`;
      badge.style.borderColor   = `rgba(${cr},${cg},${cb},.55)`;
      badge.style.display       = "none";
      overlay.appendChild(badge);

      objects.push({
        mesh,
        label: sk.label,
        badge,
        rotSpeed: new THREE.Vector3(
          (Math.random() - .5) * .012,
          (Math.random() - .5) * .015,
          (Math.random() - .5) * .008
        ),
        floatY:     Math.random() * Math.PI * 2,
        floatSpeed: 0.35 + Math.random() * .5,
        basePos:    new THREE.Vector3(x, y, z),
        hovered:    false,
      });
    });

    scene.add(group);

    /* ── Projeção 3D → 2D ── */
    function project(pos) {
      const v    = pos.clone().project(camera);
      const rect = canvas.getBoundingClientRect();
      return { x: (v.x * .5 + .5) * rect.width, y: (-.5 * v.y + .5) * rect.height };
    }

    /* ── Raycaster para hover / clique ── */
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2(-9, -9);
    let hoveredObj  = null;

    wrap.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    });

    let tooltipTimer = null;
    wrap.addEventListener("click", () => {
      if (!hoveredObj) return;
      const info = SKILL_INFO[hoveredObj.label] || "";
      tooltip.textContent = `${hoveredObj.label}: ${info}`;
      tooltip.classList.add("visible");
      clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(() => tooltip.classList.remove("visible"), 3000);
    });

    /* ── Arrastar para girar ── */
    let isDragging = false, prevX = 0, prevY = 0;
    let rotX = 0, rotY = 0, velX = 0, velY = 0;

    wrap.addEventListener("mousedown", (e) => {
      isDragging = true; prevX = e.clientX; prevY = e.clientY; velX = velY = 0;
    });
    window.addEventListener("mouseup", () => { isDragging = false; });
    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      velX = (e.clientX - prevX) * .005;
      velY = (e.clientY - prevY) * .005;
      rotY += velX; rotX += velY;
      prevX = e.clientX; prevY = e.clientY;
    });

    /* Touch */
    let tx = 0, ty = 0;
    wrap.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; });
    wrap.addEventListener("touchmove",  (e) => {
      velX = (e.touches[0].clientX - tx) * .005;
      velY = (e.touches[0].clientY - ty) * .005;
      rotY += velX; rotX += velY;
      tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    });

    /* Zoom com scroll */
    let zoom = 14;
    wrap.addEventListener("wheel", (e) => {
      zoom = Math.max(6, Math.min(22, zoom + e.deltaY * .02));
    });

    /* ── Resize ── */
    function onResize() {
      const nW = wrap.clientWidth, nH = wrap.clientHeight;
      renderer.setSize(nW, nH);
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);

    /* ── Loop de animação ── */
    let t = 0;
    function animate() {
      requestAnimationFrame(animate);
      t += 0.016;

      /* Inércia */
      if (!isDragging) { velX *= .92; velY *= .92; rotY += velX; rotX += velY; }
      group.rotation.y = rotY + t * .08;
      group.rotation.x = rotX;

      /* Orb */
      const pulse = 1 + Math.sin(t * 1.5) * .06;
      orb.scale.setScalar(pulse);
      orbMat.opacity = 0.6 + Math.sin(t * 1.5) * .12;
      ring1.rotation.z =  t * .3;
      ring2.rotation.y = -t * .25;

      /* Luzes orbitando */
      l1.position.x = Math.sin(t * .4) * 9;
      l1.position.z = Math.cos(t * .4) * 7;
      l2.position.x = Math.cos(t * .3) * 8;
      l2.position.z = Math.sin(t * .3) * 6;

      /* Zoom suave */
      camera.position.z += (zoom - camera.position.z) * .08;

      /* Hover via raycaster */
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(objects.map(o => o.mesh));
      hoveredObj = null;
      objects.forEach(o => { o.hovered = false; });
      if (hits.length) {
        const found = objects.find(o => o.mesh === hits[0].object);
        if (found) { found.hovered = true; hoveredObj = found; wrap.style.cursor = "pointer"; }
        else        { wrap.style.cursor = isDragging ? "grabbing" : "grab"; }
      } else {
        wrap.style.cursor = isDragging ? "grabbing" : "grab";
      }

      /* Float + badges */
      const wrapH = wrap.clientHeight;
      const wrapW = wrap.clientWidth;
      objects.forEach(o => {
        o.mesh.rotation.x += o.rotSpeed.x;
        o.mesh.rotation.y += o.rotSpeed.y;
        o.mesh.rotation.z += o.rotSpeed.z;
        o.mesh.position.y = o.basePos.y + Math.sin(t * o.floatSpeed + o.floatY) * .18;

        /* Escala no hover */
        const target = o.hovered ? 1.4 : 1.0;
        o.mesh.scale.lerp(new THREE.Vector3(target, target, target), .12);

        /* Posição do badge */
        const wp = o.mesh.getWorldPosition(new THREE.Vector3());
        const p  = project(wp);
        if (p.x > 0 && p.x < wrapW && p.y > 0 && p.y < wrapH) {
          o.badge.style.display = "block";
          o.badge.style.left    = (p.x - 32) + "px";
          o.badge.style.top     = (p.y + 18) + "px";
        } else {
          o.badge.style.display = "none";
        }
      });

      renderer.render(scene, camera);
    }

    animate();
  }

  /* Aguarda Three.js e DOM */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();