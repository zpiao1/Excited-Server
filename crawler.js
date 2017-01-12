const Crawler = require('crawler');
const database = require('./database');
const config = require('./config.json');
const request = require('request');

const baseUrl = 'http://thehoneycombers.com/singapore/event-category/';
const paths = ['kids', 'arts-and-culture', 'music-and-nightlife', 'sports-and-fitness'];
const googleMapsUrl = 'https://www.google.com.sg/maps/search/';

const googleMapsClient = require('@google/maps').createClient({
  key: config.googleMapsApiKey
});

// array of links to be crawled from
const links = [];
// array of event objects to be inserted to the database
const events = [];
const urlCrawler = new Crawler({callback: onUrlCrawled});
const detailCrawler = new Crawler({callback: onDetailCrawled});
const googleMapsCrawler = new Crawler();

// configure crawlers
urlCrawler.on('drain', () => {
  // Crawl all the links in the array
  detailCrawler.queue(links);
});

detailCrawler.on('drain', () => {
  console.log('Detail crawler finished!');
  database.save(events);
});

detailCrawler.on('error', () => {
  console.log('Error in detail Crawler');
});

googleMapsCrawler.on('error', () => {
  console.log('Error in googleMapsCrawler');
});

// functions used
function crawl() {
  console.log('Start crawling');
  urlCrawler.queue(paths.map((path) => {
    return baseUrl + path;
  }));
}

function onUrlCrawled(err, res, done) {
  if (err)
    return console.error('Url Crawling Error: ', err);
  console.log('Url Crawling Succeeded: ' + res.request.uri.href);
  const $ = res.$;
  $('a[rel=bookmark]').each((index, elem) => {
    links.push($(elem).attr('href'));
  });
  // End this callback with done()
  done();
}

function onDetailCrawled(err, res, done) {
  if (err)
    return console.error('Detail Crawling Error: ', err);
  console.log('Detail Crawling Succeeded: ' + res.request.uri.href);
  const $ = res.$;
  const event = {
    url: res.request.uri.href,
    title: $('h1.entry-title').text(),
    category: $('p.entry-meta').find('a').first().text(),
    startDate: parseDate($('meta[itemprop=startDate]').attr('content')),
    endDate: parseDate($('meta[itemprop=endDate]').attr('content')),
    date: $('dt:contains(Date) + dd').text(),
    venue: $('meta[itemprop=location]').attr('content'),
    contact: $('dt:contains(Contact) + dd').text(),
    website: $('dt:contains(Website) + dd').text(),
    description: $('div[itemprop=description]').find('p').text(),
    pictureUrl: $('img.aligncenter').attr('src'),
    googleMapsAlt: $('a[target=_blank]').find('img').attr('alt')
  };
  if (event.venue) {  // if has venue
    getLatLng(event.venue, (getLatLngVenueError, obj) => {  // get lat lng from venue
      if (getLatLngVenueError) {  // error in getting lat lng from venue
        // console.error('Error in getting latitude and longitude: ', err);
        if (event.googleMapsAlt) {  // if has googleMapsAlt
          getLatLng(event.googleMapsAlt, (getLatLngGoogleMapsAltError, obj) => {  // try to get from googleMapsAlt
            if (getLatLngGoogleMapsAltError) {
              console.log('getLatLng Error: location: ' + obj);
              getLatLngFromApi(event.googleMapsAlt, (getFromApiGoogleMapsAltError, obj) => { // try to get from api using googleMapsAlt
                if (getFromApiGoogleMapsAltError) {
                  console.log('getLatLngFromApiError: location: ' + obj);
                  getLatLngFromApi(event.venue, (getFromApiVenueError, obj) => {
                    if (getFromApiVenueError) {
                      console.log('getLatLngFromApiError: location: ' + obj);
                      events.push(event);
                      done();
                    } else {
                      event.venue = obj.address;
                      event.lat = obj.lat;
                      event.lng = obj.lng;
                      events.push(event);
                      done();
                    }
                  })
                } else {
                  event.venue = obj.address;
                  event.lat = obj.lat;
                  event.lng = obj.lng;
                  events.push(event);
                  done();
                }
              });
            } else {
              event.lat = obj.lat;
              event.lng = obj.lng;
              events.push(event);
              done();
            }
          });
        } else {  // no googleMapsAlt
          console.log('NoGoogleMapsAltError: location: ' + obj);
          getLatLngFromApi(event.venue, (getFromApiVenueError, obj) => {
            if (getFromApiVenueError) {
              console.log('getFromApiVenueError: ' + obj);
              events.push(event);
              done();
            } else {
              event.venue = obj.address;
              event.lat = obj.lat;
              event.lng = obj.lng;
              events.push(event);
              done();
            }
          });
        }
      } else {  // no error in getting from venue
        event.lat = obj.lat;
        event.lng = obj.lng;
        events.push(event);
        done();
      }
    });
  } else {  // no venue
    done();
  }
}

exports.start = () => {
  database.connect(crawl);
};

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr != 'string' || dateStr == '')
    return Date.now();
  return new Date(dateStr);
}

function getLatLng(location, callback) {
  console.log(googleMapsUrl + encodeURIComponent(location));
  googleMapsCrawler.queue({
    uri: googleMapsUrl + encodeURIComponent(location),
    callback: (err, res, done) => {
      if (err)
        return callback(err, location);
      else {
        const $ = res.$;
        const script = $('head').find('script').text();
        const regExp = /cacheResponse\((.*)\)/;
        const matches = script.match(regExp);
        try {
          const json = JSON.parse(matches[1]);
          callback(null, {
            lat: json[0][0][2],
            lng: json[0][0][1]
          });
        } catch (err) {
          callback(err, location);
        }
      }
      done();
    }
  });
}

function getLatLngFromApi(location, callback) {
  if (!location.includes('Singapore') || !location.includes('singapore'))
    location += ' Singapore';
  googleMapsClient.geocode({
    address: location
  }, (err, response) => {
    if (err) {
      callback(err, location);
    } else {
      if (response.json.status !== 'OK' || response.json.results.length == 0) {
        callback(new Error('API failed to find location'), location);
      } else {
        const result = response.json.results[0];
        const obj = {
          address: result.formatted_address,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        };
        callback(null, obj);
      }
    }
  });
}