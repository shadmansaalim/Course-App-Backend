//Imports
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config()
const ObjectId = require('mongodb').ObjectId;
const nodemailer = require("nodemailer");


const app = express();
const port = process.env.PORT || 5000;

//Middleware use
app.use(cors());
app.use(express.json());


//MONGO DB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.up7gk.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


async function run() {
    try {
        await client.connect();
        const database = client.db("courseApp");
        const coursesCollection = database.collection("courses");
        const orderCollection = database.collection("orders");

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
            const query = { _id: ObjectId(id) }
            const course = await coursesCollection.findOne(query);
            res.send(course);
        })

        //USE POST to get data by keys
        app.post('/courses/byKeys', async (req, res) => {
            const keys = req.body;
            const query = { courseID: { $in: keys } };
            const courses = await coursesCollection.find(query).toArray();
            res.json(courses);
        })

        //Add Orders API
        app.post('/orders', async (req, res) => {
            const order = req.body;
            //Taking the keys of order course ID in an array
            const orderIds = (Object.keys(req.body.order));
            //Checking whether any previous order exists of same user
            const query = { email: (order.email) };
            const orderDetails = await orderCollection.find(query).toArray();
            let result;
            //If user exists with previous orders then Updating user's previous order details rather creating new one
            if (orderDetails.length) {
                for (const id of orderIds) {
                    (orderDetails[0].order)[id] = 1;
                }
                const filter = { _id: orderDetails[0]._id };
                const updateDoc = {
                    $set: {
                        order: orderDetails[0].order
                    },
                };
                result = await orderCollection.updateOne(filter, updateDoc);
                console.log(result);
            }
            //If user doesn't exists with orders then inserting new order
            else {
                result = await orderCollection.insertOne(order);
            }
            res.json(result);

        })

        app.post('/myClasses', async (req, res) => {
            const userEmail = req.body.email;
            const query1 = { email: userEmail };
            //Using options to get only the order field making code efficient
            const options = {
                projection: { _id: 0, order: 1 }
            }
            const orderDetails = await orderCollection.find(query1, options).toArray();
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
        })



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
    console.log('Listening to port ', port);
})