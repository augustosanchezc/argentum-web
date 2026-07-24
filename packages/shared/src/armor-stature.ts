// GENERADO desde data/dat/obj.dat (armaduras ObjType=3 con RazaEnana=1).
// Estatura de armaduras: en el AO original las armaduras vienen en dos tallas.
// Las variantes "(E/G)" (RazaEnana=1) tienen el body corto de Enano/Gnomo; el
// resto usa el body "alto" (Humano/Elfo/Elfo Oscuro). Un personaje solo puede
// equipar armaduras de SU estatura (regla del AO: RazaEnana gatea la raza).
// Regenerar: node packages/server/scripts/gen-armor-stature.mjs

export const ENANO_ARMOR_IDS: ReadonlySet<number> = new Set([
  240, 243, 379, 392, 393, 466, 483, 486, 492, 500, 502, 507,
  512, 524, 525, 526, 527, 549, 558, 615, 617, 632, 633, 636,
  639, 648, 656, 667, 668, 670, 671, 672, 676, 678, 681, 682,
  685, 686, 688, 690, 694, 695, 707, 854, 867, 877, 878, 907,
  908, 909, 910, 911, 912, 913, 914, 915, 916, 917, 918, 919,
  920, 921, 922, 923, 924, 925, 926, 927, 928, 929, 930, 931,
  932, 933, 934, 935, 936, 937, 938, 939, 940, 941, 942, 957,
  958, 959, 960, 961, 962, 963, 964, 965, 966, 967, 968, 969,
  970, 971, 972, 973, 974, 975, 976, 993, 994, 998, 999, 1039,
  1040, 1041, 1042, 1045, 1047, 1056, 1070, 1072, 1074, 1076, 1078, 1080,
  1082, 1084, 1086, 1088, 1090, 1092, 1094, 1096, 1098, 1100, 1102, 1104,
  1106, 1108, 1110, 1112, 1123, 1137,
]);

/** true si la armadura es de estatura Enano/Gnomo (variante E/G del AO). */
export function isEnanoArmor(itemId: number): boolean {
  return ENANO_ARMOR_IDS.has(itemId);
}
