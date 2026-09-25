export class SizeLimitStream extends TransformStream<Uint8Array, Uint8Array> {
  constructor(maxBytes: number) {
    let totalBytes = 0;
    super({
      transform(chunk, controller) {
        totalBytes += chunk.byteLength;
        if (totalBytes > maxBytes) {
          controller.error(new Error("payload too large"));
          return;
        }
        controller.enqueue(chunk);
      },
    });
  }
}
