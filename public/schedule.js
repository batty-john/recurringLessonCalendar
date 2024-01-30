document.addEventListener('DOMContentLoaded', function () {

    fetchAvailableTimeSlots();

    // Fetch available time slots from the server
    function fetchAvailableTimeSlots() {
        // Fetch logic here, adjust endpoint as needed
        fetch('/available-time-slots')
            .then(response => response.json())
            .then(data => renderCalendar(data))
            .catch(error => console.error('Error:', error));
    }

    // Function to render the calendar UI
    const calendarElement = document.getElementById('calendar');
    let selectedSlot = null;

    // Function to create a day column in the calendar
    function createDayColumn(day, dayTimeSlots) {
        let columnHtml = `<div class="day-column"><h3>${day}</h3>`;
    
        dayTimeSlots.forEach(slot => {
            const formattedStartTime = formatTime(slot.start_time);
            const formattedEndTime = formatTime(slot.end_time);
            columnHtml += `<button class="button" data-slot-id="${slot.id}" onclick="selectSlot('${day}', '${slot.start_time}', '${slot.id}')">${formattedStartTime} - ${formattedEndTime}</button>`;
        });
    
        columnHtml += '</div>';
        return columnHtml;
    }
    
    

    // Function to render the calendar UI
    function renderCalendar(timeSlots) {
        let calendarContent = '<div class="week">';
        const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
        console.log("Time Slots: ", timeSlots);
        daysOfWeek.forEach(day => {
            // Filter time slots for each day of the week
            let dayTimeSlots = timeSlots.filter(slot => slot.day_of_week === day);
            calendarContent += createDayColumn(day, dayTimeSlots);
        });
    
        calendarContent += '</div>';
        calendarElement.innerHTML = calendarContent;
    }
    

    // Function to handle slot selection
    window.selectSlot = function(day, time, slotId) {
        selectedSlot = slotId;
        document.getElementById('selectedSlot').value = slotId;
        document.getElementById('bookingForm').style.display = 'block';

        // Calculate the next and following dates

        console.log("Day: ", day);
        console.log("Time: ", time);
        console.log("Slot ID: ", slotId);

        // Highlight the selected slot
    // Remove highlight from any previously selected slot
    const previouslySelected = document.querySelector('.selected-slot');
    if (previouslySelected) {
        previouslySelected.classList.remove('selected-slot');
    }

    // Add highlight to the current selected slot
    const currentSelected = document.querySelector(`button[data-slot-id="${slotId}"]`);
    if (currentSelected) {
        currentSelected.classList.add('selected-slot');
    }

    const dates = calculateDates(day);

    // Populate the dropdown with actual dates
    const startDateSelect = document.getElementById('startDate');
    startDateSelect.innerHTML = `
        <option value="">Select a starting date</option>
        <option value="${dates.next}">This Week (${dates.next})</option>
        <option value="${dates.following}">Next Week (${dates.following})</option>
    `;

    let formattedTime = formatTime(time);
    // In the selectSlot function:
document.getElementById('displayDayTime').textContent = `${day} at ${formattedTime}`;
document.getElementById('selectedDateTime').style.display = 'block';
    };



    
    
    
    
  
// Updated Function to handle form submission
document.getElementById('bookingForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const selectedSlot = document.getElementById('selectedSlot').value;
    const startDate = document.getElementById('startDate').value;
    const studentName = document.getElementById('studentName').value;
    const errorDiv = document.getElementById('formError'); // Assuming you have a div for errors

    if (!startDate) {
        event.preventDefault(); // Prevent form submission
        errorDiv.textContent = 'Please select a start date for the lesson.'; // Display error message
        errorDiv.style.display = 'block'; // Make sure error div is visible
    } else {
        errorDiv.textContent = ''; // Clear any existing error message
        errorDiv.style.display = 'none'; // Hide the error div

        window.location.href = `/checkout?slotID=${selectedSlot}&startDate=${startDate}&studentName=${studentName}`;
    }
});


});

function formatTime(timeString) {
    let [hours, minutes] = timeString.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return hours + ':' + minutes + ' ' + ampm;
}

// Helper function to format date in YYYY-MM-DD
function formatDate(date) {
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' + 
           String(date.getDate()).padStart(2, '0');
}

// Helper function to check if two dates are the same day
function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

function calculateDates(dayOfWeek) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let nextDate = new Date();
    nextDate.setHours(0, 0, 0, 0); // Reset time to start of the day

    if (!days.includes(dayOfWeek)) {
        throw new Error("Invalid day of the week");
    }

    while (days[nextDate.getDay()] !== dayOfWeek) {
        nextDate.setDate(nextDate.getDate() + 1);
    }

    let followingDate = new Date(nextDate);
    followingDate.setDate(followingDate.getDate() + 7);

    return {
        next: formatDate(nextDate),
        following: formatDate(followingDate)
    };
}
