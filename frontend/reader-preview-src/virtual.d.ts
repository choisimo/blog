declare module "virtual:reader-archive" {
  const archive: {
    publicConfig: Record<string, unknown>;
    textAssets: Record<string, string>;
    imageAssets: Record<string, string>;
  };
  export default archive;
}

declare module "virtual:reader-memo";
