// api/utils.js

export function excelDateToYYYYMMDD(excelSerialDate) {
    if (!excelSerialDate) {
        return '';
    }

    // Tenta primeiro converter a string para um número
    const numericDate = Number(excelSerialDate);

    // Se a conversão for bem-sucedida e for um número válido
    if (!isNaN(numericDate) && numericDate > 0) {
        const date = new Date(Date.UTC(1900, 0, 1));
        date.setDate(date.getDate() + numericDate - 2);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    }

    // Se for uma string, tenta analisar e formatar
    if (typeof excelSerialDate === 'string') {
        const dateObject = new Date(excelSerialDate);

        // Verifica se a análise da string produziu uma data válida
        if (!isNaN(dateObject.getTime())) {
            const year = dateObject.getFullYear();
            const month = String(dateObject.getMonth() + 1).padStart(2, '0');
            const day = String(dateObject.getDate()).padStart(2, '0');
            return `${year}/${month}/${day}`;
        }
    }
    
    // Retorna string vazia se nenhum formato for reconhecido
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
