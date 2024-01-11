document.addEventListener('DOMContentLoaded', function () {
    const calendarElement = document.getElementById('calendar');
    let selectedSlot = null;

    // Function to create a day column in the calendar
    function createDayColumn(date) {
        let day = date.toDateString();
        return `<div class="day-column">
                    <h3>${day}</h3>
                    <button onclick="selectSlot('${day}', '6:30 PM')">6:30 PM</button>
                    <button onclick="selectSlot('${day}', '7:30 PM')">7:30 PM</button>
                </div>`;
    }

    // Function to render the calendar UI
    function renderCalendar() {
        let calendarContent = '<div class="week">';
        let date = new Date();
        for (let i = 0; i < 7; i++) { // Display next 7 days
            calendarContent += createDayColumn(date);
            date.setDate(date.getDate() + 1);
        }
        calendarContent += '</div>';
        calendarElement.innerHTML = calendarContent;
    }

    // Function to handle slot selection
    window.selectSlot = function(day, time) {
        selectedSlot = { day, time };
        console.log("Selected Slot: ", selectedSlot);
        // This is where a form or confirmation step would be added
    }

    renderCalendar();
});
