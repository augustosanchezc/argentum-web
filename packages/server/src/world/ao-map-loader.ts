import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Tamaño fijo del header del .map en bytes del formato de AO original
// (Version u16 + Desc 255 + CRC u32 + MagicWord u32 + padding double 8).
const MAP_HEADER_BYTES = 2 + 255 + 4 + 4 + 8; // 273

// Tamano del .inf header (Double 8 + Integer 2).
const INF_HEADER_BYTES = 10;

// Mapas de AO son siempre 100x100 (coords 1..100 en el formato).
export const AO_MAP_WIDTH = 100;
export const AO_MAP_HEIGHT = 100;

export interface AoTile {
  graphic1: number;
  graphic2: number;
  graphic3: number;
  graphic4: number;
  trigger: number;
  blocked: boolean;
  // Datos del .inf — exits a otros mapas, solo presentes si hay TileExit.
  exit: { mapId: number; x: number; y: number } | null;
  npcIndex: number;
  objIndex: number;
  objAmount: number;
}

export interface AoMap {
  readonly id: number;
  readonly width: number;
  readonly height: number;
  readonly version: number;
  readonly description: string;
  readonly tiles: ReadonlyArray<AoTile>;
}

// Lector cursor-based para evitar pasar offsets manualmente.
class BinReader {
  private offset = 0;
  constructor(private readonly buf: Buffer) {}

  u8(): number {
    const v = this.buf.readUInt8(this.offset);
    this.offset += 1;
    return v;
  }

  u16LE(): number {
    const v = this.buf.readUInt16LE(this.offset);
    this.offset += 2;
    return v;
  }

  u32LE(): number {
    const v = this.buf.readUInt32LE(this.offset);
    this.offset += 4;
    return v;
  }

  asciiZ(length: number): string {
    const slice = this.buf.subarray(this.offset, this.offset + length);
    this.offset += length;
    // Recortamos padding (espacios + nulls finales).
    // eslint-disable-next-line no-control-regex
    return slice.toString("latin1").replace(/[\x00 ]+$/, "");
  }

  skip(n: number): void {
    this.offset += n;
  }

  remaining(): number {
    return this.buf.length - this.offset;
  }
}

interface ParsedHeader {
  version: number;
  description: string;
}

function parseMapHeader(reader: BinReader): ParsedHeader {
  const version = reader.u16LE();
  const description = reader.asciiZ(255);
  // CRC + MagicWord + padding double — no los necesitamos para la lógica.
  reader.skip(4 + 4 + 8);
  void MAP_HEADER_BYTES; // referencia: assert offset == MAP_HEADER_BYTES
  return { version, description };
}

function makeEmptyTile(): AoTile {
  return {
    graphic1: 0,
    graphic2: 0,
    graphic3: 0,
    graphic4: 0,
    trigger: 0,
    blocked: false,
    exit: null,
    npcIndex: 0,
    objIndex: 0,
    objAmount: 0,
  };
}

// Parsea el .map. Loop externo Y, interno X (igual que el server VB original
// en FileIO.bas:1693). Coordenadas 1..100 del formato; aqui las indexamos 0..99.
function parseMapBody(reader: BinReader, tiles: AoTile[]): void {
  for (let y = 0; y < AO_MAP_HEIGHT; y += 1) {
    for (let x = 0; x < AO_MAP_WIDTH; x += 1) {
      const tile = tiles[y * AO_MAP_WIDTH + x];
      const flags = reader.u8();
      tile.blocked = (flags & 1) !== 0;
      tile.graphic1 = reader.u32LE();
      if (flags & 2) tile.graphic2 = reader.u32LE();
      if (flags & 4) tile.graphic3 = reader.u32LE();
      if (flags & 8) tile.graphic4 = reader.u32LE();
      if (flags & 16) tile.trigger = reader.u16LE();
    }
  }
}

// Parsea el .inf. Mismo orden de iteracion.
// flags: bit 0 = TileExit (mapId+x+y), bit 1 = Npc, bit 2 = Obj.
function parseInfBody(reader: BinReader, tiles: AoTile[]): void {
  for (let y = 0; y < AO_MAP_HEIGHT; y += 1) {
    for (let x = 0; x < AO_MAP_WIDTH; x += 1) {
      const tile = tiles[y * AO_MAP_WIDTH + x];
      const flags = reader.u8();
      if (flags & 1) {
        tile.exit = {
          mapId: reader.u16LE(),
          x: reader.u16LE(),
          y: reader.u16LE(),
        };
      }
      if (flags & 2) {
        tile.npcIndex = reader.u16LE();
      }
      if (flags & 4) {
        tile.objIndex = reader.u16LE();
        tile.objAmount = reader.u16LE();
      }
    }
  }
}

export interface LoadAoMapOptions {
  mapId: number;
  dataDir: string; // directorio que contiene MapaN.{map,inf,dat}
}

export function loadAoMap(opts: LoadAoMapOptions): AoMap {
  const base = `Mapa${opts.mapId.toString()}`;
  const mapPath = resolve(opts.dataDir, `${base}.map`);
  const infPath = resolve(opts.dataDir, `${base}.inf`);

  const mapBuf = readFileSync(mapPath);
  const infBuf = readFileSync(infPath);

  const mapReader = new BinReader(mapBuf);
  const infReader = new BinReader(infBuf);

  const { version, description } = parseMapHeader(mapReader);

  // .inf header: Double + Integer = 10 bytes; los descartamos.
  infReader.skip(INF_HEADER_BYTES);

  const tiles: AoTile[] = new Array<AoTile>(AO_MAP_WIDTH * AO_MAP_HEIGHT);
  for (let i = 0; i < tiles.length; i += 1) tiles[i] = makeEmptyTile();

  parseMapBody(mapReader, tiles);
  parseInfBody(infReader, tiles);

  return {
    id: opts.mapId,
    width: AO_MAP_WIDTH,
    height: AO_MAP_HEIGHT,
    version,
    description,
    tiles,
  };
}
