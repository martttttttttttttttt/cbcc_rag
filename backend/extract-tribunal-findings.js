const fs = require('fs');
const db = JSON.parse(fs.readFileSync('pdf_database.json', 'utf8'));
const doc = db.files.find(f => f.originalName.includes('2021-5'));

const content = doc.content;

// Extract comprehensive Tribunal findings
console.log('=== COMPREHENSIVE TRIBUNAL FINDINGS ON "ROUTE" REQUIREMENT ===\n');

// Section about what Decision Notice must contain
console.log('1. WHAT DECISION NOTICE MUST DISCLOSE:');
console.log('========================================');
const idx1 = content.toLowerCase().indexOf('decision notice must disclose');
if (idx1 >= 0) {
  console.log(content.substring(idx1 - 100, idx1 + 800).replace(/\n/g, '\n'));
}

console.log('\n\n2. TRIBUNAL CRITICISM OF SFC\'S "AND/OR" APPROACH:');
console.log('================================================');
const idx2 = content.toLowerCase().indexOf('wholly unacceptable');
if (idx2 >= 0) {
  console.log(content.substring(idx2 - 200, idx2 + 400).replace(/\n/g, '\n'));
}

console.log('\n\n3. WHY ROUTE DISCLOSURE MATTERS:');
console.log('================================');
const idx3 = content.toLowerCase().indexOf('will have difficulty');
if (idx3 >= 0) {
  console.log(content.substring(idx3 - 250, idx3 + 350).replace(/\n/g, '\n'));
}

console.log('\n\n4. SECTION 193(1) DEFINITION OF MISCONDUCT - THE 5 ROUTES:');
console.log('==========================================================');
const idx4 = content.toLowerCase().indexOf('misconduct means');
if (idx4 >= 0) {
  console.log(content.substring(idx4 - 50, idx4 + 600).replace(/\n/g, '\n'));
}

console.log('\n\n5. TRIBUNAL\'S ANALYSIS OF WHICH ROUTE SFC USED:');
console.log('================================================');
const idx5 = content.toLowerCase().indexOf('paragraph (d) cannot be relied');
if (idx5 >= 0) {
  console.log(content.substring(idx5 - 100, idx5 + 500).replace(/\n/g, '\n'));
}
