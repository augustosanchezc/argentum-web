import { Packr, Unpackr } from "msgpackr";

// Una instancia compartida — msgpackr es seguro de reusar en concurrencia
// porque no mantiene estado entre llamadas a encode/decode.
const packr = new Packr({ moreTypes: false });
const unpackr = new Unpackr({ moreTypes: false });

export function encode(value: unknown): Buffer {
  return packr.pack(value);
}

export function decode<T>(buf: Buffer | Uint8Array): T {
  return unpackr.unpack(buf) as T;
}
