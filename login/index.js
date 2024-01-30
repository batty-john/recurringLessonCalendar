const express = require('express');
const bcrypt = require('bcrypt');
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
app.get('/signup', (req, res) => {
    res.render('signup', { error: null });
  });
 
 /*********************************************
 * 
 * 
 * 
 *******************************************/
 app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  try {
      const hashedPassword = await bcrypt.hash(password, 10);  // hash the password

      const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
      const [result] = await db.query(query, [email, email, hashedPassword]);
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
      const token = await bcrypt.hash(userId.toString(), 10);
      const resetLink = `http://localhost:3000/password-reset/${userId}/${token}`;
      // Send email with reset link
      console.log(resetLink);
      res.send('Password reset link sent');
    } else {
      res.send('Username not found');
    }
  } catch(err) {
    console.log(err);
    res.send('An error occurred');
  }


});

app.get('/password-reset/:userId/:token', async (req, res) => {

  const { userId, token } = req.params;
  const query = 'SELECT * FROM users WHERE id = ?';
  try {
    const [results] = await db.query(query, [userId]);
    if (results.length > 0) {
      const match = await bcrypt.compare(userId.toString(), token);
      if (match) {
        res.render('password-reset-form', { userId, token });
      } else {
        res.send('Invalid token');
      }
    } else {
      res.send('Invalid token');
    }
  } catch(err) {
    console.log(err);
    res.send('An error occurred');
  }


});

app.post('/password-reset/:userId/:token', async (req, res) => { 

  const { userId, token } = req.params;
  const { password } = req.body;
  const match = await bcrypt.compare(userId.toString(), token);
  
  if (!match) {
    res.send('Invalid token');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const query = 'UPDATE users SET password = ? WHERE id = ?';
  try {
    const [results] = await db.query(query, [hashedPassword, userId]);
    res.send('Password updated');
  } catch(err) {
    console.log(err);
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