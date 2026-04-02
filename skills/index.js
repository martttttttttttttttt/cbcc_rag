const PDFManagement = require('./pdf-management');
const OCRExtraction = require('./ocr-extraction');
const DocumentAnalysis = require('./document-analysis');
const AIQnA = require('./ai-qna');
const VectorSearch = require('./vector-search');
const LegalAnalysis = require('./legal-analysis');

class ClawTextSkills {
  constructor(options = {}) {
    this.options = options;
    this.skills = {
      pdfManagement: new PDFManagement(options),
      ocrExtraction: new OCRExtraction(options),
      documentAnalysis: new DocumentAnalysis(options),
      aiQnA: new AIQnA(options),
      vectorSearch: new VectorSearch(options),
      legalAnalysis: new LegalAnalysis(options)
    };
  }

  getSkill(name) {
    return this.skills[name];
  }

  async uploadPDF(files, category = 'MMT') {
    return this.skills.pdfManagement.upload({ files, category });
  }

  listPDFs(category) {
    return this.skills.pdfManagement.list({ category });
  }

  deletePDF(fileId) {
    return this.skills.pdfManagement.delete({ fileId });
  }

  async extractText(filePath) {
    return this.skills.ocrExtraction.extract({ filePath });
  }

  async analyzeDocument(content, docId, docName) {
    return this.skills.documentAnalysis.analyze({ content, docId, docName });
  }

  async askQuestion(question, category, docFilter) {
    return this.skills.aiQnA.ask({ question, category, docFilter });
  }

  async search(query, topK = 5) {
    return this.skills.vectorSearch.search({ query, topK });
  }

  async generateEmbeddings() {
    return this.skills.vectorSearch.generateEmbeddingsForChunks();
  }

  analyzeCourtComments(content, docName) {
    return this.skills.legalAnalysis.analyzeCourtComments({ content, docName });
  }

  analyzeLegalProvisions(content, docName) {
    return this.skills.legalAnalysis.analyzeLegalProvisions({ content, docName });
  }
}

module.exports = {
  ClawTextSkills,
  PDFManagement,
  OCRExtraction,
  DocumentAnalysis,
  AIQnA,
  VectorSearch,
  LegalAnalysis
};