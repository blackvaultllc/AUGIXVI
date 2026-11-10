import "@testing-library/jest-dom/vitest";

// three.js/@react-three-fiber (used by the real SpinningEarth landing scene)
// rely on ResizeObserver and WebGL APIs that jsdom does not provide.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverStub,
});
// jsdom's canvas getContext returns null for WebGL; return a stub so the
// three.js scenes fail gracefully instead of throwing during tests.
const originalGetContext = HTMLCanvasElement.prototype.getContext.bind(
  HTMLCanvasElement.prototype,
) as unknown as (type: string, ...args: unknown[]) => unknown;
HTMLCanvasElement.prototype.getContext = function patchedGetContext(
  this: HTMLCanvasElement,
  type: string,
  ...args: unknown[]
): unknown {
  if (/webgl|webgl2/i.test(type)) {
    return {
      canvas: this,
      addEventListener: () => {},
      removeEventListener: () => {},
      getExtension: () => null,
      getParameter: () => "",
      getProgramParameter: () => false,
      getShaderParameter: () => false,
      createShader: () => ({}),
      createProgram: () => ({}),
      createBuffer: () => ({}),
      createTexture: () => ({}),
      bindBuffer: () => {},
      bindTexture: () => {},
      bufferData: () => {},
      texImage2D: () => {},
      compileShader: () => {},
      attachShader: () => {},
      linkProgram: () => {},
      useProgram: () => {},
      viewport: () => {},
      clearColor: () => {},
      clear: () => {},
      drawArrays: () => {},
      enableVertexAttribArray: () => {},
      vertexAttribPointer: () => {},
      uniform1i: () => {},
      uniform1f: () => {},
      getAttribLocation: () => 0,
      getUniformLocation: () => ({}),
    } as unknown as RenderingContext;
  }
  return originalGetContext(type, ...args);
} as unknown as typeof HTMLCanvasElement.prototype.getContext;

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
