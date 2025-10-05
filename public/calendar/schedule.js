function renderScheduler() {
    schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
    schedulerBody.innerHTML = '';
    const columnMap = {};

    DAY_NAMES.forEach((dayName, dayIndex) => {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + dayIndex);
        const dateKey = formatDateToYYYYMMDD(date);
        columnMap[dateKey] = dayIndex + 2;
        const header = document.createElement('div');
        header.className = 'day-column-header p-2 font-semibold border-l border-border';
        header.style.gridColumn = columnMap[dateKey];
        header.textContent = `${dayName} ${date.getDate()}`;
        schedulerHeader.appendChild(header);
    });

    TIME_SLOTS.forEach((time, rowIndex) => {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'time-slot timeline-header p-2 text-xs font-medium border-t border-border flex items-center justify-center';
        timeDiv.textContent = time;
        timeDiv.style.gridRow = `${rowIndex + 1} / span 1`;
        schedulerBody.appendChild(timeDiv);
    });

    DAY_NAMES.forEach((dayName, dayIndex) => {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + dayIndex);
        const dateKey = formatDateToYYYYMMDD(date);
        const column = dayIndex + 2;

        const dayContainer = document.createElement('div');
        dayContainer.className = 'relative border-r border-border';
        dayContainer.style.gridColumn = column;
        dayContainer.style.gridRow = `1 / span ${TIME_SLOTS.length}`;
        dayContainer.dataset.dateKey = dateKey;

        TIME_SLOTS.forEach((_, rowIndex) => {
            const line = document.createElement('div');
            line.className = 'absolute w-full border-t border-border/50';
            line.style.height = '1px';
            line.style.top = `${(rowIndex + 1) * SLOT_HEIGHT_PX}px`;
            dayContainer.appendChild(line);
        });
        schedulerBody.appendChild(dayContainer);
    });

    renderAppointments();
    renderTimeBlocks();
    updateWeekDisplay();
    loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
}
