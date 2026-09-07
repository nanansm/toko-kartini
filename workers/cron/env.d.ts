// Worker ini sengaja TIDAK memakai @types/node. Menariknya masuk akan membuat
// `Buffer`, `fs`, dan kawan-kawannya lolos type-check padahal mati saat jalan
// di Workers. Yang benar-benar dipakai cuma process.env (disediakan
// nodejs_compat untuk membaca vars dan secrets), jadi cuma itu yang dideklarasikan.
declare const process: {
  env: Record<string, string | undefined>;
};
