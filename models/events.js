const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const eventSchema = new Schema({
  url: {type: String, required: true},
  title: {type: String, required: true}, 
  category: {type: String, required: true},
  startDate: Date,
  endDate: Date,
  date: {type: String, default: ''},
  venue: {type: String, default: ''},
  contact: {type: String, default: ''},
  website: {type: String, default: ''},
  description: {type: String, default: ''},
  pictureUrl: {type: String, default: ''},
  googleMapsAlt: {type: String, default: ''},
  lat: {type: Number, default: null},
  lng: {type: Number, default: null}
}, {timestamps: true});

const Events = mongoose.model('event', eventSchema);

module.exports = Events;
