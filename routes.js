const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const Events = require('./models/events');

const router = express.Router();
router.use(bodyParser.json());

const categories = {
  sports: 'Sports and Fitness',
  art: 'Arts and Culture',
  kids: 'Kids',
  nightlife: 'Music and Nightlife'
};

// Get all the event details
router.route('/events')
  .get((req, res, next) => {
    if (!req.query.categories) {
      Events.find({})
        .select({_id: 1, pictureUrl: 1, title: 1, date: 1})
        .exec((err, events) => {
          if (err)
            return res.status(500).json({
              method: '/events GET',
              err: err
            });
          res.json(events);
        });
    } else {
      const queries = req.query.categories.split('|');
      const cat = queries.map(query => {
        return categories[query];
      });
      Events.find({category: {$in: cat}})
        .select({_id: 1, pictureUrl: 1, title: 1, date: 1})
        .exec((err, events) => {
          if (err) {
            return res.status(500).json({
              method: '/events?categories=[categories]',
              err: err
            });
          }
          res.json(events);
        });
    }
  });

router.route('/events/count')
  .get((req, res, next) => {
    Events.count({}, (err, count) => {
      if (err)
        return res.status(500).json({
          method: '/events/count GET',
          err: err
        });
      res.json({count: count});
    });
  });

router.route('/events/categories')
  .get((req, res, next) => {
    Events.distinct('category', (err, categories) => {
      if (err)
        return res.status(500).json({
          method: '/events/categories GET',
          err: err
        });
      res.json({categories: categories});
    });
  });

router.route('/events/:id')
  .get((req, res, next) => {
    Events.findById(req.params.id)
      .select({createdAt: 0, updatedAt: 0, __v: 0})
      .exec((err, event) => {
        if (err)
          return res.status(500).json({
            method: '/events/' + req.params.id + ' GET',
            err: err
          });
        res.json(event);
      });
  });

module.exports = router;
