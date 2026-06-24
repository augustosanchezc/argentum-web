import { Packr, Unpackr } from "msgpackr";

const packr = new Packr({ moreTypes: false });
const unpackr = new Unpackr({ moreTypes: false });

export function encode(value: unknown): Uint8Array {
  return packr.pack(value);
}

export function decode<T>(buf: ArrayBuffer | Uint8Array): T {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return unpackr.unpack(bytes) as T;
}
