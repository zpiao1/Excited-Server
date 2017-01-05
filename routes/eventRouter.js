const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const Events = require('../models/events');
const utils = require('../utils');

const eventRouter = express.Router();
eventRouter.use(bodyParser.json());

const categories = {
  sports: 'Sports and Fitness',
  art: 'Arts and Culture',
  kids: 'Kids',
  nightlife: 'Music and Nightlife'
};

// Get all the event details
eventRouter.route('/')
  .get((req, res, next) => {
    console.log(`query categories: ${req.query.categories}`);
    if (req.query.categories === 'none')
      return res.json([]);
    const queries = req.query.categories.split('|');
    const cat = queries.map(query => {
      return categories[query];
    });
    Events.find({category: {$in: cat}})
      .select({_id: 1, pictureUrl: 1, title: 1, date: 1})
      .exec((err, events) => {
        if (err) {
          return res.status(500)
            .json(utils.generateErrMsg(req, err));
        }
        res.json(events);
      });
  });

eventRouter.route('/count')
  .get((req, res, next) => {
    Events.count({}, (err, count) => {
      if (err)
        return res.status(500)
          .json(utils.generateErrMsg(req, err));
      res.json({count: count});
    });
  });

eventRouter.route('/categories')
  .get((req, res, next) => {
    Events.distinct('category', (err, categories) => {
      if (err)
        return res.status(500)
          .json(utils.generateErrMsg(req, err));
      res.json({categories: categories});
    });
  });

eventRouter.route('/:id')
  .get((req, res, next) => {
    Events.findById(req.params.id)
      .select({createdAt: 0, updatedAt: 0, __v: 0})
      .exec((err, event) => {
        if (err)
          return res.status(500)
            .json(utils.generateErrMsg(req, err));
        res.json(event);
      });
  });

module.exports = eventRouter;
