import sharp from "sharp";
import {
  PDFDocument,
  PDFDict,
  PDFArray,
  PDFName,
  PDFRawStream,
  PDFInvalidObject,
  decodePDFRawStream,
} from "pdf-lib";
import { AppError } from "../../errors/app-error.js";
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
export async function validateContent(bytes: Buffer, mediaType: string) {
  if (!bytes.length || bytes.length > 20_000_000)
    throw new AppError(413, "Maximum 20 000 000 octets par fichier.");
  try {
    if (mediaType === "application/pdf") {
      if (
        !bytes
          .subarray(0, 8)
          .toString("ascii")
          .match(/^%PDF-1\.[0-7]/) ||
        !/%%EOF\s*$/.test(bytes.subarray(-1024).toString("latin1"))
      )
        throw new Error("PDF envelope");
      const doc = await PDFDocument.load(bytes, {
        throwOnInvalidObject: true,
        capNumbers: true,
      });
      if (doc.isEncrypted || !doc.getPageCount() || doc.getPageCount() > 1000)
        throw new Error("PDF pages");
      const seen = new Set<unknown>();
      const inspect = (object: unknown): void => {
        if (seen.has(object)) return;
        seen.add(object);
        if (object instanceof PDFInvalidObject)
          throw new Error("Invalid object");
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
          const filter = object.dict.get(PDFName.of("Filter"))?.toString();
          if (!filter || filter === "/FlateDecode")
            decodePDFRawStream(object).decode();
        }
      };
      for (const [, object] of doc.context.enumerateIndirectObjects())
        inspect(object);
    } else if (mediaType === "image/png" || mediaType === "image/jpeg") {
      const image = sharp(bytes, {
        failOn: "warning",
        limitInputPixels: 40_000_000,
      });
      const metadata = await image.metadata();
      if (
        metadata.format !== (mediaType === "image/png" ? "png" : "jpeg") ||
        (metadata.pages ?? 1) !== 1
      )
        throw new Error("Image format");
      await image.stats(); // Decode every pixel; metadata/signatures alone accept truncated images.
    } else throw new Error("Unsupported");
  } catch {
    throw new AppError(
      400,
      "Fichier invalide, corrompu ou contenu actif non pris en charge.",
    );
  }
}
