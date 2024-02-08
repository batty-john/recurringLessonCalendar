const express = require('express');
const bodyParser = require('body-parser');

module.exports = function(db, session) {
const app = express();

app.use(session);

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.set('views', __dirname);
app.set('view engine', 'ejs');



/*********************************************
 * 
 * 
 * 
 *******************************************/
app.get('/dashboard', checkAdmin, async (req, res) => {

    try {
        const [timeSlots] = await db.query('SELECT * FROM timeslots');
        const [instructors] = await db.query('SELECT * FROM instructors');
        res.render('dashboard', { timeSlots, instructors, error: null });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching data');
    }

  });

  app.get('/bulk', checkInstructor, (req, res) => {
    res.render('bulkCreateTimeSlots', { error: null });
  });

/*********************************************
 * 
 * 
 * 
 *******************************************/
  app.post('/add-time-slot', async (req, res) => {
    const { instructorId, dayOfWeek, startTime, endTime } = req.body;
    
    const query = 'INSERT INTO timeslots (instructor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)';
    
    try {
        await db.query(query, [instructorId, dayOfWeek, startTime, endTime]);
        res.send('Time slot added successfully');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding time slot');
    }
});

 
/*********************************************
 * 
 * 
 * 
 *******************************************/
function checkInstructor(req, res, next) {
    if (req.session.userRole === 'Admin' || req.session.userRole === 'Instructor') {
        next();
    } else {
        res.status(403).send("Access Denied: You do not have the correct role");
    }
}
/*********************************************
 * 
 * 
 * 
 *******************************************/
function checkAdmin(req, res, next) {
    if (req.session.userRole === 'Admin') {
        next();
    } else {
        res.status(403).send("Access Denied: You do not have the correct role");
    }
}

app.post('/bulk-create-time-slots', checkInstructor, async (req, res) => {
    const { daysOfWeek, startTime, endTime, duration, buffer, instructorId } = req.body;
    let slots = [];

    // Convert start and end times to minutes
    const startTimeInMinutes = convertTimeToMinutes(startTime);
    const endTimeInMinutes = convertTimeToMinutes(endTime);

    for (let day of daysOfWeek) {
        let currentTime = startTimeInMinutes;

        while (currentTime + parseInt(duration) <= endTimeInMinutes) {
            slots.push({ day: day, start: convertMinutesToTime(currentTime), end: convertMinutesToTime(currentTime + parseInt(duration)) });
            currentTime += parseInt(duration) + parseInt(buffer);
        }
    }

    const insertQuery = 'INSERT INTO timeslots (instructor_id, day_of_week, start_time, end_time) VALUES ?';

    let values = slots.map(slot => [
        // Assuming you have the instructorId. Replace '1' with the actual instructor ID.
        instructorId, 
        slot.day, 
        slot.start, 
        slot.end
    ]);
    
    try {
        await db.query(insertQuery, [values]);
        res.send('Time slots created');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error inserting time slots');
    }
});

function convertTimeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function convertMinutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

app.post('/delete-time-slots', async (req, res) => {
    const slotIds = req.body.slotIds;
    const query = 'DELETE FROM timeslots WHERE id IN (?)';

    try {
        await db.query(query, [Array.isArray(slotIds) ? slotIds : [slotIds]]);
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting time slots');
    }
});

app.post('/add-instructor', async (req, res) => {
    const { name, bio, experience_years } = req.body;
    const query = 'INSERT INTO instructors (name, bio, experience_years) VALUES (?, ?, ?)';

    try {
        await db.query(query, [name, bio, experience_years]);
        res.redirect('/dashboard'); // Redirect to a confirmation page or back to the form
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding instructor');
    }
});

app.get('/list-instructors', async (req, res) => {
    try {
        const [instructors] = await db.query('SELECT * FROM Instructors');
        res.render('listInstructors', { instructors });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching instructors');
    }
});

app.post('/delete-instructors', async (req, res) => {
    const instructorIds = req.body.instructorIds;
    try {
        // Convert instructorIds to an array if it's not
        const idsArray = Array.isArray(instructorIds) ? instructorIds : [instructorIds];

        // Delete time slots for these instructors
        const deleteSlotsQuery = 'DELETE FROM timeslots WHERE instructor_id IN (?)';
        await db.query(deleteSlotsQuery, [idsArray]);

        // Now, delete the instructors
        const deleteInstructorsQuery = 'DELETE FROM instructors WHERE id IN (?)';
        await db.query(deleteInstructorsQuery, [idsArray]);

        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting instructors and their time slots');
    }
});








return app;
};