declare namespace BABYLON {
    class Engine {
        static isSupported(): boolean;
        constructor(canvas: HTMLCanvasElement, antialias?: boolean);
        runRenderLoop(callback: () => void): void;
        resize(): void;
        dispose(): void;
        isDisposed: boolean;
        getFps(): number;
    }

    class Scene {
        constructor(engine: Engine);
        activeCamera: Camera;
        render(): void;
        clearColor: Color4;
    }

    class Vector3 {
        constructor(x: number, y: number, z: number);
        x: number;
        y: number;
        z: number;
        static Lerp(start: Vector3, end: Vector3, amount: number): Vector3;
    }

    class Color3 {
        constructor(r: number, g: number, b: number);
    }

    class Color4 {
        constructor(r: number, g: number, b: number, a: number);
    }

    class ArcRotateCamera {
        constructor(name: string, alpha: number, beta: number, radius: number, target: Vector3, scene: Scene);
        attachControl(canvas: HTMLCanvasElement, noPreventDefault?: boolean): void;
        lowerRadiusLimit: number;
        upperRadiusLimit: number;
        lowerBetaLimit: number;
        upperBetaLimit: number;
    }

    class Light { 
        constructor(name: string, scene: Scene);
        intensity: number;
        diffuseColor: Color3;
        dispose(): void;
    }

    class HemisphericLight extends Light {
        constructor(name: string, direction: Vector3, scene: Scene);
    }

    class PointLight extends Light {
        constructor(name: string, position: Vector3, scene: Scene);
    }

    class StandardMaterial {
        constructor(name: string, scene: Scene);
        diffuseColor: Color3;
        specularColor: Color3;
        emissiveColor: Color3;
        alpha: number;
    }

    class ShadowGenerator {
        constructor(mapSize: number, light: PointLight);
        getShadowMap(): RenderTargetTexture;
        useBlurExponentialShadowMap: boolean;
        usePoissonSampling: boolean;
        blurScale: number;
        addShadowCaster(mesh: any): void;
    }

    class RenderTargetTexture {
        static REFRESHRATE_RENDER_ONCE: number;
        refreshRate: number;
    }

    class GlowLayer {
        constructor(name: string, scene: Scene);
        intensity: number;
        addIncludedOnlyMesh(mesh: any): void;
        dispose(): void;
    }
    
    class Mesh { 
        position: Vector3;
        material: StandardMaterial;
        receiveShadows: boolean;
        rotation: Vector3;
        dispose(): void;
    }

    namespace MeshBuilder {
        function CreateCylinder(name: string, options: CylinderOptions, scene: Scene): Mesh;
        function CreateSphere(name: string, options: SphereOptions, scene: Scene): Mesh;
        function CreateBox(name: string, options: BoxOptions, scene: Scene): Mesh;
        function CreateText(name: string, text: string, options: any | null, scene: Scene): Mesh;
    }

    interface CylinderOptions {
        diameter?: number;
        height?: number;
        tessellation?: number;
    }

    interface SphereOptions {
        diameter?: number;
        segments?: number;
    }

    interface BoxOptions {
        width?: number;
        height?: number;
        depth?: number;
    }
}