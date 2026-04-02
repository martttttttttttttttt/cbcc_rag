const fs = require('fs');
const db = JSON.parse(fs.readFileSync('pdf_database.json', 'utf8'));
const doc = db.files.find(f => f.originalName.includes('2021-5'));

console.log('SFAT 2021-5 Content Analysis:');
console.log('Total chars:', doc.contentLen);

const c = doc.content.toLowerCase();
console.log('\nKeyword counts:');
console.log('  route:', (c.match(/route/g) || []).length);
console.log('  disciplinary:', (c.match(/disciplinary/g) || []).length);
console.log('  power:', (c.match(/power/g) || []).length);
console.log('  section 194:', (c.match(/section\s*194/g) || []).length);
console.log('  fit and proper:', (c.match(/fit\s+and\s+proper/g) || []).length);

console.log('\n=== Searching for "route" context ===');
const idx = c.indexOf('route');
if (idx >= 0) {
  console.log('Found at position', idx);
  console.log('Context:', doc.content.substring(idx - 100, idx + 300));
} else {
  console.log('NOT FOUND - no mention of "route" in this document');
}

console.log('\n=== Searching for "disciplinary" context ===');
const idx2 = c.indexOf('disciplinary');
if (idx2 >= 0) {
  console.log('Found at position', idx2);
  console.log('Context:', doc.content.substring(idx2 - 50, idx2 + 250));
}

console.log('\n=== Searching for "section 194" context ===');
const idx3 = c.indexOf('section 194');
if (idx3 >= 0) {
  console.log('Found at position', idx3);
  console.log('Context:', doc.content.substring(idx3 - 50, idx3 + 300));
}
