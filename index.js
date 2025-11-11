const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

//middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!')
})
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@shworddb.sx7qtlu.mongodb.net/?appName=SHWordDB`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const db = client.db('homigo_db');
        const servicesCollection = db.collection('services');
        const userInfoCollection = db.collection('userInfo');


        //get all services
        app.get('/services', async (req, res) => {
            const result = await servicesCollection
                .find().toArray();
            res.send(result);
        });

        // GET /services/top-rated
        app.get('/services/top-rated', async (req, res) => {
            try {
                const result = await servicesCollection
                    .find()
                    .sort({ ratings: -1 })
                    .limit(6)
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({ error: "Failed to fetch top-rated services" });
            }
        });


        // add services
        app.post('/service', async (req, res) => {
            const service = req.body;
            // service.createdAt = new Date();
            await servicesCollection.insertOne(service);
            res.send({ success: true, service });
        });


        app.get('/user/services', async (req, res) => {
            const email = req.query.email;
            const services = await servicesCollection
                .find({ email }).toArray();
            res.send(services);
        });

        // app.get('/user/services/:id', async (req, res) => {
        //     const email = req.query.email;
        //     const services = await servicesCollection
        //         .find({ email }).toArray();
        //     res.send(services);
        // });



        app.get('/userInfo', async (req, res) => {
            const result = await userInfoCollection
                .find().toArray();
            res.send(result);
        });


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);