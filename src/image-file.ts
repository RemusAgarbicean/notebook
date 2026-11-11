import { formatSize } from './backups'
import { IMAGE_TYPES, MAX_BYTES, pickStored, targetSize, tooBig, type NewImage } from './images'

const encode = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9)).then((blob) => (blob?.type === type ? blob : null))

/**
 * A pasted, dropped or chosen file as the Image to store: scaled down to `MAX_SIDE` and
 * re-encoded as WebP when that makes it smaller, else the file's own bytes. Every save
 * writes the whole Notebook, so Images are kept small. Rejects with a message for the user.
 */
export async function prepareImage(file: Blob): Promise<NewImage> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Only PNG, JPEG and WebP images can be added. This file isn't one.")
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("The browser can't read this image.")
  })
  const original = { width: bitmap.width, height: bitmap.height }
  const size = targetSize(bitmap.width, bitmap.height)
  const canvas = Object.assign(document.createElement('canvas'), size)
  const context = canvas.getContext('2d')
  if (context) {
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, size.width, size.height)
  }
  bitmap.close()
  // A browser that can't write WebP answers with another type: then the file's own type is tried.
  const encoded = context && ((await encode(canvas, 'image/webp')) ?? (await encode(canvas, file.type)))
  const stored = pickStored(file.size, encoded ? encoded.size : null) === 'encoded' ? { blob: encoded!, ...size } : { blob: file, ...original }
  if (tooBig(stored.blob.size))
    throw new Error(
      `This image takes ${formatSize(stored.blob.size)} even after shrinking it. An Image can take ${formatSize(MAX_BYTES)} at most: crop it or save it smaller first.`,
    )
  return { mime: stored.blob.type, width: stored.width, height: stored.height, data: new Uint8Array(await stored.blob.arrayBuffer()) }
}
