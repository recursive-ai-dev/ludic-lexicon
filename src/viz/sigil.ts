import * as THREE from 'three';
import { SemanticEngine } from '../engine/nlp';


export class LexiconViz {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private nodes: THREE.Points;
  private nodeMaterial: THREE.PointsMaterial;
  private nodeGeometry: THREE.BufferGeometry;
  private animationFrameId: number | null = null;
  private positionCache = new Map<string, {x: number, y: number}>();
  private accentColor = new THREE.Color(0x8a7ab0);
  private dimColor = new THREE.Color(0x45455a);
  private tempColor = new THREE.Color();

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) || document.body;
    this.canvas = document.getElementById('viz-canvas') as HTMLCanvasElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060608);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.OrthographicCamera(-100 * aspect, 100 * aspect, 100, -100, 0.1, 1000);
    this.camera.position.z = 10;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.nodeGeometry = new THREE.BufferGeometry();
    this.nodeMaterial = new THREE.PointsMaterial({
      size: 4,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: false
    });

    this.nodes = new THREE.Points(this.nodeGeometry, this.nodeMaterial);
    this.scene.add(this.nodes);

    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  private onWindowResize() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.left = -100 * aspect;
    this.camera.right = 100 * aspect;
    this.camera.top = 100;
    this.camera.bottom = -100;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  update(engine: SemanticEngine) {
    const words = Array.from(engine.graph.keys());
    const count = words.length;
    if (count === 0) return;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    words.forEach((word, i) => {
        const node = engine.graph.get(word)!;

        let pos = this.positionCache.get(word);
        if (!pos) {
            // Use a stable hash for positions
            const hx = this.stableHash(word + 'x') % 200 - 100;
            const hy = this.stableHash(word + 'y') % 200 - 100;
            pos = { x: hx, y: hy };
            this.positionCache.set(word, pos);
        }

        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = 0;

        const rank = node.rank || 0;
        this.tempColor.copy(this.dimColor).lerp(this.accentColor, Math.min(1, rank * 10));
        const finalColor = this.tempColor;

        colors[i * 3] = finalColor.r;
        colors[i * 3 + 1] = finalColor.g;
        colors[i * 3 + 2] = finalColor.b;
    });

    this.nodeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.nodeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.nodeGeometry.attributes.position.needsUpdate = true;
    this.nodeGeometry.attributes.color.needsUpdate = true;
  }

  private stableHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
    return Math.abs(hash);
  }

  private animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    // Subtle rotation or drift
    this.nodes.rotation.z += 0.0002;

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.renderer.dispose();
  }
}
