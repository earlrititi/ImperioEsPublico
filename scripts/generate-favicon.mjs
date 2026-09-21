import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = resolve(root, "public", "images", "logo-redv2.png");
const sizes = [16, 32, 48];

const pngs = await Promise.all(
  sizes.map((size) =>
    sharp(source)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer()
  )
);

await writeFile(resolve(root, "public", "favicon-16x16.png"), pngs[0]);
await writeFile(resolve(root, "public", "favicon-32x32.png"), pngs[1]);

const headerSize = 6 + sizes.length * 16;
let imageOffset = headerSize;
const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);

sizes.forEach((size, index) => {
  const entryOffset = 6 + index * 16;
  const png = pngs[index];
  header.writeUInt8(size, entryOffset);
  header.writeUInt8(size, entryOffset + 1);
  header.writeUInt8(0, entryOffset + 2);
  header.writeUInt8(0, entryOffset + 3);
  header.writeUInt16LE(1, entryOffset + 4);
  header.writeUInt16LE(32, entryOffset + 6);
  header.writeUInt32LE(png.length, entryOffset + 8);
  header.writeUInt32LE(imageOffset, entryOffset + 12);
  imageOffset += png.length;
});

await writeFile(
  resolve(root, "public", "favicon.ico"),
  Buffer.concat([header, ...pngs])
);

console.log("Generated favicon.ico and 16x16/32x32 PNG variants.");
