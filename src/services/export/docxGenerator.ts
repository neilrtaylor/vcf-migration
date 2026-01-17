// Re-export from modular DOCX generator
// This maintains backwards compatibility with existing imports

export { generateDocxReport, downloadDocx } from './docx';
export type { DocxExportOptions, VMReadiness, ROKSSizing, VSIMapping } from './docx';
