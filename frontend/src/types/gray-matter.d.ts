declare module 'gray-matter' {
  export type GrayMatterData = Record<string, unknown>;

  export interface GrayMatterFile<T extends GrayMatterData = GrayMatterData> {
    data: T;
    content: string;
    excerpt?: string;
    isEmpty?: boolean;
  }

  export interface GrayMatterOptions<T extends GrayMatterData = GrayMatterData> {
    excerpt?: boolean | ((file: GrayMatterFile<T>) => string);
  }

  export default function matter<T extends GrayMatterData = GrayMatterData>(
    input: string,
    options?: GrayMatterOptions<T>
  ): GrayMatterFile<T>;
}
