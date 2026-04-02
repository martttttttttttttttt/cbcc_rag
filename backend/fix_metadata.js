const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'metadata-extractor.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the syntax error
content = content.replace(
  '/(?:No\\.?\\s*)?(\\d+)\\s+of\\s+(\\d{4})/i  // 4 of 2022, No. 4 of 2022\nn  ];',
  '/(?:No\\.?\\s*)?(\\d+)\\s+of\\s+(\\d{4})/i  // 4 of 2022, No. 4 of 2022\n  ];'
);

fs.writeFileSync(filePath, content);
console.log('Fixed metadata-extractor.js');
