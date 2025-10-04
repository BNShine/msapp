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
        // Cria uma data baseada em 1899-12-30 (base correta do Sheets) + dias em UTC.
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

    // Se for uma string (e.g., do formulário frontend ou Sheets string), tenta converter para MM/DD/YYYY HH:MM
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
        if (dateParts.length === 2 && dateParts[0].includes('/') && dateParts[1].includes(':') && dateParts[0].split('/')[0].length === 2) {
             // Heuristic check: if the first part is 2 digits, assume MM/DD/YYYY
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
        
        // Handle incoming YYYY/MM/DD (old format) and convert to MM/DD/YYYY
        const parts = datePart.split('/');
        if (parts.length === 3) {
             if (parts[0].length === 4) { // YYYY/MM/DD
                 const [Y, M, D] = parts;
                 return `${M}/${D}/${Y}`;
             }
        }
        
        // If it's already a date string in MM/DD/YYYY, return the date part
        return datePart;
    }
    
    return '';
}

export const dynamicLists = {
    pets: Array.from({ length: 15 }, (_, i) => i + 1),
    weeks: Array.from({ length: 5 }, (_, i) => i + 1),
    months: Array.from({ length: 12 }, (_, i) => i + 1),
    years: Array.from({ length: 17 }, (_, i) => 2024 + i),
    sources: [
        "Facebook", "Kommo", "Social Traffic", "SMS", "Call", "Friends", 
        "Family Member", "Neighbors", "Reminder", "Email", "Google", 
        "Website", "Grooming / Referral P", "Instagram", "Technician", "WhatsApp", "Other"
    ]
};
