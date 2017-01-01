const Crawler = require('crawler');
const database = require('./database');
const config = require('./config.json');
const googleMapsClient = require('@google/maps')
  .createClient({key: config.googlemapsapikey});
const request = require('request');

const baseUrl = 'http://thehoneycombers.com/singapore/event-category/';
const paths = ['kids', 'arts-and-culture', 'music-and-nightlife', 'sports-and-fitness'];
const googleMapsUrl = 'https://www.google.com.sg/maps/search/'

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
	database.save(events);
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
	if (event.venue) {
		getLatLng(event.venue, (err, obj) => {
			if (err) {
				// console.error('Error in getting latitude and longitude: ', err);
				if (event.googleMapsAlt) {
					getLatLng(event.googleMapsAlt, (err, obj) => {
						if (err)
							console.log('location: ' + obj);
						else {
							event.lat = obj.lat;
							event.lng = obj.lng;
						}
						events.push(event);
						done();
					});
				} else {
					console.log('location: ' + obj);
					events.push(event);
					done();
				}
			} else {
			  event.lat = obj.lat;
			  event.lng = obj.lng;
			  events.push(event);
		    done();
		  }
	  });
	} else {
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
	googleMapsCrawler.queue({
		uri: googleMapsUrl + location.replace(/ /g, '+'),
		callback: (err, res, done) => {
			if (err)
				return callback(err);
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