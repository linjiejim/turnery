import { createHash } from "node:crypto"

/** Drop only a ComponentSource's derived native payload, never user params or notes. */
export function contentKey(inputs: unknown) {
  const json = JSON.stringify(inputs, function (key, value) {
    if (key === "compiled" && typeof this?.file === "string" && value && typeof value === "object" && Array.isArray(value.parts) && Number.isInteger(value.failed)) return undefined
    // Bytes (a STEP file) stand in by their hash: as JSON a 17 MB file is an object of 17 million
    // entries, which held the engine up for 12.8 s over the keys of one `turnery check`.
    if (ArrayBuffer.isView(value)) return `${value.constructor.name}:${value.byteLength}:${createHash("sha256").update(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)).digest("hex")}`
    return value
  })
  return createHash("sha256").update(json).digest("hex")
}
