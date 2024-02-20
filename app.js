require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const mysql = require('mysql2/promise');
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
console.log("Stripe Secret Key: ", stripeSecretKey);
const stripe = require('stripe')(stripeSecretKey);
const bookingRouter = require('./bookingRouter'); // Import the booking router



async function startApp() {
    
    // Create a connection to the database
    const db = require('./database');
    console.log('Connected to the MySQL database');

    const app = express();
    const port = process.env.PORT || 3000;

    // Set the view engine to EJS
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.static('public'));

    const ses = session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }
    });

    const login = require('./login')(db, ses);
    app.use(login);

    const dashboard = require('./dashboard')(db, ses);
    app.use(dashboard);

    app.use(express.json());

    app.use(express.static(path.join(__dirname, 'public')));

    app.use(express.urlencoded({ extended: true }));

    // Use booking router for '/api/bookings' route
    app.use('/api/bookings', bookingRouter);

    app.get('/', (req, res) => {
        res.render('index', { isLoggedIn: req.session.userId ? true : false, isAdmin: req.session.userRole === 'Admin' ? true : false });
    });
    
    app.get('/schedule', (req, res) => {
        res.render('schedule', { isLoggedIn: req.session.userId ? true : false, isAdmin: req.session.userRole === 'Admin' ? true : false });
    });
    
    app.get('/available-time-slots', async (req, res) => {
        try {
            const query = `
                SELECT ts.id, ts.instructor_id, ts.day_of_week, ts.start_time, ts.end_time, ts.is_booked
                FROM timeslots ts
                LEFT JOIN bookings b ON ts.id = b.time_slot_id
                WHERE ts.is_booked = 0`;
    
            const [availableTimeSlots] = await db.query(query);
            res.json(availableTimeSlots);
        } catch (err) {
            console.error(err);
            res.status(500).send('Error fetching available time slots');
        }
    });

    function formatTime24To12(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = ((hours + 11) % 12 + 1); // Converts 0-23 hour to 1-12 hour
        return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
    

    app.post('/create-subscription', async (req, res) => {

        if (!req.session.userId) {
            return res.status(401).send('You must be logged in to create a subscription.');
        }

        let connection;
        try {
            connection = await db.getConnection();
            await connection.beginTransaction();
    
            // Extracting information from the request body
            const { email, name, phone, student_name, subscription_type, timeslotId, stripeToken, startDate, day_of_week, start_time, end_time, instructorName } = req.body;
            const userId = req.session.userId; // Assuming the userId is stored in session
    
            console.log("Email: ", email);
            console.log("Name: ", name);
            console.log("Phone: ", phone);
            console.log("Student Name: ", student_name);
            console.log("Subscription Type: ", subscription_type);
            console.log("Timeslot ID: ", timeslotId);
            console.log("Stripe Token: ", stripeToken);
            console.log("User ID: ", userId);
            console.log("Start Date: ", startDate);
            console.log("Day of Week: ", day_of_week);
            console.log("Start Time: ", start_time);
            console.log("End Time: ", end_time);
            console.log("Instructor Name: ", instructorName);



            // Create or retrieve Stripe customer
        let customerList = await stripe.customers.list({ email: email, limit: 1 });
        let customer;
        if (customerList.data.length === 0) {
            customer = await stripe.customers.create({
                name: name,
                email: email,
                phone: phone,
            });

            // Update user record with new Stripe customer ID
            await connection.execute('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customer.id, userId]);
        } else {
            customer = customerList.data[0];
            // Optionally, update existing customer ID in case it's not set in your database
            await connection.execute('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customer.id, userId]);
        }
    
            // Create a PaymentMethod from the provided Stripe token
            const paymentMethod = await stripe.paymentMethods.create({
                type: 'card',
                card: { token: stripeToken },
            });
    
            // Attach the PaymentMethod to the Customer
            await stripe.paymentMethods.attach(paymentMethod.id, {
                customer: customer.id,
            });
    
            // Set it as the default payment method for the customer
            await stripe.customers.update(customer.id, {
                invoice_settings: {
                    default_payment_method: paymentMethod.id,
                },
            });
    
            // Retrieve the appropriate Stripe price ID based on subscription_type
            const priceId = subscription_type === 'Weekly' ? 'price_1OhQhaF3hYaSi8nTF0fpyaRW' : 'price_1OhQhWF3hYaSi8nT74wSIR9z';
            const planName = `${subscription_type}-lessons for ${student_name} with ${instructorName}`
            const oneWeekInMilliseconds = 7 * 24 * 60 * 60 * 1000;
    
            // Create the subscription in Stripe
            const subscription = await stripe.subscriptions.create({
                customer: customer.id,
                items: [{ price: priceId }],
                metadata: { nickname: planName },
        
                expand: ['latest_invoice.payment_intent'],
            });
    
            // Insert booking details into the database
            const [booking] = await connection.execute(
                'INSERT INTO bookings (time_slot_id, user_id, student_name, start_date, stripe_subscription_id) VALUES (?, ?, ?, ?, ?)',
                [timeslotId, userId, student_name, new Date(), subscription.id]
            );

            const oneDayInSeconds = 24 * 60 * 60;
            let secondBillingDate = new Date(startDate).getTime() / 1000 + oneDayInSeconds; // The day after the first lesson in Unix timestamp

            if (subscription_type === 'Weekly') {
                // Delay the second subscription billing until day after 1st lesson
                await updateSubscriptionTrialEnd(subscription.id, secondBillingDate);
            } else if (subscription_type === 'Monthly') {
                // Delat the second subscription billing until 3 weeks and 1 day after the first lesson
                const threeWeeksInSeconds = 3 * 7 * oneDayInSeconds;
                secondBillingDate += threeWeeksInSeconds; // Adding three weeks to the second billing date for monthly subscriptions
                await updateSubscriptionTrialEnd(subscription.id, secondBillingDate);
            }


    
            // Update the timeslot to mark it as booked
            await connection.execute('UPDATE timeslots SET is_booked = 1 WHERE id = ?', [timeslotId]);
    
            await connection.commit(); // Commit the transaction


    
            const bookingConfirmation = {
                user: { name, email, phone },
                booking: {
                    id: booking.insertId,
                    student_name,
                    start_date: startDate,
                    day: day_of_week,
                    subscription_type,
                    start_time: formatTime24To12(start_time),
                    end_time: formatTime24To12(end_time),
                    instructorName,
                    location: '601 S Vernal Ave, Vernal, UT 84078',
                },
                payment: {
                    // Check if payment_intent is an object and has the necessary properties
                    amount: subscription.latest_invoice.payment_intent && 
                            subscription.latest_invoice.payment_intent.amount_received / 100,
                    date: subscription.latest_invoice.payment_intent &&
                          new Date(subscription.latest_invoice.payment_intent.created * 1000),
                    status: subscription.latest_invoice.payment_intent &&
                            subscription.latest_invoice.payment_intent.status,
                    link: subscription.latest_invoice.hosted_invoice_url,
                }
            };
            
            console.log("SUBSCRIPTION: ", subscription);
            console.log("Booking Confirmation: ", bookingConfirmation);

            // Redirect to the thank you page and pass the booking confirmation data
            res.render('thank-you', { bookingConfirmation, isLoggedIn: req.session.userId ? true : false, isAdmin: req.session.userRole === 'Admin' ? true : false});

        } catch (error) {
            if (connection) await connection.rollback(); // Rollback the transaction in case of error
            console.error('Error creating subscription and booking:', error);
            res.status(500).send('Failed to create subscription and booking');
        } finally {
            if (connection) connection.release(); // Release the connection back to the pool
        }
    });

    

    app.get('/checkout', async (req, res) => {
        try {
            // Assuming you have a mechanism to identify the logged-in user
            const userId = req.session.userId;
            if (!userId) {
                return res.redirect('/login'); // Or your login page
            }
    
            // Assuming the timeslotId is passed as a query parameter
            const timeslotId = req.query.slotID;
            if (!timeslotId) {
                return res.status(400).send("Timeslot information is missing.");
            }

            const studentName = req.query.studentName;
    
            // Fetch user details
            const [userDetails] = await db.execute('SELECT id, username, email, phone, name FROM users WHERE id = ?', [userId]);
    
            // Fetch timeslot details
            const [timeslotDetails] = await db.execute('SELECT id, instructor_id, start_time, end_time, day_of_week FROM timeslots WHERE id = ? AND is_booked = 0', [timeslotId]);
    
            if (timeslotDetails.length === 0) {
                return res.status(404).send("Timeslot not found or already booked.");
            }

            //fetch instructor details
            const [instructorDetails] = await db.execute('SELECT id, name FROM instructors WHERE id = ?', [timeslotDetails[0].instructor_id]);
            
            if (instructorDetails.length === 0) {
                return res.status(404).send("Instructor not found.");
            }
    
            console.log("Student Name: ", studentName);
            // Render the checkout page with the retrieved data
            res.render('checkout', {
                user: userDetails[0],
                timeslot: timeslotDetails[0],
                studentName: studentName,
                start_date: req.query.startDate,
                instructor: instructorDetails[0],
            });
        } catch (err) {
            console.error(err);
            res.status(500).send("Error fetching user or timeslot information.");
        }
    });

    app.get('/thank-you', (req, res) => {
        res.render('thank-you', { isLoggedIn: req.session.userId ? true : false, isAdmin: req.session.userRole === 'Admin' ? true : false, bookingConfirmation: null });
    });

    async function fetchSubscriptionsForUser(stripeCustomerId) {
        
        const subscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'active',
            expand: ['data.default_payment_method'],
        });
    
        return subscriptions.data.map(sub => {
            return {
                id: sub.id,
                status: sub.status,
                amount: sub.plan.amount / 100, // Stripe stores amount in cents
                plan: sub.metadata.nickname,
                nextBillingDate: new Date(sub.current_period_end * 1000).toISOString().split('T')[0], // Format as YYYY-MM-DD
                cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString().split('T')[0] : null,
            };
        });
    }
    

    app.get('/account', async (req, res) => {
        const userId = req.session.userId;
        if (!userId) {
            return res.redirect('/login');
        }
    
        try {
            // Fetch the user's Stripe customer ID from your database
            const [result] = await db.execute('SELECT stripe_customer_id FROM users WHERE id = ?', [userId]);
            if (result.length === 0 || !result[0].stripe_customer_id) {
                throw new Error('Stripe customer ID not found for user.');
            }
    
            const stripeCustomerId = result[0].stripe_customer_id;
            const subscriptions = await fetchSubscriptionsForUser(stripeCustomerId);
    
            res.render('manage-subscriptions', { subscriptions: subscriptions, isLoggedIn: req.session.userId ? true : false, isAdmin: req.session.userRole === 'Admin' ? true : false});
        } catch (error) {
            console.error('Failed to fetch subscriptions:', error);
            res.status(500).send('Error fetching subscriptions');
        }
    });

    app.get('/api/get-subscriptions', async (req, res) => {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ error: 'You must be logged in to view subscriptions.' });
        }
    
        try {
            // Fetch the user's Stripe customer ID from your database
            const [result] = await db.query('SELECT stripe_customer_id FROM users WHERE id = ?', [userId]);
            if (result.length === 0 || !result[0].stripe_customer_id) {
                throw new Error('Stripe customer ID not found for user.');
            }
            console.log("Result: ", result);
    
            const stripeCustomerId = result[0].stripe_customer_id;
            const subscriptions = await fetchSubscriptionsForUser(stripeCustomerId);
            console.log("Subscriptions: ", subscriptions);
    
            res.json({ subscriptions: subscriptions });
        } catch (error) {
            console.error('Failed to fetch subscriptions:', error);
            res.status(500).json({ error: 'Error fetching subscriptions' });
        }
    });
    

    async function cancelBooking(subscriptionId) {
        const connection = await db.getConnection();
        // Convert subscriptionId to a string in case it's not
        subscriptionId = String(subscriptionId);
        console.log("Subscription ID: ", subscriptionId);

        bookingId = await connection.execute('SELECT id FROM bookings WHERE stripe_subscription_id = ?', [subscriptionId]);
        if (bookingId[0].length != 0) {
            console.log("Booking ID: ", bookingId[0][0].id);
        }
        
        
        try {
            await connection.beginTransaction();
    
            // Fetch the subscription details to get the current period end date
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const currentPeriodEndDate = new Date(subscription.current_period_end * 1000);
    
            // Schedule the subscription for cancellation at the end of the billing period
            await stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: true,
            });
    
            if (bookingId[0].length != 0) {
                // Fetch the time_slot_id from the booking
            const [bookings] = await connection.execute('SELECT time_slot_id FROM bookings WHERE id = ?', [bookingId[0][0].id]);
            if (bookings.length === 0) {
                throw new Error('No booking found with the given ID.');
            }
            const timeslotId = bookings[0].time_slot_id;
    
            // Update the end_date of the booking
            await connection.execute('UPDATE bookings SET end_date = ? WHERE id = ?', [currentPeriodEndDate, bookingId[0][0].id]);
    
            // Set the is_booked flag of the timeslot to 0
            await connection.execute('UPDATE timeslots SET is_booked = 0 WHERE id = ?', [timeslotId]);
            }  
            
    
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
    

    app.post('/cancel-subscription', async (req, res) => {
        const { subscriptionId } = req.body;
        const userId = req.session.userId;
        const bookingID = req.body.bookingID;
        if (!userId) {
            // Redirect to login if the user is not logged in
            return res.redirect('/login');
        }
    
        try {
            // Cancel the subscription using Stripe API or update your database
            // This is a placeholder for the actual logic
            await cancelBooking(subscriptionId);
    
            res.json({ success: true });
        } catch (error) {
            console.error('Failed to cancel subscription:', error);
            res.status(500).json({ success: false, message: 'Error cancelling subscription' });
        }
    });

    async function delaySubscriptionBilling(bookingId, delayLength = (7 * 24 * 60 * 60 * 1000)) {
        const connection = await pool.getConnection();
    
        try {
            await connection.beginTransaction();
    
            // Fetch the Stripe subscription ID for the given booking
            const [rows] = await connection.query('SELECT stripe_subscription_id FROM bookings WHERE id = ?', [bookingId]);
            
            if (rows.length === 0) {
                throw new Error('No booking found with the given ID.');
            }
    
            const stripeSubscriptionId = rows[0].stripe_subscription_id;
    
            // Fetch the subscription from Stripe
            const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    
            // Calculate new billing cycle start date (delayed by 1 week)
            const currentPeriodStart = new Date(subscription.current_period_start * 1000);
            const delayedBillingDate = new Date(currentPeriodStart.getTime() + delayLength);
    
            // Update the subscription's billing cycle
            await stripe.subscriptions.update(stripeSubscriptionId, {
                billing_cycle_anchor: Math.floor(delayedBillingDate.getTime() / 1000),
                proration_behavior: 'none', // Set to 'none' to avoid prorations
            });
    
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
 * Updates the trial end for a given subscription.
 * 
 * @param {string} subscriptionId The ID of the subscription to update.
 * @param {number} newTrialEndUnixTimestamp The new end date for the trial period.
 * @returns {Promise<Stripe.Subscription>} The updated subscription object.
 */
    async function updateSubscriptionTrialEnd(subscriptionId, newTrialEndUnixTimestamp) {
        try {
          const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
            trial_end: newTrialEndUnixTimestamp,
            proration_behavior: 'none',
          });
      
          console.log('Subscription trial end updated successfully.');
          return updatedSubscription;
        } catch (error) {
          console.error('Failed to update subscription trial end:', error);
          throw error;
        }
      }
      
    
    
  /**
 * Extends the trial end for a given subscription by a specified duration from the next invoice date.
 * 
 * @param {string} subscriptionId The ID of the subscription to update.
 * @param {number} durationInMilliseconds The duration to extend the trial, in milliseconds.
 * @returns {Promise<Stripe.Subscription>} The updated subscription object.
 */
async function extendTrialFromNextInvoice(subscriptionId, durationInMilliseconds) {
    try {
      // Retrieve the current subscription
      const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  
      // Check if there is a next invoice date
      if (!currentSubscription.current_period_end) {
        throw new Error('No next invoice date found for subscription.');
      }
  
      // Calculate the new trial end timestamp
      const nextInvoiceTimestamp = currentSubscription.current_period_end;
      const newTrialEndUnix = nextInvoiceTimestamp + Math.floor(durationInMilliseconds / 1000);
  
      // Update the subscription with the new trial end date
      const updatedSubscription = await stripe.subscriptions.update(
        subscriptionId,
        {
          trial_end: newTrialEndUnix,
          proration_behavior: 'none',
        }
      );
  
      console.log('Subscription trial end extended successfully.');
      return updatedSubscription;
    } catch (error) {
      console.error('Failed to extend subscription trial end:', error);
      throw error; // Rethrow or handle error as appropriate for your application
    }
  }  
    
    

    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
}

startApp().catch(err => {
    console.error('Failed to start app:', err);
    process.exit(1);
});

