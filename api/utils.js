// bnshine/msapp/msapp-4e398247b5d633a2b21f3c69482e0291ce9a9fc9/api/utils.js

// api/utils.js

export function excelDateToDateTime(excelSerialDate) {
    if (!excelSerialDate) {
        return '';
    }

    // Tenta primeiro converter a string para um número
    const numericDate = Number(excelSerialDate);

    // Se a conversão for bem-sucedida e for um número válido
    if (!isNaN(numericDate) && numericDate > 0) {
        // Lógica de conversão de data serial do Excel/Sheets (base 1900, offset -2)
        const days = Math.floor(numericDate);
        const timeFraction = numericDate - days;
        const msInDay = 24 * 60 * 60 * 1000;
        
        const dateObj = new Date(Date.UTC(1899, 11, 30 + days));
        dateObj.setTime(dateObj.getTime() + (timeFraction * msInDay));

        // Formatação para MM/DD/YYYY HH:MM (UTC - para consistência entre servidores/client)
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        const hours = String(dateObj.getUTCHours()).padStart(2, '0');
        const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
        
        // MODIFICATION: Changed format to MM/DD/YYYY HH:MM
        return `${month}/${day}/${year} ${hours}:${minutes}`;
    }

    // Se for uma string (e.g., do formulário frontend YYYY-MM-DDTHH:MM ou YYYY/MM/DD HH:MM), retorna o valor
    if (typeof excelSerialDate === 'string') {
        const dateParts = excelSerialDate.split(' ');
        
        // Handle incoming YYYY/MM/DD HH:MM (old internal format) and convert to MM/DD/YYYY HH:MM
        if (dateParts.length === 2 && dateParts[0].includes('/') && dateParts[1].includes(':')) {
             const parts = dateParts[0].split('/');
             if (parts.length === 3 && parts[0].length === 4) { // YYYY/MM/DD
                 const [Y, M, D] = parts;
                 return `${M}/${D}/${Y} ${dateParts[1]}`;
             }
        }
        
        // If it's already in MM/DD/YYYY HH:MM or another non-Y/M/D format, return as is
        if (dateParts.length === 2 && dateParts[0].includes('/') && dateParts[1].includes(':')) {
            return excelSerialDate;
        }
    }
    
    // Retorna string vazia se nenhum formato for reconhecido
    return '';
}

export function excelDateToYYYYMMDD(excelSerialDate) {
    if (!excelSerialDate) {
        return '';
    }

    const numericDate = Number(excelSerialDate);

    if (!isNaN(numericDate) && numericDate > 0) {
        const date = new Date(Date.UTC(1900, 0, 1));
        date.setDate(date.getDate() + numericDate - 2);
        // MODIFICATION: Changed format to MM/DD/YYYY
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${month}/${day}/${year}`;
    }

    if (typeof excelSerialDate === 'string') {
        // Remove a parte da hora, se existir (ex: 2025/10/01 10:30 -> 2025/10/01)
        const datePart = excelSerialDate.split(' ')[0];
        
        // Handle input format YYYY/MM/DD (old internal format for date only) and convert to MM/DD/YYYY
        const parts = datePart.split('/');
        if (parts.length === 3) {
             if (parts[0].length === 4) { // Assume YYYY/MM/DD format input
                 const [Y, M, D] = parts;
                 return `${M}/${D}/${Y}`;
             }
        }
        
        // If it's a date string already in MM/DD/YYYY, return the date part
        return datePart;
    }
    
    return '';
}
