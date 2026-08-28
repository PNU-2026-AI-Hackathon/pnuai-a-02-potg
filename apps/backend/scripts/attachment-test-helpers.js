const fs = require('fs');

function pdfString(value) {
  return [...value].map((character) => {
    if (character === '\u0000') return '\\000';
    if (/[\\()]/.test(character)) return `\\${character}`;
    return /[\x20-\x7e]/.test(character) ? character : '?';
  }).join('');
}

function createPdf(filePath, pageTexts) {
  const fontObject = 3 + pageTexts.length * 2;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageTexts.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pageTexts.length} >>`,
  ];
  for (let index = 0; index < pageTexts.length; index += 1) {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const lines = pageTexts[index].split('\n');
    const commands = lines.length === 1 && lines[0] === ''
      ? ''
      : `BT /F1 11 Tf 50 790 Td 14 TL ${lines.map((line, lineIndex) => `${lineIndex ? 'T* ' : ''}(${pdfString(line)}) Tj`).join(' ')} ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`);
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  fs.writeFileSync(filePath, output, 'ascii');
}

module.exports = { createPdf };
