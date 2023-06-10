
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;





// middleware
app.use(cors());
app.use(express.json());



// mongodb database connect
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gspcn8d.mongodb.net/?retryWrites=true&w=majority`;

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

    const userCollection = client.db("capture-academy").collection("users");
    const paymentCollection = client.db("capture-academy").collection("payments");
    const classCollection = client.db("capture-academy").collection("classes");


    // users api
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    // instructor api
    app.get('/instructors/popular', async(req, res)=>{
      const result = await userCollection.find().limit(6).toArray();
      res.send(result);
    })

    
    app.get('/instructors', async(req, res)=>{
      const query = {role: "Instructor"};
      const result = await userCollection.find(query).toArray();
      res.send(result);
    })


    // class related  API
    app.get('/classes', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })

    app.get('/classes/popular', async (req, res) => {
      const popularClass = await classCollection.find().sort({ enrolled: -1 }).limit(6).toArray();
      res.send(popularClass);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send("Capture academy server is Running")
})

app.listen(port, () => {
  console.log(`Capture academy server is running on the port ${port}`);
})