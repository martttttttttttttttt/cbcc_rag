const fs = require('fs');
const db = JSON.parse(fs.readFileSync('pdf_database.json', 'utf8'));
const doc = db.files.find(f => f.originalName.includes('2021-5'));

const content = doc.content;

// Extract the key passages about "route" and disciplinary powers
console.log('=== KEY PASSAGE 1: Route and Section 193(1) (around position 17795) ===\n');
console.log(content.substring(17500, 18500).replace(/\n/g, '\n'));

console.log('\n\n=== KEY PASSAGE 2: Separate and different routes (around position 19422) ===\n');
console.log(content.substring(19200, 20200).replace(/\n/g, '\n'));

console.log('\n\n=== KEY PASSAGE 3: SFC has not explained the route (around position 20954) ===\n');
console.log(content.substring(20700, 21700).replace(/\n/g, '\n'));

console.log('\n\n=== KEY PASSAGE 4: Decision Notice must disclose the legal route (around position 25754) ===\n');
console.log(content.substring(25500, 26500).replace(/\n/g, '\n'));
