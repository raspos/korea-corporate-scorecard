export const isNumber = value => typeof value === 'number' && Number.isFinite(value);
export const assetSizeGroup = size => ({초대형:'대',대형:'대',중대형:'대',중형:'중',소형:'소'})[size] ?? null;
export const assetSizeLabel = size => assetSizeGroup(size) ? `${assetSizeGroup(size)}규모` : '규모 미확인';
export const scoreOf = (company, key = 'overall') => {
  if (key === 'overall') return company.scores?.overall ?? company.scores?.provisionalOverall ?? null;
  if (key === 'improvement') return company.scores?.improvement ?? company.scores?.provisionalImprovement ?? null;
  return company.scores?.[key] ?? null;
};

export function filterCompanies(companies, filters = {}) {
  const q = (filters.search || '').trim().toLocaleLowerCase('ko');
  return companies.filter(c => {
    const current = c.isCurrentListed ?? ['코스피', '코스닥', '코넥스'].includes(c.market);
    return (!filters.currentOnly || current)
      && (!q || `${c.name} ${c.ticker || ''} ${c.id}`.toLocaleLowerCase('ko').includes(q))
      && (!filters.market || filters.market === 'all' || c.market === filters.market)
      && (!filters.industry || filters.industry === 'all' || c.industry === filters.industry)
      && (!filters.size || filters.size === 'all' || c.size === filters.size || assetSizeGroup(c.size) === filters.size)
      && (!filters.quality || filters.quality === 'all' || c.quality?.status === filters.quality);
  });
}

export function sortCompanies(companies, key = 'overall', direction = 'desc') {
  const getter = c => key === 'name' ? c.name : key === 'rank' ? c.rank : key.startsWith('metric:') ? c.metrics?.[key.slice(7)] : scoreOf(c, key);
  return [...companies].sort((a, b) => {
    const x = getter(a), y = getter(b);
    if (x == null && y == null) return a.name.localeCompare(b.name, 'ko');
    if (x == null) return 1;
    if (y == null) return -1;
    const result = typeof x === 'string' ? x.localeCompare(y, 'ko') : x - y;
    return result === 0 ? a.name.localeCompare(b.name, 'ko') : result * (direction === 'asc' ? 1 : -1);
  });
}

export function pageCompanies(companies, page, size) {
  const pages = Math.max(1, Math.ceil(companies.length / size));
  const selected = Math.min(Math.max(1, page), pages);
  return {rows: companies.slice((selected - 1) * size, selected * size), page: selected, pages, total: companies.length};
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Prevent spreadsheet programs from treating user-visible text as a formula.
export function spreadsheetText(value) {
  const text = String(value ?? '');
  return /^[\s]*[=+@-]/.test(text) && !isNumber(value) ? `'${text}` : text;
}

export function makeCsv(headers, rows) {
  const quote = value => `"${spreadsheetText(value).replaceAll('"', '""')}"`;
  return '\uFEFF' + [headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n');
}

export function makeSpreadsheetXml(headers, rows) {
  const xml = value => escapeHtml(value);
  const row = values => '<Row>' + values.map(value => `<Cell><Data ss:Type="${isNumber(value) ? 'Number' : 'String'}">${xml(isNumber(value) ? value : spreadsheetText(value))}</Data></Cell>`).join('') + '</Row>';
  return '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>'
    + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="기업 성적표"><Table>'
    + [headers, ...rows].map(row).join('') + '</Table></Worksheet></Workbook>';
}
