const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Enable CORS
app.use(cors());
app.use(bodyParser.json());

// Replace this MongoDB Atlas connection string with your actual connection string


// Connect to MongoDB Atlas
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Get the default connection
const db = mongoose.connection;

// Bind connection to error event (to get notification of connection errors)
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
// Bind connection to open event (to get notification when connection is established)
db.once('open', () => {
  console.log('MongoDB connection successful');
});

// Define schema for speeding events including additional details
const speedingEventSchema = new mongoose.Schema({
  name: String,
  phone: String,
  vehicleType: String,
  vehicleNo: String,
  speed: Number, // Include 'speed' field in the schema
  timestamp: Date,
});

// Create model for speeding events
const SpeedingEvent = mongoose.model('SpeedingEvent', speedingEventSchema);

// Endpoint to receive speeding vehicle details including name, phone, vehicle type, vehicle number, and speed
app.post('/api/speedexceedlimit', async (req, res) => {
  const { name, phone, vehicleType, vehicleNo, speed } = req.body; // Include 'speed' in request body
  const timestamp = new Date();
  const speedingEvent = new SpeedingEvent({ name, phone, vehicleType, vehicleNo, speed, timestamp }); // Include 'speed' in the object
  await speedingEvent.save();
  // Notify connected clients about the speeding event
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'speeding', name, phone, vehicleType, vehicleNo, speed, timestamp })); // Include 'speed' in the message
    }
  });
  res.sendStatus(200);
});

// WebSocket server
wss.on('connection', async (ws) => {
  console.log('Client connected');
  // Send speeding events for the past 24 hours to client on connection
  try {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1);
    const events = await SpeedingEvent.find({ timestamp: { $gte: twentyFourHoursAgo } });
    ws.send(JSON.stringify({ type: 'initial', speedingEvents: events }));
  } catch (error) {
    console.error('Error retrieving speeding events:', error);
  }
});

server.listen(7000, () => {
  console.log('Server started on port 7000');
});
