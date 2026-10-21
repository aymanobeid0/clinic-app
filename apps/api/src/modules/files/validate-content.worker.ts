import { parentPort, workerData } from "node:worker_threads";
import { inflateSync } from "node:zlib";
import sharp from "sharp";
import {
  PDFDocument,
  PDFDict,
  PDFArray,
  PDFName,
  PDFRawStream,
  PDFInvalidObject,
} from "pdf-lib";

const forbidden = new Set([
  "A",
  "AA",
  "OpenAction",
  "JS",
  "JavaScript",
  "Launch",
  "EmbeddedFiles",
  "EmbeddedFile",
  "Filespec",
  "RichMedia",
  "XFA",
  "AcroForm",
  "SubmitForm",
  "ImportData",
  "GoToR",
  "GoToE",
  "URI",
  "Sound",
  "Movie",
  "3D",
  "Encrypt",
]);
async function image(bytes: Buffer, format: "png" | "jpeg") {
  const parser = sharp(bytes, {
    failOn: "warning",
    limitInputPixels: 40_000_000,
  });
  const metadata = await parser.metadata();
  if (metadata.format !== format || (metadata.pages ?? 1) !== 1)
    throw new Error("Image format");
  await parser.stats();
}
async function validate(bytes: Buffer, mediaType: string) {
  if (mediaType === "image/png" || mediaType === "image/jpeg")
    return image(bytes, mediaType === "image/png" ? "png" : "jpeg");
  if (
    mediaType !== "application/pdf" ||
    !/^%PDF-1\.[0-7]/.test(bytes.subarray(0, 8).toString("ascii")) ||
    !/%%EOF\s*$/.test(bytes.subarray(-1024).toString("latin1"))
  )
    throw new Error("PDF envelope");
  const doc = await PDFDocument.load(bytes, {
    throwOnInvalidObject: true,
    capNumbers: true,
  });
  if (doc.isEncrypted || !doc.getPageCount() || doc.getPageCount() > 1000)
    throw new Error("PDF pages");
  const seen = new Set<unknown>(),
    images: Buffer[] = [];
  let decoded = 0;
  const inspect = (object: unknown): void => {
    if (seen.has(object)) return;
    seen.add(object);
    if (object instanceof PDFInvalidObject) throw new Error("Invalid object");
    if (object instanceof PDFName && forbidden.has(object.decodeText()))
      throw new Error("Active PDF");
    if (object instanceof PDFDict)
      for (const [key, value] of object.entries()) {
        inspect(key);
        inspect(value);
      }
    if (object instanceof PDFArray)
      for (const value of object.asArray()) inspect(value);
    if (object instanceof PDFRawStream) {
      inspect(object.dict);
      let filter = object.dict.lookup(PDFName.of("Filter"));
      if (filter instanceof PDFArray) {
        if (filter.size() !== 1) throw new Error("Unsupported filter chain");
        filter = filter.lookup(0);
      }
      if (filter && !(filter instanceof PDFName))
        throw new Error("Invalid filter");
      const name = filter instanceof PDFName ? filter.decodeText() : undefined;
      const content = Buffer.from(object.getContents());
      if (name === "FlateDecode")
        decoded += inflateSync(content, { maxOutputLength: 40_000_000 }).length;
      else if (name === "DCTDecode") {
        images.push(content);
        decoded += content.length;
      } else if (name === undefined) decoded += content.length;
      else throw new Error("Unsupported filter");
      if (decoded > 100_000_000) throw new Error("PDF expanded content limit");
    }
  };
  for (const [, object] of doc.context.enumerateIndirectObjects())
    inspect(object);
  for (const bytes of images) await image(bytes, "jpeg");
}
if (parentPort) {
  const data = workerData as { bytes: Uint8Array; mediaType: string };
  void validate(Buffer.from(data.bytes), data.mediaType).then(
    () => parentPort!.postMessage(true),
    () => parentPort!.postMessage(false),
  );
}
