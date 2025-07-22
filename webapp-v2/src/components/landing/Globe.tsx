import { useEffect, useRef, useState } from 'preact/hooks';
import type { Scene, WebGLRenderer } from 'three';

export function Globe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Dynamically import Three.js for code splitting
    const initGlobe = async () => {
      try {
        const THREE = await import('three');
        
        if (!mounted || !containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Scene setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Camera setup
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 10;

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        rendererRef.current = renderer;
        container.appendChild(renderer.domElement);

        // Globe Group
        const globeGroup = new THREE.Group();
        scene.add(globeGroup);

        // Adjust sphere size based on screen size
        const isMobile = window.innerWidth < 768;
        const sphereSize = isMobile ? 4 : 5;
        const gridDensity = isMobile ? 24 : 32;

        // Base Sphere (Grid)
        const sphereGeometry = new THREE.SphereGeometry(sphereSize, gridDensity, gridDensity);
        const sphereMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          wireframe: true,
          transparent: true,
          opacity: 0.2
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        globeGroup.add(sphere);

        // Add some visual interest with particles
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = isMobile ? 200 : 500;
        const positions = new Float32Array(particlesCount * 3);

        for (let i = 0; i < particlesCount * 3; i++) {
          positions[i] = (Math.random() - 0.5) * 20;
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particlesMaterial = new THREE.PointsMaterial({
          color: 0x6a0dad,
          size: 0.1,
          transparent: true,
          opacity: 0.6
        });

        const particles = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particles);

        // Animation
        let isVisible = true;
        const visibilityObserver = new IntersectionObserver(
          ([entry]) => {
            isVisible = entry.isIntersecting;
          },
          { threshold: 0.1 }
        );
        
        if (container) {
          visibilityObserver.observe(container);
        }

        const animate = () => {
          if (!mounted || !isVisible) return;
          
          animationIdRef.current = requestAnimationFrame(animate);
          
          // Rotate globe
          globeGroup.rotation.y += 0.001;
          
          // Float particles
          particles.rotation.y += 0.0002;
          particles.rotation.x += 0.0001;
          
          renderer.render(scene, camera);
        };

        // Handle resize
        const handleResize = () => {
          if (!container || !renderer || !camera) return;
          
          const width = container.clientWidth;
          const height = container.clientHeight;
          
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          
          renderer.setSize(width, height);
        };

        window.addEventListener('resize', handleResize);

        // Handle visibility change to pause animation when not visible
        const handleVisibilityChange = () => {
          if (document.hidden && animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current);
          } else if (!document.hidden) {
            animate();
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Start animation
        setIsLoading(false);
        animate();

        // Cleanup
        return () => {
          mounted = false;
          
          window.removeEventListener('resize', handleResize);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          
          if (visibilityObserver) {
            visibilityObserver.disconnect();
          }
          
          if (animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current);
          }
          
          if (renderer) {
            renderer.dispose();
            container.removeChild(renderer.domElement);
          }
        };
      } catch (error) {
        console.error('Failed to initialize globe:', error);
        setHasError(true);
        setIsLoading(false);
      }
    };

    initGlobe();

    return () => {
      mounted = false;
    };
  }, []);

  if (hasError) {
    // Fallback for error state
    return (
      <div class="w-full h-full flex items-center justify-center">
        <div class="text-purple-200 text-center">
          <div class="w-32 h-32 mx-auto mb-4 rounded-full bg-purple-100/20"></div>
          <p>Unable to load 3D globe</p>
        </div>
      </div>
    );
  }

  return (
    <div id="globe-container" ref={containerRef} class="w-full h-full relative">
      {isLoading && (
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}