document.addEventListener('DOMContentLoaded', function () {
    const calendarElement = document.getElementById('calendar');
    let selectedSlot = null;

    // Function to create a day column in the calendar
    function createDayColumn(date) {
        let day = date.toDateString();
        return `<div class="day-column">
                    <h3>${day}</h3>
                    <button class="button" style="margin-bottom:10px" onclick="selectSlot('${day}', '6:30 PM')">6:30 PM</button>
                    <button class= "button" onclick="selectSlot('${day}', '7:30 PM')">7:30 PM</button>
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

    // Function to handle slot selection
    window.selectSlot = function(day, time) {
        selectedSlot = { day, time };
        // Convert day to Date object and format as YYYY-MM-DD
        const dateObject = new Date(day);
        const formattedDate = dateObject.toISOString().split('T')[0];
        document.getElementById('selectedDay').value = formattedDate;
        document.getElementById('selectedTime').value = time;
        document.getElementById('bookingForm').style.display = 'block';
    };

// Function to handle form submission
document.getElementById('bookingForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const bookingData = {
        start_date: selectedSlot.day,
        time: selectedSlot.time,
        student_name: document.getElementById('studentName').value
    };

    fetch('/api/bookings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        // Add logic to show success message or handle errors
    })
    .catch((error) => {
        console.error('Error:', error);
    });
});

});
