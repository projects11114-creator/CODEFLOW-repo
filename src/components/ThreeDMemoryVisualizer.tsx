import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Power,
  Box,
  Compass,
  AlertTriangle,
  Cpu,
  Maximize2,
  Minimize2,
  Terminal,
  Activity,
  GitCompare,
  ArrowLeftRight,
  CheckCircle2,
  Play,
  Pause,
  StepForward,
  StepBack,
} from 'lucide-react';
import { ExecutionStep, VariableInfo, HeapObject } from '../engine/types.ts';

interface ThreeDMemoryVisualizerProps {
  currentStep: ExecutionStep | null;
  currentStepIndex: number;
  totalSteps: number;
  onTurnOff: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onStepForward?: () => void;
  onStepBackward?: () => void;
  canStepForward?: boolean;
  canStepBackward?: boolean;
  isPlaying?: boolean;
  onPauseResume?: () => void;
  onReset?: () => void;
}

type PlatformFocus = 'all' | 'memory' | 'logic' | 'output';

export const ThreeDMemoryVisualizer: React.FC<ThreeDMemoryVisualizerProps> = ({
  currentStep,
  currentStepIndex,
  totalSteps,
  onTurnOff,
  isMaximized: propIsMaximized,
  onToggleMaximize,
  onStepForward,
  onStepBackward,
  canStepForward,
  canStepBackward,
  isPlaying,
  onPauseResume,
  onReset,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const dynamicGroupRef = useRef<THREE.Group | null>(null);

  // Minimize / Maximize toggle state
  const [internalMaximized, setInternalMaximized] = useState(false);
  const isMaximized = propIsMaximized !== undefined ? propIsMaximized : internalMaximized;

  const handleToggleMaximize = () => {
    if (onToggleMaximize) {
      onToggleMaximize();
    } else {
      setInternalMaximized((prev) => !prev);
    }
  };

  // Keyboard shortcut: Escape key restores/minimizes the 3D window
  useEffect(() => {
    if (!isMaximized) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleToggleMaximize();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized, onToggleMaximize]);

  // Dispatch resize event when maximizing or minimizing to recalculate canvas dimensions
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
    return () => clearTimeout(timer);
  }, [isMaximized]);

  // Active view focus state
  const [platformFocus, setPlatformFocus] = useState<PlatformFocus>('all');

  // Camera Orbit State & Refs
  // Balanced isometric perspective framing all three platforms cleanly
  const [cameraTheta, setCameraTheta] = useState<number>(-0.32);
  const [cameraPhi, setCameraPhi] = useState<number>(0.58);
  const [cameraDistance, setCameraDistance] = useState<number>(23.5);

  const cameraThetaRef = useRef<number>(-0.32);
  const cameraPhiRef = useRef<number>(0.58);
  const cameraDistanceRef = useRef<number>(23.5);
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.0, 0));

  useEffect(() => {
    cameraThetaRef.current = cameraTheta;
  }, [cameraTheta]);
  useEffect(() => {
    cameraPhiRef.current = cameraPhi;
  }, [cameraPhi]);
  useEffect(() => {
    cameraDistanceRef.current = cameraDistance;
  }, [cameraDistance]);

  const isDraggingRef = useRef<boolean>(false);
  const activePointerIdRef = useRef<number | null>(null);
  const prevPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const hasReliableData = Boolean(
    currentStep &&
      currentStep.line > 0 &&
      (currentStep.variables !== undefined || currentStep.heap !== undefined)
  );

  // High-Resolution Crisp Text Sprites without opaque billboard card boxes
  const createValueSprite = (text: string, color: string = '#ffffff'): THREE.Sprite => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 128);
      // Soft clean text shadow for extreme contrast on dark backgrounds
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      ctx.fillStyle = color;
      ctx.font = 'bold 58px "JetBrains Mono", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.6, 0.8, 1);
    return sprite;
  };

  const createIndexSprite = (text: string, color: string = '#64748b'): THREE.Sprite => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 64);
      ctx.fillStyle = color;
      ctx.font = 'bold 32px "JetBrains Mono", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.9, 0.45, 1);
    return sprite;
  };

  const createPointerBadgeSprite = (
    label: string,
    bgColor: string,
    textColor: string = '#ffffff'
  ): THREE.Sprite => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 160, 80);
      // Compact sleek pointer pill
      ctx.fillStyle = bgColor;
      if (ctx.roundRect) {
        ctx.roundRect(14, 12, 132, 56, 14);
      } else {
        ctx.rect(14, 12, 132, 56);
      }
      ctx.fill();

      ctx.fillStyle = textColor;
      ctx.font = 'bold 36px "JetBrains Mono", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 80, 40);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.0, 0.5, 1);
    return sprite;
  };

  const createPlatformSurfaceLabel = (text: string, color: string): THREE.Sprite => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 512, 96);
      ctx.fillStyle = color;
      ctx.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 48);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.4, 0.65, 1);
    return sprite;
  };

  // Scene setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 360;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.replaceChildren(canvas);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xe0f2fe, 1.2);
    dirLight.position.set(16, 28, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Subtle colored point lights under each platform
    const p1Light = new THREE.PointLight(0x06b6d4, 1.5, 30);
    p1Light.position.set(-9.2, 7, 0);
    scene.add(p1Light);

    const p2Light = new THREE.PointLight(0xa855f7, 1.5, 30);
    p2Light.position.set(0, 7, 0);
    scene.add(p2Light);

    const p3Light = new THREE.PointLight(0x10b981, 1.5, 30);
    p3Light.position.set(9.2, 7, 0);
    scene.add(p3Light);

    // 5. Global Reference Grid
    const gridHelper = new THREE.GridHelper(44, 44, 0x0369a1, 0x0f172a);
    gridHelper.position.y = -0.25;
    scene.add(gridHelper);

    // 6. Dynamic Group
    const dynamicGroup = new THREE.Group();
    dynamicGroupRef.current = dynamicGroup;
    scene.add(dynamicGroup);

    // 7. Render Loop
    let isMounted = true;
    const animate = () => {
      if (!isMounted) return;
      animFrameIdRef.current = requestAnimationFrame(animate);

      const dist = cameraDistanceRef.current;
      const phi = cameraPhiRef.current;
      const theta = cameraThetaRef.current;
      const target = cameraTargetRef.current;

      const x = target.x + dist * Math.sin(phi) * Math.sin(theta);
      const y = target.y + dist * Math.cos(phi);
      const z = target.z + dist * Math.sin(phi) * Math.cos(theta);

      camera.position.set(x, y, z);
      camera.lookAt(target.x, target.y, target.z);

      renderer.render(scene, camera);
    };
    animate();

    // 8. Handle Resize
    let resizeRafId: number | null = null;
    let lastWidth = width;
    let lastHeight = height;

    const handleResize = () => {
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => {
        if (!isMounted || !container || !renderer || !camera) return;
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        if (newWidth <= 0 || newHeight <= 0) return;
        if (Math.abs(newWidth - lastWidth) < 1 && Math.abs(newHeight - lastHeight) < 1) return;
        lastWidth = newWidth;
        lastHeight = newHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight, false);
      });
    };

    const resizeObserver = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        if (!entries || !entries.length) return;
        handleResize();
      });
    });
    resizeObserver.observe(container);

    const handleWheelZoom = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.8 : -1.8;
      const newDist = Math.max(10, Math.min(42, cameraDistanceRef.current + delta));
      cameraDistanceRef.current = newDist;
      setCameraDistance(newDist);
    };
    container.addEventListener('wheel', handleWheelZoom, { passive: false });

    return () => {
      isMounted = false;
      container.removeEventListener('wheel', handleWheelZoom);
      resizeObserver.disconnect();
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      scene.clear();
    };
  }, []);

  // Update Dynamic 3D Scene when currentStep changes
  useEffect(() => {
    const dynamicGroup = dynamicGroupRef.current;
    if (!dynamicGroup || !hasReliableData || !currentStep) return;

    // Clean up previous geometries and materials
    while (dynamicGroup.children.length > 0) {
      const obj = dynamicGroup.children[0] as THREE.Mesh;
      if (obj.geometry) obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else if (obj.material) {
        obj.material.dispose();
      }
      dynamicGroup.remove(obj);
    }

    const variablesList: VariableInfo[] = Object.values(currentStep.variables || {});
    const heapObjects: HeapObject[] = currentStep.heap || [];
    const isProgramEnded = currentStep.actionType === 'program_end';

    // Algorithmic tracking pointers from variables
    const iVar = variablesList.find((v) => v.name === 'i');
    const jVar = variablesList.find((v) => v.name === 'j');
    const minVar = variablesList.find((v) => v.name === 'minIndex' || v.name === 'min');
    const lowVar = variablesList.find((v) => v.name === 'low');
    const highVar = variablesList.find((v) => v.name === 'high');
    const pivotVar = variablesList.find((v) => v.name === 'pivot');
    const piVar = variablesList.find((v) => v.name === 'pi');

    const activeI = typeof iVar?.value === 'number' ? iVar.value : undefined;
    const activeJ = typeof jVar?.value === 'number' ? jVar.value : undefined;
    const activeMin = typeof minVar?.value === 'number' ? minVar.value : undefined;
    const activeLow = typeof lowVar?.value === 'number' ? lowVar.value : undefined;
    const activeHigh = typeof highVar?.value === 'number' ? highVar.value : undefined;
    const activePivot = typeof pivotVar?.value === 'number' ? pivotVar.value : undefined;
    const activePi = typeof piVar?.value === 'number' ? piVar.value : undefined;

    // Merge Sort tracking pointers
    const lVar = variablesList.find((v) => v.name === 'l');
    const mVar = variablesList.find((v) => v.name === 'm');
    const rVar = variablesList.find((v) => v.name === 'r');
    const kVar = variablesList.find((v) => v.name === 'k');

    const activeL = typeof lVar?.value === 'number' ? lVar.value : undefined;
    const activeM = typeof mVar?.value === 'number' ? mVar.value : undefined;
    const activeR = typeof rVar?.value === 'number' ? rVar.value : undefined;
    const activeK = typeof kVar?.value === 'number' ? kVar.value : undefined;

    // Detect algorithmic modes
    const isQuickSortMode = activeHigh !== undefined || activePivot !== undefined || activePi !== undefined;
    const isMergeSortMode = activeL !== undefined && activeR !== undefined;
    const pivotIndex = activeHigh !== undefined ? activeHigh : activePi;

    // Active swapping or comparison state from heap
    const mainArr = heapObjects.find((o) => o.name === 'arr') || heapObjects.find((o) => o.elements && o.elements.length > 0);
    const swappingIndices = mainArr?.swappingIndices;
    const comparedIndices = mainArr?.comparedIndices;

    // =========================================================================
    // PLATFORM COORDINATE CONSTANTS (Harmonious compact composition)
    // =========================================================================
    const P1_X = -9.2; // Platform 1: Memory & Variables
    const P2_X = 0.0;  // Platform 2: Logic & Execution
    const P3_X = 9.2;  // Platform 3: Output & Result
    const PLATFORM_Y = -0.2;
    const PLATFORM_WIDTH = 8.4;
    const PLATFORM_DEPTH = 7.6;
    const PLATFORM_THICKNESS = 0.35;

    // Inter-Platform glowing data conduits
    const conduit1Geom = new THREE.CylinderGeometry(0.06, 0.06, 8.4, 16);
    const conduit1Mat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const conduit1Mesh = new THREE.Mesh(conduit1Geom, conduit1Mat);
    conduit1Mesh.rotation.z = Math.PI / 2;
    conduit1Mesh.position.set(-4.6, PLATFORM_Y, 0);
    dynamicGroup.add(conduit1Mesh);

    const conduit2Geom = new THREE.CylinderGeometry(0.06, 0.06, 8.4, 16);
    const conduit2Mat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const conduit2Mesh = new THREE.Mesh(conduit2Geom, conduit2Mat);
    conduit2Mesh.rotation.z = Math.PI / 2;
    conduit2Mesh.position.set(4.6, PLATFORM_Y, 0);
    dynamicGroup.add(conduit2Mesh);

    // =========================================================================
    // PLATFORM 1: MEMORY & ARRAY BLOCKS
    // =========================================================================
    const p1Geom = new THREE.BoxGeometry(PLATFORM_WIDTH, PLATFORM_THICKNESS, PLATFORM_DEPTH);
    const p1Mat = new THREE.MeshStandardMaterial({
      color: 0x081326,
      roughness: 0.35,
      metalness: 0.6,
    });
    const p1Mesh = new THREE.Mesh(p1Geom, p1Mat);
    p1Mesh.position.set(P1_X, PLATFORM_Y, 0);
    dynamicGroup.add(p1Mesh);

    const p1Wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(p1Geom),
      new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2 })
    );
    p1Wire.position.copy(p1Mesh.position);
    dynamicGroup.add(p1Wire);

    // Clean platform surface tag attached flush to platform front
    const p1Label = createPlatformSurfaceLabel('1. MEMORY PLATFORM', '#38bdf8');
    p1Label.position.set(P1_X, PLATFORM_Y + PLATFORM_THICKNESS / 2 + 0.12, PLATFORM_DEPTH / 2 - 0.45);
    dynamicGroup.add(p1Label);

    // Render Array Blocks on Platform 1
    if (mainArr && mainArr.elements && mainArr.elements.length > 0) {
      const elems = mainArr.elements.slice(0, 20);
      const cellW = Math.max(0.48, Math.min(1.2, 7.2 / elems.length));
      const cellSpacing = cellW + Math.max(0.12, 0.28 * (6 / Math.max(elems.length, 1)));
      const totalW = elems.length * cellSpacing;
      const startX = P1_X - totalW / 2 + cellSpacing / 2;
      const az = 0.2;

      const numericValues = elems
        .map((e) => (typeof e === 'number' ? e : parseFloat(String(e))))
        .filter((n) => !isNaN(n));
      const isNumeric = numericValues.length === elems.length && elems.length > 0;
      const minVal = isNumeric ? Math.min(...numericValues) : 0;
      const maxVal = isNumeric ? Math.max(...numericValues) : 10;

      elems.forEach((elemVal, eIdx) => {
        const ex = startX + eIdx * cellSpacing;

        const isSwapping =
          swappingIndices && (swappingIndices[0] === eIdx || swappingIndices[1] === eIdx);
        const isCompared =
          comparedIndices && (comparedIndices[0] === eIdx || comparedIndices[1] === eIdx);
        const isCurrentActive = currentStep.activeArrayIndex === eIdx;
        const isMin = activeMin === eIdx;
        const isJ = activeJ === eIdx;
        const isI = activeI === eIdx;

        // Quick Sort & Merge Sort highlighting
        const isPivot = isQuickSortMode && pivotIndex === eIdx && !isProgramEnded;
        const isMergeActive = isMergeSortMode && activeK === eIdx && !isProgramEnded;
        const isLeftSubarray = isMergeSortMode && activeL !== undefined && activeM !== undefined && eIdx >= activeL && eIdx <= activeM && !isProgramEnded;
        const isRightSubarray = isMergeSortMode && activeM !== undefined && activeR !== undefined && eIdx > activeM && eIdx <= activeR && !isProgramEnded;
        const isOutOfSubarray = isMergeSortMode && activeL !== undefined && activeR !== undefined && (eIdx < activeL || eIdx > activeR);

        let barHeight = 2.0;
        if (isNumeric && maxVal > minVal) {
          const norm = (Number(elemVal) - minVal) / (maxVal - minVal);
          barHeight = 1.0 + norm * 2.8;
        }

        // Elevated height during swap, merge write, pivot, or comparison
        const cellY = isSwapping
          ? PLATFORM_Y + PLATFORM_THICKNESS / 2 + barHeight / 2 + 1.2
          : isMergeActive
          ? PLATFORM_Y + PLATFORM_THICKNESS / 2 + barHeight / 2 + 0.45
          : isPivot
          ? PLATFORM_Y + PLATFORM_THICKNESS / 2 + barHeight / 2 + 0.35
          : isCompared
          ? PLATFORM_Y + PLATFORM_THICKNESS / 2 + barHeight / 2 + 0.25
          : PLATFORM_Y + PLATFORM_THICKNESS / 2 + barHeight / 2;

        // Visual colors
        let blockColor = 0x1d4ed8; // Dark blue default
        let emissiveColor = 0x000000;
        let emissiveInt = 0;

        if (isProgramEnded) {
          blockColor = 0x10b981; // Green when sorted
          emissiveColor = 0x059669;
          emissiveInt = 0.55;
        } else if (isSwapping) {
          blockColor = 0xf59e0b; // Gold on swap
          emissiveColor = 0xd97706;
          emissiveInt = 0.8;
        } else if (isMergeActive) {
          blockColor = 0x10b981; // Emerald when merging into arr[k]
          emissiveColor = 0x059669;
          emissiveInt = 0.8;
        } else if (isPivot) {
          blockColor = 0xf97316; // Radiant Orange for Quick Sort Pivot
          emissiveColor = 0xea580c;
          emissiveInt = 0.8;
        } else if (isMin) {
          blockColor = 0xeab308; // Yellow/amber for minIndex
          emissiveColor = 0xca8a04;
          emissiveInt = 0.65;
        } else if (isCompared || isJ) {
          blockColor = 0x8b5cf6; // Purple for comparison
          emissiveColor = 0x7c3aed;
          emissiveInt = 0.65;
        } else if (isLeftSubarray) {
          blockColor = 0x0284c7; // Deep sky blue for Merge Sort Left Split
          emissiveColor = 0x0369a1;
          emissiveInt = 0.45;
        } else if (isRightSubarray) {
          blockColor = 0x7c3aed; // Deep violet for Merge Sort Right Split
          emissiveColor = 0x6d28d9;
          emissiveInt = 0.45;
        } else if (isI || isCurrentActive) {
          blockColor = 0x06b6d4; // Cyan for current loop/pointer index
          emissiveColor = 0x0891b2;
          emissiveInt = 0.5;
        } else if (isOutOfSubarray) {
          blockColor = 0x0f172a; // Dimmed outside active subarray split
          emissiveInt = 0;
        }

        // 3D Cuboid Block
        const elemGeom = new THREE.BoxGeometry(cellW, barHeight, 1.3);
        const elemMat = new THREE.MeshStandardMaterial({
          color: blockColor,
          roughness: 0.25,
          metalness: 0.55,
          emissive: emissiveColor,
          emissiveIntensity: emissiveInt,
        });
        const elemMesh = new THREE.Mesh(elemGeom, elemMat);
        elemMesh.position.set(ex, cellY, az);
        dynamicGroup.add(elemMesh);

        // Crisp edge highlight
        const wireMat = new THREE.LineBasicMaterial({
          color: isProgramEnded
            ? 0x6ee7b7
            : isSwapping
            ? 0xfef08a
            : isMergeActive
            ? 0x6ee7b7
            : isPivot
            ? 0xfdba74
            : isMin
            ? 0xfde047
            : isCompared
            ? 0xd8b4fe
            : isLeftSubarray
            ? 0x38bdf8
            : isRightSubarray
            ? 0xc084fc
            : 0x38bdf8,
          linewidth: 2,
        });
        const wireMesh = new THREE.LineSegments(new THREE.EdgesGeometry(elemGeom), wireMat);
        wireMesh.position.copy(elemMesh.position);
        dynamicGroup.add(wireMesh);

        // Large, clear, readable number directly on or immediately above the block
        const valColor = isProgramEnded
          ? '#6ee7b7'
          : isSwapping
          ? '#fef08a'
          : isMergeActive
          ? '#a7f3d0'
          : isPivot
          ? '#ffedd5'
          : isMin
          ? '#fde047'
          : isCompared
          ? '#e9d5ff'
          : '#ffffff';
        const valSprite = createValueSprite(String(elemVal), valColor);
        valSprite.position.set(ex, cellY + barHeight / 2 + 0.45, az);
        dynamicGroup.add(valSprite);

        // Small, unobtrusive index label at base
        const idxSprite = createIndexSprite(
          `[${eIdx}]`,
          isPivot ? '#fb923c' : isMergeActive ? '#34d399' : isMin ? '#facc15' : isCompared ? '#c084fc' : '#64748b'
        );
        idxSprite.position.set(ex, PLATFORM_Y + 0.25, az + 0.95);
        dynamicGroup.add(idxSprite);

        // Sleek pointer badges floating cleanly above column
        if (!isProgramEnded) {
          if (isPivot) {
            const pivotBadge = createPointerBadgeSprite('PIVOT', '#9a3412', '#ffedd5');
            pivotBadge.position.set(ex, cellY + barHeight / 2 + 1.15, az);
            dynamicGroup.add(pivotBadge);
          } else if (isMergeActive) {
            const mergeBadge = createPointerBadgeSprite('k (merge)', '#065f46', '#a7f3d0');
            mergeBadge.position.set(ex, cellY + barHeight / 2 + 1.15, az);
            dynamicGroup.add(mergeBadge);
          } else if (isMin) {
            const minBadge = createPointerBadgeSprite('min', '#b45309', '#fef08a');
            minBadge.position.set(ex, cellY + barHeight / 2 + 1.15, az);
            dynamicGroup.add(minBadge);
          } else if (isJ) {
            const jBadge = createPointerBadgeSprite('j', '#6d28d9', '#f3e8ff');
            jBadge.position.set(ex, cellY + barHeight / 2 + 1.15, az);
            dynamicGroup.add(jBadge);
          } else if (isI) {
            const iBadge = createPointerBadgeSprite('i', '#0e7490', '#cffafe');
            iBadge.position.set(ex, cellY + barHeight / 2 + 1.15, az);
            dynamicGroup.add(iBadge);
          } else if (isMergeSortMode && eIdx === activeL) {
            const lBadge = createPointerBadgeSprite('Left: l', '#075985', '#e0f2fe');
            lBadge.position.set(ex, cellY + barHeight / 2 + 1.15, az);
            dynamicGroup.add(lBadge);
          } else if (isMergeSortMode && activeM !== undefined && eIdx === activeM + 1) {
            const rBadge = createPointerBadgeSprite('Right', '#5b21b6', '#ede9fe');
            rBadge.position.set(ex, cellY + barHeight / 2 + 1.15, az);
            dynamicGroup.add(rBadge);
          }
        }
      });
    } else {
      // Non-array standalone variables on Platform 1
      const visibleVars = variablesList.slice(0, 6);
      visibleVars.forEach((v, idx) => {
        const vx = P1_X - 1.8 + (idx % 2) * 3.6;
        const vz = -1.5 + Math.floor(idx / 2) * 1.8;
        const isActive = currentStep.activeVariableKey === v.name;

        const cellGeom = new THREE.BoxGeometry(2.4, 0.6, 1.2);
        const cellMat = new THREE.MeshStandardMaterial({
          color: isActive ? 0x0284c7 : 0x0f172a,
          roughness: 0.3,
          metalness: 0.5,
          emissive: isActive ? 0x0369a1 : 0x000000,
          emissiveIntensity: isActive ? 0.6 : 0,
        });
        const cellMesh = new THREE.Mesh(cellGeom, cellMat);
        cellMesh.position.set(vx, PLATFORM_Y + 0.45, vz);
        dynamicGroup.add(cellMesh);

        // Variable Name & Value directly on pedestal
        const vSprite = createValueSprite(`${v.name}: ${v.value}`, isActive ? '#38bdf8' : '#e2e8f0');
        vSprite.scale.set(2.2, 0.7, 1);
        vSprite.position.set(vx, PLATFORM_Y + 1.05, vz);
        dynamicGroup.add(vSprite);
      });
    }

    // =========================================================================
    // PLATFORM 2: LOGIC & ALGORITHMIC EXECUTION CORE
    // =========================================================================
    const p2Geom = new THREE.BoxGeometry(PLATFORM_WIDTH, PLATFORM_THICKNESS, PLATFORM_DEPTH);
    const p2Mat = new THREE.MeshStandardMaterial({
      color: 0x140a24,
      roughness: 0.35,
      metalness: 0.6,
    });
    const p2Mesh = new THREE.Mesh(p2Geom, p2Mat);
    p2Mesh.position.set(P2_X, PLATFORM_Y, 0);
    dynamicGroup.add(p2Mesh);

    const p2Wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(p2Geom),
      new THREE.LineBasicMaterial({ color: 0x9333ea, linewidth: 2 })
    );
    p2Wire.position.copy(p2Mesh.position);
    dynamicGroup.add(p2Wire);

    // Platform surface tag
    const p2Label = createPlatformSurfaceLabel('2. LOGIC PLATFORM', '#c084fc');
    p2Label.position.set(P2_X, PLATFORM_Y + PLATFORM_THICKNESS / 2 + 0.12, PLATFORM_DEPTH / 2 - 0.45);
    dynamicGroup.add(p2Label);

    // Physical Algorithm Indicators on Platform 2 (No large billboards!)
    if (swappingIndices) {
      // Golden Swap Arch / Gateway
      const archGeom = new THREE.TorusGeometry(1.6, 0.12, 16, 32, Math.PI);
      const archMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.8,
        metalness: 0.7,
      });
      const arch = new THREE.Mesh(archGeom, archMat);
      arch.position.set(P2_X, PLATFORM_Y + 0.4, 0);
      arch.rotation.z = Math.PI;
      dynamicGroup.add(arch);

      // Center Swap Core Crystal
      const swapCrystalGeom = new THREE.OctahedronGeometry(0.7, 0);
      const swapCrystalMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xb45309,
        emissiveIntensity: 0.7,
      });
      const swapCrystal = new THREE.Mesh(swapCrystalGeom, swapCrystalMat);
      swapCrystal.position.set(P2_X, PLATFORM_Y + 1.8, 0);
      dynamicGroup.add(swapCrystal);
    } else if (comparedIndices) {
      // Dual Comparison Holographic Crystals
      const c1Geom = new THREE.OctahedronGeometry(0.65, 0);
      const c1Mat = new THREE.MeshStandardMaterial({
        color: 0x8b5cf6,
        emissive: 0x7c3aed,
        emissiveIntensity: 0.7,
      });
      const c1 = new THREE.Mesh(c1Geom, c1Mat);
      c1.position.set(P2_X - 1.4, PLATFORM_Y + 1.4, 0);
      dynamicGroup.add(c1);

      const c2 = new THREE.Mesh(c1Geom, c1Mat);
      c2.position.set(P2_X + 1.4, PLATFORM_Y + 1.4, 0);
      dynamicGroup.add(c2);

      // Connecting Comparison Beam
      const beamGeom = new THREE.CylinderGeometry(0.06, 0.06, 2.8, 16);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });
      const beam = new THREE.Mesh(beamGeom, beamMat);
      beam.rotation.z = Math.PI / 2;
      beam.position.set(P2_X, PLATFORM_Y + 1.4, 0);
      dynamicGroup.add(beam);
    } else if (currentStep.loopState) {
      // Loop Orbit Ring
      const torusGeom = new THREE.TorusGeometry(1.2, 0.1, 16, 32);
      const torusMat = new THREE.MeshStandardMaterial({
        color: currentStep.loopState.willContinue ? 0x06b6d4 : 0xf43f5e,
        emissive: currentStep.loopState.willContinue ? 0x0891b2 : 0xe11d48,
        emissiveIntensity: 0.6,
      });
      const torus = new THREE.Mesh(torusGeom, torusMat);
      torus.rotation.x = Math.PI / 3;
      torus.position.set(P2_X, PLATFORM_Y + 1.3, 0);
      dynamicGroup.add(torus);
    } else {
      // Sleek resting central core prism
      const coreGeom = new THREE.OctahedronGeometry(0.6, 0);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        emissive: 0x4f46e5,
        emissiveIntensity: 0.45,
      });
      const core = new THREE.Mesh(coreGeom, coreMat);
      core.position.set(P2_X, PLATFORM_Y + 1.2, 0);
      dynamicGroup.add(core);
    }

    // =========================================================================
    // PLATFORM 3: OUTPUT & RESULT ARRAY
    // =========================================================================
    const p3Geom = new THREE.BoxGeometry(PLATFORM_WIDTH, PLATFORM_THICKNESS, PLATFORM_DEPTH);
    const p3Mat = new THREE.MeshStandardMaterial({
      color: 0x041913,
      roughness: 0.35,
      metalness: 0.6,
    });
    const p3Mesh = new THREE.Mesh(p3Geom, p3Mat);
    p3Mesh.position.set(P3_X, PLATFORM_Y, 0);
    dynamicGroup.add(p3Mesh);

    const p3Wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(p3Geom),
      new THREE.LineBasicMaterial({ color: 0x059669, linewidth: 2 })
    );
    p3Wire.position.copy(p3Mesh.position);
    dynamicGroup.add(p3Wire);

    // Platform surface tag
    const p3Label = createPlatformSurfaceLabel('3. OUTPUT PLATFORM', '#34d399');
    p3Label.position.set(P3_X, PLATFORM_Y + PLATFORM_THICKNESS / 2 + 0.12, PLATFORM_DEPTH / 2 - 0.45);
    dynamicGroup.add(p3Label);

    // Physical Array Blocks on Platform 3 (Real Result State)
    if (mainArr && mainArr.elements && mainArr.elements.length > 0) {
      const resElems = mainArr.elements.slice(0, 10);
      const rCellW = Math.max(0.85, Math.min(1.2, 5.8 / resElems.length));
      const rSpacing = rCellW + 0.3;
      const rTotalW = resElems.length * rSpacing;
      const rStartX = P3_X - rTotalW / 2 + rSpacing / 2;

      const rNumeric = resElems
        .map((e) => (typeof e === 'number' ? e : parseFloat(String(e))))
        .filter((n) => !isNaN(n));
      const rMin = rNumeric.length > 0 ? Math.min(...rNumeric) : 0;
      const rMax = rNumeric.length > 0 ? Math.max(...rNumeric) : 10;

      resElems.forEach((rVal, rIdx) => {
        const rx = rStartX + rIdx * rSpacing;
        let rHeight = 1.6;
        if (rNumeric.length > 0 && rMax > rMin) {
          const norm = (Number(rVal) - rMin) / (rMax - rMin);
          rHeight = 1.1 + norm * 2.8;
        }

        const ry = PLATFORM_Y + PLATFORM_THICKNESS / 2 + rHeight / 2;

        const rGeom = new THREE.BoxGeometry(rCellW, rHeight, 1.3);
        const rMat = new THREE.MeshStandardMaterial({
          color: isProgramEnded ? 0x10b981 : 0x065f46,
          roughness: 0.25,
          metalness: 0.55,
          emissive: isProgramEnded ? 0x059669 : 0x047857,
          emissiveIntensity: isProgramEnded ? 0.65 : 0.35,
        });
        const rMesh = new THREE.Mesh(rGeom, rMat);
        rMesh.position.set(rx, ry, 0.2);
        dynamicGroup.add(rMesh);

        const rWireMesh = new THREE.LineSegments(
          new THREE.EdgesGeometry(rGeom),
          new THREE.LineBasicMaterial({
            color: isProgramEnded ? 0x6ee7b7 : 0x10b981,
            linewidth: 2,
          })
        );
        rWireMesh.position.copy(rMesh.position);
        dynamicGroup.add(rWireMesh);

        // Readable value directly above the block
        const valSprite = createValueSprite(String(rVal), isProgramEnded ? '#a7f3d0' : '#ffffff');
        valSprite.position.set(rx, ry + rHeight / 2 + 0.45, 0.2);
        dynamicGroup.add(valSprite);

        // Index at base
        const idxSprite = createIndexSprite(`[${rIdx}]`, '#34d399');
        idxSprite.position.set(rx, PLATFORM_Y + 0.25, 1.15);
        dynamicGroup.add(idxSprite);
      });
    }

    // Subtle beacon crystal on Platform 3
    const statusBeaconGeom = new THREE.CylinderGeometry(0.3, 0.4, 0.6, 16);
    const statusColor = currentStep.exceptionInfo
      ? 0xf43f5e
      : isProgramEnded
      ? 0x10b981
      : 0x06b6d4;
    const statusBeaconMat = new THREE.MeshStandardMaterial({
      color: statusColor,
      emissive: statusColor,
      emissiveIntensity: 0.6,
      metalness: 0.5,
    });
    const statusBeacon = new THREE.Mesh(statusBeaconGeom, statusBeaconMat);
    statusBeacon.position.set(P3_X, PLATFORM_Y + 0.4, -2.5);
    dynamicGroup.add(statusBeacon);
  }, [currentStep, hasReliableData, currentStepIndex, totalSteps]);

  // Pointer Orbit Controls
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isDraggingRef.current = true;
    activePointerIdRef.current = e.pointerId;
    prevPosRef.current = { x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Fallback
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || activePointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - prevPosRef.current.x;
    const dy = e.clientY - prevPosRef.current.y;
    prevPosRef.current = { x: e.clientX, y: e.clientY };

    const newTheta = cameraThetaRef.current - dx * 0.007;
    const newPhi = Math.max(0.12, Math.min(Math.PI / 2 - 0.04, cameraPhiRef.current + dy * 0.007));

    cameraThetaRef.current = newTheta;
    cameraPhiRef.current = newPhi;
    setCameraTheta(newTheta);
    setCameraPhi(newPhi);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current === e.pointerId) {
      isDraggingRef.current = false;
      activePointerIdRef.current = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current === e.pointerId) {
      isDraggingRef.current = false;
      activePointerIdRef.current = null;
    }
  };

  // Focus View Switchers
  const handleFocus = (focus: PlatformFocus) => {
    setPlatformFocus(focus);
    if (focus === 'all') {
      cameraTargetRef.current.set(0, 1.0, 0);
      cameraDistanceRef.current = 23.5;
      cameraThetaRef.current = -0.32;
      cameraPhiRef.current = 0.58;
      setCameraDistance(23.5);
      setCameraTheta(-0.32);
      setCameraPhi(0.58);
    } else if (focus === 'memory') {
      cameraTargetRef.current.set(-9.2, 1.2, 0);
      cameraDistanceRef.current = 13.5;
      cameraThetaRef.current = -0.35;
      cameraPhiRef.current = 0.56;
      setCameraDistance(13.5);
      setCameraTheta(-0.35);
      setCameraPhi(0.56);
    } else if (focus === 'logic') {
      cameraTargetRef.current.set(0, 1.2, 0);
      cameraDistanceRef.current = 12.5;
      cameraThetaRef.current = -0.08;
      cameraPhiRef.current = 0.56;
      setCameraDistance(12.5);
      setCameraTheta(-0.08);
      setCameraPhi(0.56);
    } else if (focus === 'output') {
      cameraTargetRef.current.set(9.2, 1.2, 0);
      cameraDistanceRef.current = 13.5;
      cameraThetaRef.current = 0.25;
      cameraPhiRef.current = 0.56;
      setCameraDistance(13.5);
      setCameraTheta(0.25);
      setCameraPhi(0.56);
    }
  };

  const handleResetCamera = () => {
    handleFocus('all');
  };

  const handleZoomIn = () => {
    const newDist = Math.max(10, cameraDistanceRef.current - 2.5);
    cameraDistanceRef.current = newDist;
    setCameraDistance(newDist);
  };

  const handleZoomOut = () => {
    const newDist = Math.min(42, cameraDistanceRef.current + 2.5);
    cameraDistanceRef.current = newDist;
    setCameraDistance(newDist);
  };

  // Compute compact algorithmic state text for the clean HUD overlay
  const hudActionInfo = useMemo(() => {
    if (!currentStep) return null;
    const isEnd = currentStep.actionType === 'program_end';
    const mainA = currentStep.heap?.find((o) => o.elements && o.elements.length > 0);
    const swap = mainA?.swappingIndices;
    const comp = mainA?.comparedIndices;

    if (isEnd) {
      const elemsStr = mainA?.elements ? `[${mainA.elements.join(', ')}]` : '';
      return {
        type: 'completed',
        label: `Sorted! Final array: ${elemsStr}`,
        icon: 'check',
      };
    }
    if (swap) {
      const v1 = mainA?.elements?.[swap[0]];
      const v2 = mainA?.elements?.[swap[1]];
      return {
        type: 'swap',
        label: `Swap: a[${swap[0]}] (${v1}) ↔ a[${swap[1]}] (${v2})`,
        icon: 'swap',
      };
    }
    if (comp) {
      const v1 = mainA?.elements?.[comp[0]];
      const v2 = mainA?.elements?.[comp[1]];
      return {
        type: 'compare',
        label: `Compare: a[${comp[0]}] (${v1}) vs a[${comp[1]}] (${v2})`,
        icon: 'compare',
      };
    }
    if (currentStep.branchDecision) {
      return {
        type: 'branch',
        label: `${currentStep.branchDecision.condition} → ${currentStep.branchDecision.result ? 'TRUE' : 'FALSE'}`,
        icon: 'activity',
      };
    }
    return {
      type: 'step',
      label: currentStep.description,
      icon: 'activity',
    };
  }, [currentStep]);

  if (!hasReliableData || !currentStep) {
    return (
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg text-slate-300 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>3D visualization unavailable for this step</span>
          </div>
          <button
            onClick={onTurnOff}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors cursor-pointer"
          >
            <Power className="w-3 h-3 text-slate-400" />
            <span>Turn 3D OFF</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          The execution trace does not contain complete local memory state for this line.
          The standard 2D view below remains active.
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        isMaximized
          ? 'fixed inset-0 z-50 w-screen h-screen bg-[#050811] overflow-hidden select-none flex flex-col shadow-2xl'
          : 'relative w-full rounded-lg bg-[#060913] border border-cyan-900/70 overflow-hidden shadow-2xl select-none group'
      }
    >
      {/* 3D Scene Top HUD Overlay */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none flex-wrap gap-2">
        {/* Capability and Synchronization Indicator */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-800 text-[11px] text-slate-300 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold text-cyan-300">3-Platform 3D Engine</span>
          <span className="text-slate-500 font-mono text-[10px]">
            [Step {currentStepIndex + 1}/{totalSteps} • Line {currentStep.line}]
          </span>
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-mono">
            Synced
          </span>
        </div>

        {/* Platform Quick Focus View Selector */}
        <div className="pointer-events-auto flex items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1 rounded-md border border-slate-800 text-[10px]">
          <button
            onClick={() => handleFocus('all')}
            className={`px-2 py-0.5 rounded transition-colors font-medium flex items-center gap-1 cursor-pointer ${
              platformFocus === 'all'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Maximize2 className="w-2.5 h-2.5" />
            <span>Overview</span>
          </button>
          <button
            onClick={() => handleFocus('memory')}
            className={`px-2 py-0.5 rounded transition-colors font-medium flex items-center gap-1 cursor-pointer ${
              platformFocus === 'memory'
                ? 'bg-blue-950 text-blue-300 border border-blue-700/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Box className="w-2.5 h-2.5 text-blue-400" />
            <span>P1: Memory</span>
          </button>
          <button
            onClick={() => handleFocus('logic')}
            className={`px-2 py-0.5 rounded transition-colors font-medium flex items-center gap-1 cursor-pointer ${
              platformFocus === 'logic'
                ? 'bg-purple-950 text-purple-300 border border-purple-700/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Cpu className="w-2.5 h-2.5 text-purple-400" />
            <span>P2: Logic</span>
          </button>
          <button
            onClick={() => handleFocus('output')}
            className={`px-2 py-0.5 rounded transition-colors font-medium flex items-center gap-1 cursor-pointer ${
              platformFocus === 'output'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-2.5 h-2.5 text-emerald-400" />
            <span>P3: Output</span>
          </button>
        </div>

        {/* 3D Orbit Camera Controls & Top Right Minimize/Maximize */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md p-1 rounded-md border border-slate-800 shadow-sm">
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetCamera}
            title="Reset 3D Camera Orbit"
            className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <div className="h-3 w-px bg-slate-800" />
          {/* Quick Turn Off Button */}
          <button
            onClick={onTurnOff}
            title="Turn 3D Visualization OFF"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-slate-700/60 hover:border-rose-800 text-[10px] font-medium transition-colors cursor-pointer"
          >
            <Power className="w-2.5 h-2.5 text-rose-400" />
            <span>Turn OFF</span>
          </button>
          <div className="h-3 w-px bg-slate-800" />
          {/* Top Right Minimize / Maximize Toggle Button */}
          <button
            onClick={handleToggleMaximize}
            title={isMaximized ? 'Minimize 3D Window (Esc to restore)' : 'Maximize 3D Window to Full Screen'}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded border text-[10px] font-medium transition-all cursor-pointer shadow-sm ${
              isMaximized
                ? 'bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border-cyan-500/80 ring-1 ring-cyan-500/40 shadow-sm shadow-cyan-950/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700/70'
            }`}
          >
            {isMaximized ? (
              <>
                <Minimize2 className="w-3 h-3 text-cyan-400" />
                <span>Minimize</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3 text-cyan-400" />
                <span>Maximize</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Clean Algorithmic HUD Overlay (Replaces giant 3D billboards) */}
      {hudActionInfo && (
        <div className="absolute top-11 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div
            className={`px-3 py-1 rounded-full backdrop-blur-md border text-xs font-mono font-semibold shadow-lg flex items-center gap-2 ${
              hudActionInfo.type === 'completed'
                ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-300'
                : hudActionInfo.type === 'swap'
                ? 'bg-amber-950/90 border-amber-500/70 text-amber-300'
                : hudActionInfo.type === 'compare'
                ? 'bg-purple-950/90 border-purple-500/70 text-purple-300'
                : 'bg-slate-900/90 border-slate-700/70 text-slate-300'
            }`}
          >
            {hudActionInfo.icon === 'check' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            {hudActionInfo.icon === 'swap' && <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />}
            {hudActionInfo.icon === 'compare' && <GitCompare className="w-3.5 h-3.5 text-purple-400" />}
            {hudActionInfo.icon === 'activity' && <Activity className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{hudActionInfo.label}</span>
          </div>
        </div>
      )}

      {/* Main Interactive Three.js Mount Canvas */}
      <div
        ref={mountRef}
        className={
          isMaximized
            ? 'w-full h-full flex-1 cursor-grab active:cursor-grabbing touch-none select-none'
            : 'w-full h-[320px] sm:h-[360px] md:h-[400px] cursor-grab active:cursor-grabbing touch-none select-none'
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {/* 3D Scene Bottom Legend & Controls Overlay */}
      <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between text-[10px] pointer-events-none flex-wrap gap-2">
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/85 backdrop-blur-sm px-2.5 py-1 rounded border border-slate-800/80 text-slate-400">
          <Compass className="w-3 h-3 text-cyan-400" />
          <span>Left-click drag to orbit • Wheel to zoom • {isMaximized ? 'Press Esc to minimize' : 'Clean 3D view'}</span>
        </div>

        {/* When maximized, provide playback controls so user can interact seamlessly */}
        {isMaximized && onStepForward && onStepBackward && onPauseResume && (
          <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-950/95 backdrop-blur-md px-3 py-1 rounded-md border border-slate-800 shadow-lg text-xs">
            <button
              onClick={onStepBackward}
              disabled={!canStepBackward}
              title="Previous Step"
              className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <StepBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onPauseResume}
              title={isPlaying ? 'Pause' : 'Play'}
              className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 cursor-pointer transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 text-amber-400 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 text-cyan-400 fill-current" />
              )}
            </button>
            <button
              onClick={onStepForward}
              disabled={!canStepForward}
              title="Next Step"
              className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <StepForward className="w-3.5 h-3.5" />
            </button>
            {onReset && (
              <button
                onClick={onReset}
                title="Reset Trace"
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="text-[11px] font-mono text-cyan-400 font-semibold ml-1.5">
              Step {currentStepIndex + 1}/{totalSteps} • Line {currentStep.line}
            </span>
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/85 backdrop-blur-sm px-2.5 py-1 rounded border border-slate-800/80 text-slate-400 font-mono">
          <span className="flex items-center gap-1 text-cyan-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> P1: Memory
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-purple-300">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> P2: Logic
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> P3: Output
          </span>
        </div>
      </div>
    </div>
  );
};
