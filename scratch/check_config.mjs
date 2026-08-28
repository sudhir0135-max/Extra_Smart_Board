import fs from 'fs';
try {
  const config = JSON.parse(fs.readFileSync('C:\\Users\\sudhi\\.config\\configstore\\firebase-tools.json', 'utf8'));
  console.log('Keys:', Object.keys(config));
  if (config.tokens) {
    console.log('Tokens keys:', Object.keys(config.tokens));
  }
  if (config.user) {
    console.log('User keys:', Object.keys(config.user));
  }
} catch (e) {
  console.error(e);
}
