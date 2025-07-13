import * as THREE from 'three';
import { throttle } from './utils/event-utils.js';

export function initGlobe(): void {
    const container = document.getElementById('globe-container');
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true });

    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Globe Group
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Base Sphere (Grid)
    const sphereGeometry = new THREE.SphereGeometry(5, 32, 32); // Reduced grid lines
    const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.2
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    globeGroup.add(sphere);

    // Continent Outlines
    const textureLoader = new THREE.TextureLoader();
    const continentTexture = textureLoader.load('/images/world-map-outline.svg');

    const continentGeometry = new THREE.SphereGeometry(5.05, 64, 64); // Slightly larger sphere
    const continentMaterial = new THREE.MeshBasicMaterial({
        map: continentTexture,
        transparent: true,
        opacity: 1.0,
        wireframe: false
    });
    const continents = new THREE.Mesh(continentGeometry, continentMaterial);
    globeGroup.add(continents);

    camera.position.z = 10;

    function animate(): void {
        requestAnimationFrame(animate);
        globeGroup.rotation.y += 0.001;
        renderer.render(scene, camera);
    }

    animate();

    window.addEventListener('resize', throttle((): void => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }, 100));
}