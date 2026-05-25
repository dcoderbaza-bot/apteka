const XLSX = require('xlsx');

/**
 * Generates an Excel spreadsheet from JSON data.
 * @param {Array} data - Array of objects containing row data.
 * @param {String} sheetName - Name of the worksheet.
 * @returns {Buffer} - Excel file as a buffer.
 */
const generateExcelBuffer = (data, sheetName = 'Report') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  
  // Set basic column widths for better readability
  const maxProps = {};
  if (data.length > 0) {
    // Determine column widths based on maximum content length
    const keys = Object.keys(data[0]);
    keys.forEach(key => {
      maxProps[key] = key.toString().length;
    });
    
    data.forEach(row => {
      keys.forEach(key => {
        const val = row[key] ? row[key].toString() : '';
        if (val.length > maxProps[key]) {
          maxProps[key] = val.length;
        }
      });
    });
    
    worksheet['!cols'] = keys.map(key => ({
      wch: Math.max(maxProps[key] + 3, 10) // pad with 3 characters, minimum 10
    }));
  }
  
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
};

module.exports = {
  generateExcelBuffer
};
