export const normalizePersonName = value => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('tr')
  .replace(/ı/g, 'i')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();
