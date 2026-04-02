const fs = require('fs');
const db = JSON.parse(fs.readFileSync('pdf_database.json', 'utf8'));
const doc = db.files.find(f => f.originalName.includes('2021-5'));

const content = doc.content;
const lower = content.toLowerCase();

// Find all occurrences of "route"
console.log('=== All "route" occurrences in SFAT 2021-5 ===\n');

let match;
const regex = /route/gi;
const positions = [];

while ((match = regex.exec(content)) !== null) {
  positions.push(match.index);
}

console.log(`Found ${positions.length} occurrences of "route"\n`);

positions.forEach((pos, i) => {
  const start = Math.max(0, pos - 150);
  const end = Math.min(content.length, pos + 400);
  const context = content.substring(start, end).replace(/\n/g, ' ').replace(/\s+/g, ' ');
  
  console.log(`\n--- Occurrence ${i + 1} (position ${pos}) ---`);
  console.log(context);
  console.log('');
});

// Also search for key phrases around disciplinary powers
console.log('\n=== Key passages about disciplinary powers ===\n');

const keyPhrases = [
  'disciplinary powers',
  'section 194',
  'section 193',
  'NPDA',
  'Notice of Proposed Disciplinary Action',
  'Tribunal'
];

keyPhrases.forEach(phrase => {
  const idx = lower.indexOf(phrase.toLowerCase());
  if (idx >= 0) {
    const start = Math.max(0, idx - 50);
    const end = Math.min(content.length, idx + 350);
    const context = content.substring(start, end).replace(/\n/g, ' ').replace(/\s+/g, ' ');
    console.log(`\n"${phrase}" (position ${idx}):`);
    console.log(context);
  }
});
