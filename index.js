
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');




// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    res.status(401).send({ error: true, message: "unauthorized access" })
  }

  // barer token
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: "invalid token" })
    }
    req.decoded = decoded;
    next();
  })

}


// mongodb database connect
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const pendingClassCollection = client.db("capture-academy").collection("pending-classes");
    const selectedClassCollection = client.db("capture-academy").collection("selected-class");


    // JWT TOKEN created
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_TOKEN, { expiresIn: '1d' })
      res.send({ token });
    })

    // admin verify
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      next();
    }

    // verify instructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== 'Instructor') {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      next();
    }



    // users api
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    // save a new user
    app.post('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const user = req.body;
      const userEmail = user.email;
      const query = { email: userEmail };

      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exist' })
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    // student payment
    // crate payment intent 
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payment history getting 
    app.get('/payments', verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const query = { email: email }
      const result = await paymentCollection.find(query).sort({ date: 1 }).toArray();
      res.send(result);
    })

    // posting payment history
    app.post('/payment', verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    })

    // getting admin
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query);

      const result = { admin: user?.role === 'admin' };
      res.send(result);
    })


    app.patch('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);

    })



    app.patch('/users/instructor/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'Instructor'
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);

    })


    // instructor related api

    // getting Instructor
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ Instructor: false })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query);

      const result = { Instructor: user?.role === 'Instructor' };
      res.send(result);
    })


    // instructor add class
    app.post('/class', verifyJWT, async (req, res) => {
      const classes = req.body;
      const result = await classCollection.insertOne(classes);
      res.send(result)
    })

    // instructor getting classes
       app.get('/my-classes', verifyJWT, async (req, res) => {
        const email = req.query.email;
        if (!email) {
          res.send([]);
        }
  
        const decodedEmail = req.decoded.email;
        if (email !== decodedEmail) {
          return res.status(403).send({ error: true, message: "Forbidden access" })
        }
  
        const query = { email: email };
        const result = await classCollection.find(query).toArray();
        res.send(result);
      })

      
      // instructor getting his class for update
    app.get('/update-class/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);

      res.send(result);
    })


         // update a class info
         app.put('/my-class/update/:id',verifyJWT, verifyInstructor, async(req, res) =>{
          const id = req.params.id;
          const filter = {_id: new ObjectId(id)};
          const options = {upsert: true};
          const classItem = req.body;

          // getting updated info 
          const updateClass = {
              $set: {
                  price: classItem.price, 
                  totalSeats: classItem.totalSeats, 
                  name: classItem.name, 
                  image: classItem.image, 
                  instructorName: classItem.instructorName  
              }
          }

          const result = await classCollection.updateOne(filter, updateClass, options)
          
          res.send(result);
      })




      // instructor deleting his class
    app.delete('/my-class/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.deleteOne(query);

      res.send(result);
    })


    app.get('/instructors/popular', async (req, res) => {
      const result = await userCollection.find().limit(6).toArray();
      res.send(result);
    })


    app.get('/instructors', async (req, res) => {
      const query = { role: "Instructor" };
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


    // selected class add
    app.get('/selected-class', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Forbidden access" })
      }

      const query = { email: email };
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    })

    // delete selected class 
    app.delete('/selected-class/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);

      res.send(result);
    })





    app.post('/selected-class', async (req, res) => {
      const selectedClass = req.body;
      const result = await selectedClassCollection.insertOne(selectedClass);
      res.send(result);
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