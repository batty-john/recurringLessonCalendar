-- Create table for Instructors
CREATE TABLE Instructors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    bio TEXT,
    experience_years INT
);

-- Create table for Lessons
CREATE TABLE Lessons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instructor_id INT,
    day_of_week VARCHAR(10),
    time_slot TIME,
    price DECIMAL(10, 2),
    FOREIGN KEY (instructor_id) REFERENCES Instructors(id)
);

-- Create table for Bookings
CREATE TABLE Bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lesson_id INT,
    student_name VARCHAR(255),
    start_date DATE,
    is_recurring BOOLEAN,
    status VARCHAR(50),
    FOREIGN KEY (lesson_id) REFERENCES Lessons(id)
);
