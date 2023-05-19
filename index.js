//Imports
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config()
const ObjectId = require('mongodb').ObjectId;
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const stripe = require('stripe')(process.env.STRIPE_SECRET);


const app = express();
const port = process.env.PORT || 8000;


//Firebase Admin Initialization
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

//Node mailer details
let transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
        user: process.env.MY_MAIL,
        pass: process.env.MY_PASS
    }
});




//Middleware use for server course
app.use(cors());
app.use(express.json());


//MONGO DB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.up7gk.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Function to verify user token so that API stays secure
async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer')) {
        // Splitting the idToken by removing string "Bearer"
        const courseIdToken = req.headers.authorization.split('Bearer ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(courseIdToken);
            req.decodedUserEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}


async function run() {
    try {
        await client.connect();
        const database = client.db("courseApp");
        const usersCollection = database.collection("users");
        const coursesCollection = database.collection("courses");
        const orderCollection = database.collection("orders");
        const reviewsCollection = database.collection("reviews");


        //GET COURSES FROM DB
        app.get('/courses', async (req, res) => {
            const cursor = coursesCollection.find({});
            const page = req.query.page;
            const size = parseInt(req.query.size);
            const count = await cursor.count();
            let courses;
            if (page) {
                courses = await cursor.skip(page * size).limit(size).toArray();
            }
            else {
                courses = await cursor.toArray();
            }

            res.send({
                count,
                courses
            });
        })


        //GET SINGLE COURSE BY ID
        app.get('/course/:id', async (req, res) => {
            const id = req.params.id;
            const query1 = { _id: ObjectId(id) }
            const course = await coursesCollection.findOne(query1);
            const userEmail = req?.query?.email;
            let purchased = false;
            if (userEmail) {
                const query2 = { email: (userEmail) };
                const orderDetails = await orderCollection.find(query2).toArray();
                if (orderDetails.length) {
                    const keys = Object.keys(orderDetails[0].order)
                    for (const key of keys) {
                        if (key == course.courseID) {
                            purchased = true;
                        }
                    }
                }
            }
            res.json({
                course,
                purchased
            });
        })

        //USE POST to get data by keys
        app.post('/courses/byKeys', async (req, res) => {
            const keys = req.body;
            const query = { courseID: { $in: keys } };
            const courses = await coursesCollection.find(query).toArray();
            res.json(courses);
        })


        //Add users to database those who signed up with Email Password
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.json(result);
        })

        //Add users to database those who signed up with External Provider
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);

        })


        //Add Orders API
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const name = order.name;
            //Taking the keys of order course ID in an array
            const orderIds = (Object.keys(req.body.order));
            //Checking whether any previous order exists of same user
            const query = { email: (order.email) };
            const orderDetails = await orderCollection.findOne(query);
            console.log(order);
            console.log(orderDetails)
            let result;
            // If user exists with previous orders then Updating user's previous order details rather creating new one
            if (orderDetails) {
                for (const id of orderIds) {
                    (orderDetails.order)[id] = 1;
                }
                const filter = { _id: orderDetails._id };
                const updateDoc = {
                    $set: {
                        order: orderDetails.order,
                        payment: [...orderDetails.payment, order.payment]
                    },
                };
                result = await orderCollection.updateOne(filter, updateDoc);
            }
            //If user doesn't exists with orders then inserting new order
            else {
                order.payment = [order.payment];
                result = await orderCollection.insertOne(order);
            }

            // Sending email to user
            let mailOptions = {
                from: 'shadmansaalim321@outlook.com',
                to: order.email,
                subject: 'Course Application By Developer Saalim',
                text: `Dear ${name}, You have successfully purchased course from us. Now you can view your course in MyClasses section on our website. Thank you for being with us. This application is developed by Saalim Shadman, a Computer Science student at RMIT, Australia
                `,
            };


            transporter.sendMail(mailOptions, function (err, data) {
                if (err) {
                    console.log('Error occurred ', err)
                }
                else {
                    console.log('Email Sent');
                }
            })


            res.json(result);
        })

        app.get('/myClasses', verifyToken, async (req, res) => {
            const userEmail = req.query.email;
            if (req.decodedUserEmail === userEmail) {
                const query1 = { email: userEmail };
                //Using options to get only the order field making code efficient
                const options = {
                    projection: { _id: 0, order: 1 }
                }
                const cursor = orderCollection.find(query1, options);
                const orderDetails = await cursor.toArray();
                // Checking if user has any purchased course
                if (orderDetails.length) {
                    const keys = Object.keys(orderDetails[0].order)
                    const query2 = { courseID: { $in: keys } };
                    const courses = await coursesCollection.find(query2).toArray();
                    res.json(courses)
                }
                else {
                    res.json(0);
                }
            }
            else {
                //Sending status of unauthorization
                res.status(401).json({ message: 'User Not Authorized' })
            }
        })

        app.get('/reviews/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const cursor = reviewsCollection.find(query);
            const result = await cursor.toArray();
            console.log(result);
            res.json(result);
        })

        app.put('/reviews/:id', async (req, res) => {
            const id = req.params.id;
            const review = req.body;
            console.log(id, review)
            const filter = { _id: ObjectId(id) };
            const course = await reviewsCollection.findOne(filter);
            const courseReviews = course?.reviews
            const options = { upsert: true };
            let result;
            if (courseReviews) {
                const updateDoc = {
                    $set: {
                        reviews: [...courseReviews, review]
                    },
                };
                result = await reviewsCollection.updateOne(filter, updateDoc, options);
            }
            else {
                const updateDoc = {
                    $set: {
                        reviews: [review]
                    },
                };
                result = await reviewsCollection.updateOne(filter, updateDoc, options);
            }
            res.json(result);
        })



        app.post("/create-payment-intent", async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: "usd",
                amount: amount,
                payment_method_types: ['card']
            })
            res.json({
                clientSecret: paymentIntent.client_secret,
            });
        });

    }
    finally {
        //   await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    console.log('Hitting backend');
    res.send('Course App Backend Coming Soon')
})

app.listen(port, () => {
    console.log('Listening to port number ', port);
})

