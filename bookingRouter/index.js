const express = require('express');
const mysql = require('mysql');

// Create a router
const router = express.Router();

// Set up your MySQL connection inside this file or import it if it's set up in a separate module
const db = require('../database');

// POST - Create a booking
router.post('/', (req, res) => {
    const newBooking = req.body;
    console.log(newBooking);
    // SQL query to insert a new booking into the database
    const query = 'INSERT INTO Bookings SET ?';
    db.query(query, newBooking, (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(201).send({ message: 'Booking created', bookingId: result.insertId });
        }
    });
});

// GET - Retrieve all bookings
router.get('/', (req, res) => {
    // SQL query to retrieve all bookings
    const query = 'SELECT * FROM Bookings';
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(200).send(results);
        }
    });
});

router.get('/available-time-slots', async (req, res) => {
    try {
        // You might want to modify this query based on your specific logic for determining availability
        const query = `
            SELECT ts.id, ts.instructor_id, ts.day_of_week, ts.start_time, ts.end_time
            FROM TimeSlots ts
            LEFT JOIN Bookings b ON ts.id = b.time_slot_id
            WHERE b.id IS NULL OR b.start_date > NOW()`;

        const [availableTimeSlots] = await db.query(query);
        res.json(availableTimeSlots);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching available time slots');
    }
});


// PUT - Update a booking
router.put('/:id', (req, res) => {
    const bookingId = req.params.id;
    const updatedData = req.body;
    // SQL query to update a booking
    const query = 'UPDATE Bookings SET ? WHERE id = ?';
    db.query(query, [updatedData, bookingId], (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(200).send({ message: 'Booking updated', bookingId: bookingId });
        }
    });
});

// DELETE - Delete a booking
router.delete('/:id', (req, res) => {
    const bookingId = req.params.id;
    // SQL query to delete a booking
    const query = 'DELETE FROM Bookings WHERE id = ?';
    db.query(query, bookingId, (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(200).send({ message: 'Booking deleted', bookingId: bookingId });
        }
    });
});

module.exports = router;
