const mongoose = require('mongoose');
const url = require('url');
const Events = require('./models/events');

const mongoDbUrl = 'mongodb://localhost:27017/excited';
const db = mongoose.connection;

// configure db
db.on('error', console.error.bind(console, 'Connection Error: '));

exports.connect = (callback) => {
  mongoose.connect(mongoDbUrl);
  db.once('open', () => {
    console.log('Connected to MongoDB');
    callback();
    // repeat every hour
    setInterval(callback, 60 * 60 * 1000);
  });
};

exports.save = (events) => {
  events.forEach((event) => {
    Events.findOneAndUpdate(
      {url: event.url},
      event,
      {upsert: true},
      (err) => {
        if (err)
          console.error('Updating Error: ', err);
      });
  });
};