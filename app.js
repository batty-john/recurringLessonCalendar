const express = require('express');
const path = require('path');
const mysql = require('mysql');
const bookingRouter = require('./bookingRouter'); // Import the booking router

require('dotenv').config();

const db = require('./database');
console.log(db); // Check what is being imported

db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL database');
});

const app = express();
const port = 3000;

app.use(express.json()); // Middleware to parse JSON bodies

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Use booking router for '/api/bookings' route
app.use('/api/bookings', bookingRouter);

// Route for the homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route for the 'Schedule a Lesson' page
app.get('/schedule', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'schedule.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
