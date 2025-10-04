// bnshine/msapp/msapp-4e398247b5d633a2b21f3c69482e0291ce9a9fc9/public/dashboard.js

// Helper function to format a date object to MM/DD/YYYY string
function formatDateToYYYYMMDD(dateObj) {
    // MODIFICATION 1: Change to output MM/DD/YYYY
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    return `${month}/${day}/${year}`;
}

// ... (existing code)

// Function to handle form submission
async function handleFormSubmission(event) {
    event.preventDefault();

    const form = event.target;
    console.log("Submit Event Fired. Starting API call..."); 

    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });
    
    const technician = data.technician || '';
    const appointmentDateLocal = data.appointmentDate; // YYYY-MM-DDTHH:MM

    // START MODIFICATION 7: Add Hour Validation (No change in logic)
    const MIN_HOUR = 7;
    const MAX_HOUR = 21;

    // 1. Validate Hour Range
    const hour = parseInt(appointmentDateLocal.substring(11, 13), 10);
    const minute = parseInt(appointmentDateLocal.substring(14, 16), 10);

    if (hour < MIN_HOUR || hour > MAX_HOUR) {
        alert(`Registration Error: Appointments must be scheduled between ${MIN_HOUR}:00 and ${MAX_HOUR}:00.`);
        return; // Prevent form submission
    }
    // 21:00 is the last valid start time, so if hour is 21, minutes must be 00.
    if (hour === MAX_HOUR && minute > 0) {
        alert(`Registration Error: The last valid time slot is ${MAX_HOUR}:00.`);
        return; // Prevent form submission
    }
    // END MODIFICATION 7

    // MODIFICATION 2: Convert HTML input format (YYYY-MM-DDTHH:MM) to API target format (MM/DD/YYYY HH:MM)
    const [datePart, timePart] = appointmentDateLocal.split('T');
    const [year, month, day] = datePart.split('-');
    
    const apiFormattedDate = `${month}/${day}/${year} ${timePart}`; 
    
    const formattedData = {
        type: data.type,
        data: data.data,
        pets: data.pets,
        closer1: data.closer1,
        closer2: data.closer2,
        customers: data.customers,
        phone: data.phone,
        oldNew: data.oldNew,
        appointmentDate: apiFormattedDate, // MM/DD/YYYY HH:MM
        serviceValue: data.serviceValue,
        franchise: data.franchise,
        city: data.city,
        source: data.source,
        week: data.week,
        month: data.month,
        year: data.year,
        value: '', 
        code: document.getElementById('codePass').value,
        reminderDate: document.getElementById('reminderDate').value,
        verification: 'Scheduled',
        zipCode: data.zipCode, // Valor do campo Zip Code
        technician: technician, // Inclui o técnico selecionado
    };
    
    // ... (rest of save logic)
}

// ... (rest of the file)
