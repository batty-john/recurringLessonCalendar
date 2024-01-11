const express = require('express');
const mysql = require('mysql');

// Create a router
const router = express.Router();

// Set up your MySQL connection inside this file or import it if it's set up in a separate module
const db = require('../database');

// POST - Create a booking
router.post('/', (req, res) => {
    const newBooking = req.body;
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
