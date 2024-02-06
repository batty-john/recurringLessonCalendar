const express = require('express');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const crypto = require('crypto');

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
app.get('/signup', (req, res) => {
    res.render('signup', { error: null });
  });
 
 /*********************************************
 * 
 * 
 * 
 *******************************************/
 app.post('/signup', async (req, res) => {
  const { email, password, phone, name } = req.body;
  try {
      const hashedPassword = await bcrypt.hash(password, 10);  // hash the password

      const query = 'INSERT INTO users (username, email, phone, password, name) VALUES (?, ?, ?, ?, ?)';
      const [result] = await db.query(query, [email, email, phone, hashedPassword, name]);
      res.redirect('/login');
  } catch (err) {
      console.log(err);

      if (err.code === 'ER_DUP_ENTRY') {
          // Handle duplicate entry (e.g., username or email already exists)
          res.render('signup', { error: 'Email already in use. Please try a different one.' });

      } else {
          // Handle other errors generically
          res.render('signup', { error: 'Error signing up, please try again' });
      }
  }
});

/*********************************************
 * 
 * 
 * 
 *******************************************/
app.get('/login', (req, res) => {
    res.render('login');
  });

  /*********************************************
 * 
 * 
 * 
 *******************************************/
app.get('/password-reset', (req, res) => {
  res.render('password-reset');
});

  /*********************************************
 * 
 * 
 * 
 *******************************************/
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});



app.post('/requestResetPassword', async (req, res) => {
  const { username } = req.body;
  const query = 'SELECT * FROM users WHERE username = ?';

  try {
    const [results] = await db.query(query, [username]);
    if (results.length > 0) {
      const userId = results[0].id;
      const token = crypto.randomBytes(20).toString('hex');

      // Token expires in 1 hour
      const expires = new Date(Date.now() + 3600000);

      const updateQuery = 'UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE id = ?';
      await db.query(updateQuery, [token, expires, userId]);

      const resetLink = `http://localhost:3000/password-reset/${token}`;
      // TODO: Implement email sending functionality here
      console.log(resetLink);
      res.send('Password reset link sent.');
    } else {
      res.send('Username not found.');
    }
  } catch (err) {
    console.error(err);
    res.send('An error occurred.');
  }
});

app.get('/password-reset/:token', async (req, res) => {
  const { token } = req.params;
  const query = 'SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > NOW()';

  try {
    const [results] = await db.query(query, [token]);
    if (results.length > 0) {
      res.render('password-reset-form', { token }); // Only need to pass the token
    } else {
      res.send('Invalid or expired token');
    }
  } catch (err) {
    console.error(err);
    res.send('An error occurred');
  }
});

app.post('/password-reset/:token', async (req, res) => { 
  const { token } = req.params;
  const { password } = req.body;

  // Find user by token and ensure token hasn't expired
  const selectQuery = 'SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > NOW()';

  try {
    const [userResults] = await db.query(selectQuery, [token]);
    if (userResults.length === 0) {
      res.send('Invalid or expired token');
      return;
    }

    const userId = userResults[0].id;
    const hashedPassword = await bcrypt.hash(password, 10);
    const updateQuery = 'UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?';

    await db.query(updateQuery, [hashedPassword, userId]);
    res.send('Password updated successfully');
  } catch (err) {
    console.error(err);
    res.send('An error occurred');
  }
});



  /*********************************************
 * 
 * 
 * 
 *******************************************/
  app.post('/login', async (req, res) => {
    const { username, password } = req.body;
  
    const query = 'SELECT * FROM users WHERE username = ?';
    try {
      const [results] = await db.query(query, [username]);
      if (results.length > 0) {
        const match = await bcrypt.compare(password, results[0].password);
        if (match) {
          req.session.userId = results[0].id;
          req.session.userRole = results[0].role;
          res.redirect('/');
        } else {
          res.send('Username or password incorrect');
        }
      } else {
        res.send('Username or password incorrect');
      }
    } catch(err) {
      console.log(err);
      res.send('An error occurred');
    }
  });
return app;
};