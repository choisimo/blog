/** Geometry shared by mouse, touch, keyboard and resize updates in the image viewer. */
export interface ImageSize {
    width: number;
    height: number;
}
export interface ImageView {
    scale: number;
    rotation: number;
    x: number;
    y: number;
}
export const INITIAL_IMAGE_VIEW: Readonly<ImageView> = Object.freeze({ scale: 1, rotation: 0, x: 0, y: 0 });
export function normalizeImageDimension(value: unknown): number | undefined {
    if (typeof value !== 'number' && typeof value !== 'string')
        return undefined;
    if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value.trim()))
        return undefined;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 && number <= 100000 ? number : undefined;
}
export function fitImageToViewport(image: ImageSize, viewport: ImageSize, rotation: number): ImageSize {
    if (![image.width, image.height, viewport.width, viewport.height].every(value => Number.isFinite(value) && value > 0)) {
        return { width: 0, height: 0 };
    }
    const sideways = Math.abs(rotation % 180) === 90;
    const ratio = Math.min(1, viewport.width / (sideways ? image.height : image.width), viewport.height / (sideways ? image.width : image.height));
    return { width: image.width * ratio, height: image.height * ratio };
}
export function constrainImageView(view: ImageView, image: ImageSize, viewport: ImageSize): ImageView {
    const scale = Math.min(4, Math.max(0.5, Number.isFinite(view.scale) ? view.scale : 1));
    const rotation = Number.isFinite(view.rotation) ? ((Math.round(view.rotation / 90) * 90) % 360 + 360) % 360 : 0;
    const safeViewport = {
        width: Number.isFinite(viewport.width) ? Math.max(0, viewport.width) : 0,
        height: Number.isFinite(viewport.height) ? Math.max(0, viewport.height) : 0,
    };
    const fit = fitImageToViewport(image, safeViewport, rotation);
    const sideways = rotation % 180 === 90;
    const maxX = Math.max(0, ((sideways ? fit.height : fit.width) * scale - safeViewport.width) / 2);
    const maxY = Math.max(0, ((sideways ? fit.width : fit.height) * scale - safeViewport.height) / 2);
    const x = Number.isFinite(view.x) ? view.x : 0;
    const y = Number.isFinite(view.y) ? view.y : 0;
    return { scale, rotation, x: Math.max(-maxX, Math.min(maxX, x)) || 0, y: Math.max(-maxY, Math.min(maxY, y)) || 0 };
}
