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
            const result = await orderCollection.insertOne(order);
            res.json(result);

        })

        app.post('/myClasses', async (req, res) => {
            const userEmail = req.body.email;
            const query1 = { email: userEmail };
            const orderDetails = await orderCollection.find(query1).toArray();
            const orderedItems = orderDetails[0].order;
            const keys = Object.keys(orderedItems)
            const query2 = { courseID: { $in: keys } };
            const courses = await coursesCollection.find(query2).toArray();
            res.json(courses)
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