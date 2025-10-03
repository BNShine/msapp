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

        // Formatação para YYYY/MM/DD HH:MM (UTC - para consistência entre servidores/client)
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        const hours = String(dateObj.getUTCHours()).padStart(2, '0');
        const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
        
        return `${year}/${month}/${day} ${hours}:${minutes}`;
    }

    // Se for uma string (e.g., do formulário frontend YYYY/MM/DD HH:MM), retorna o valor
    if (typeof excelSerialDate === 'string') {
        const dateParts = excelSerialDate.split(' ');
        if (dateParts.length === 2 && dateParts[0].includes('/') && dateParts[1].includes(':')) {
            // Se já estiver no formato alvo, retorna
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
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    }

    if (typeof excelSerialDate === 'string') {
        // Remove a parte da hora, se existir (ex: 2025/10/01 10:30 -> 2025/10/01)
        const datePart = excelSerialDate.split(' ')[0];
        const dateObject = new Date(datePart);

        if (!isNaN(dateObject.getTime())) {
            const year = dateObject.getFullYear();
            const month = String(dateObject.getMonth() + 1).padStart(2, '0');
            const day = String(dateObject.getDate()).padStart(2, '0');
            return `${year}/${month}/${day}`;
        }
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
