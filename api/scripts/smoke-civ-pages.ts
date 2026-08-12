import { mapCivExtractTextToPreview } from '../src/fleet/civ-extract';

const sample = `
=== CIV FAȚĂ ===
Mențiuni:
-
A. Registration number; C.2. Owner of the vehicle; Number of seats including driver's seat; D.1. Make

A. Număr de înmatriculare: B-157-EFI
C.2. Proprietar: CARAIAC MARIUS
P 5 4 1 9 8 1

=== CIV VERSO ===
D.1. Marcă: DACIA
D.2. Tip: SD
Variantă: 7SDCL
Versiune: 7SDCL5
D.3. Denumire comercială: LOGAN
E. Număr de identificare: UU17SDCL551325663
2. An fabricație: 2014
J. Categorie: M1
3. Categorie de folosință: AUTOTURISM M1
5. Caroserie: AC BREAK
L. Număr axe: 2
F.1. Masă maximă tehnic admisibilă, cu excepția motocicletelor (kg): 1670
10. Lungime (mm): 4494
14. Cod motor: K9K-C6
P.1. Capacitate cilindrică (cm3): 1461
P.2. Putere (kW): 66
P.3. Tip combustibil sau sursă de energie: MOTORINĂ
P.5. Serie motor: R196021
R. Culoare: MARO
S.1. Număr locuri, inclusiv locul conducătorului auto: 5
18. Tracțiune: FAȚĂ
W. Capacitate rezervor (l): 50
21. Reprezentanță RAR: OB/B2320088
Data eliberării: 14.02.2022
`;

const p = mapCivExtractTextToPreview(sample, 'unknown', 'text');
const keys = Object.keys(p.civProfile).filter((k) => p.civProfile[k] != null && p.civProfile[k] !== '');
console.log({
  brand: p.civProfile.brand,
  vin: p.vin,
  civSeries: p.civSeries,
  typeVariantVersion: p.civProfile.typeVariantVersion,
  fields: keys.length,
  matched: p.matched.length,
});
if (p.civProfile.brand !== 'DACIA') throw new Error(`brand=${p.civProfile.brand}`);
if (p.civSeries !== 'P541981') throw new Error(`serie=${p.civSeries}`);
if (keys.length < 12) throw new Error(`fields=${keys.length}`);
console.log('OK');
