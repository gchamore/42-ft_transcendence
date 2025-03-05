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
        render(): void;
        clearColor: Color4;
    }

    class Vector3 {
        constructor(x: number, y: number, z: number);
        x: number;
        y: number;
        z: number;
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

    class HemisphericLight {
        constructor(name: string, direction: Vector3, scene: Scene);
        intensity: number;
    }

    class PointLight {
        constructor(name: string, position: Vector3, scene: Scene);
        intensity: number;
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

    namespace MeshBuilder {
        function CreateBox(name: string, options: BoxOptions, scene: Scene): any;
        function CreateSphere(name: string, options: SphereOptions, scene: Scene): any;
    }

    interface BoxOptions {
        width?: number;
        height?: number;
        depth?: number;
    }

    interface SphereOptions {
        diameter?: number;
        segments?: number;
    }
}