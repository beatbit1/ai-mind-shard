import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Solana-style animated wireframe mesh blob.
 * Pure monochrome (white wireframe on black).
 */
export function HeroMesh() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Icosahedron blob — high subdivisions for organic deformation
    const geometry = new THREE.IcosahedronGeometry(1.6, 32);
    const basePositions = geometry.attributes.position.array.slice() as Float32Array;

    // Wireframe overlay
    const wireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.22,
      }),
    );
    scene.add(wireframe);

    // Inner solid black mesh to occlude back wireframe
    const solid = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    );
    solid.scale.setScalar(0.985);
    scene.add(solid);

    // Particle dust around blob
    const particleCount = 600;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const r = 2.2 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      particlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = r * Math.cos(phi);
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.012,
        transparent: true,
        opacity: 0.6,
      }),
    );
    scene.add(particles);

    let raf = 0;
    const clock = new THREE.Clock();
    const positionAttr = geometry.attributes.position as THREE.BufferAttribute;

    const animate = () => {
      const t = clock.getElapsedTime();

      // Deform vertices with noise-ish trig
      for (let i = 0; i < basePositions.length; i += 3) {
        const x = basePositions[i];
        const y = basePositions[i + 1];
        const z = basePositions[i + 2];
        const n =
          Math.sin(x * 1.8 + t * 0.7) * 0.08 +
          Math.cos(y * 2.1 + t * 0.6) * 0.08 +
          Math.sin(z * 1.5 + t * 0.5) * 0.08;
        const scale = 1 + n;
        positionAttr.setXYZ(i / 3, x * scale, y * scale, z * scale);
      }
      positionAttr.needsUpdate = true;
      geometry.computeVertexNormals();

      // Rebuild wireframe geometry from deformed mesh
      wireframe.geometry.dispose();
      wireframe.geometry = new THREE.WireframeGeometry(geometry);

      scene.rotation.y = t * 0.15;
      scene.rotation.x = Math.sin(t * 0.2) * 0.1;
      particles.rotation.y = -t * 0.05;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      geometry.dispose();
      wireframe.geometry.dispose();
      particleGeo.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
