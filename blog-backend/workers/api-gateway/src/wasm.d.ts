declare module '@resvg/resvg-wasm/index_bg.wasm' {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}

declare module '*.wasm' {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
