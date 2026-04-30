/**
 * Generează un hash bcrypt pentru DEV_LOGIN_PASSWORD_HASH.
 * Utilizare: node scripts/hash-dev-password.js "parola-ta"
 */
const bcrypt = require('bcrypt');

const password = process.argv[2];
if (!password) {
  // eslint-disable-next-line no-console
  console.error('Usage: node scripts/hash-dev-password.js "<plain-password>"');
  process.exit(1);
}

const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;

bcrypt
  .hash(password, rounds)
  .then((hash) => {
    // eslint-disable-next-line no-console
    console.log('Adaugă în api/.env (o singură linie):');
    // eslint-disable-next-line no-console
    console.log(`DEV_LOGIN_PASSWORD_HASH="${hash}"`);
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('Poți șterge DEV_LOGIN_PASSWORD după migrare.');
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
