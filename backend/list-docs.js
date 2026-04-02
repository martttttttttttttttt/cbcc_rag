const db = require('./pdf_database.json');
db.files.forEach((file, i) => {
  console.log(`${i+1}. ${file.originalName} (docId: ${file.id})`);
});
