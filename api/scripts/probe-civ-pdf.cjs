const fs = require('fs');
const buf = fs.readFileSync('c:/Users/mariu/Downloads/CIV Logan B157EFI.pdf');
console.log('bytes', buf.length);
const s = buf.toString('latin1');
const checks = {
  'D.1': /\bD\.1\b/.test(s),
  Marca: /Marca/.test(s),
  identificare: /identificare/i.test(s),
  DACIA: /DACIA/i.test(s),
  LOGAN: /LOGAN/i.test(s),
  B157: /B157/i.test(s),
  Image: /\/Image/.test(s),
  DCTDecode: /DCTDecode/.test(s),
  JPXDecode: /JPXDecode/.test(s),
  FlateDecode: /FlateDecode/.test(s),
  pages: (s.match(/\/Type\s*\/Page[^s]/g) || []).length,
};
console.log(JSON.stringify(checks, null, 2));
// Extract readable ASCII/Latin chunks
const chunks = [];
let cur = '';
for (let i = 0; i < s.length; i++) {
  const c = s.charCodeAt(i);
  if ((c >= 32 && c < 127) || (c >= 160 && c < 256)) {
    cur += s[i];
  } else {
    if (cur.length >= 6) chunks.push(cur.trim());
    cur = '';
  }
}
if (cur.length >= 6) chunks.push(cur.trim());
const interesting = chunks.filter((t) =>
  /DACIA|LOGAN|MARCA|TIP|VIN|CIV|OMOL|IDENT|MOTOR|CILIN|PUTERE|B157|SERIE|CATEG|CAROS|D\.1|P\.3|AN FABR/i.test(
    t,
  ),
);
console.log('---interesting---');
interesting.slice(0, 60).forEach((t) => console.log(t.slice(0, 200)));
