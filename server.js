var express = require('express')
var mongodb = require('mongodb')
var MongoClient = mongodb.MongoClient
var https = require('https')

var app = express()

app.set('port', (process.env.PORT || 5000))
app.enable('trust proxy')

var mongoUrl = process.env.MONGO_URI
var db;

// Initialize connection once
MongoClient.connect(mongoUrl, function(err, database) {
    if(err) throw err;
    
    db = database;
    
    // Start the application after the database connection is ready
    app.listen(app.get('port'), function() {
        console.log('Node app is running on port', app.get('port'))
    })
});

app.get('/search/:searchTerm', function(req, res) {
    db.collection('history').insertOne({
        term: req.params.searchTerm,
        timestamp: new Date()
    }, function(err, docs) {
        if (err) throw err
        
        var flickrUrl = 'https://api.flickr.com/services/rest/?method=flickr.photos.search&format=json&nojsoncallback=1&per_page=10&api_key='
        flickrUrl += process.env.FLICKR_API_KEY
        flickrUrl += '&text='
        flickrUrl += req.params.searchTerm
        
        if (req.query.offset) {
            flickrUrl += '&page='
            flickrUrl += req.query.offset
        }

        https.get(flickrUrl, function(response) {
            response.setEncoding('utf-8')
            
            var responseString = ''
            
            response.on('data', function(data) {
                responseString += data;
            })

            response.on('end', function() {
                var responseObject = JSON.parse(responseString);
                if (responseObject && responseObject.photos && responseObject.photos.photo) {
                    res.send(responseObject.photos.photo.map(function(currentValue) {
                        var item = {}
                        item.url = 'https://farm' + currentValue.farm + '.staticflickr.com/'
                        item.url += currentValue.server + '/' + currentValue.id + '_'
                        item.url += currentValue.secret + '.jpg'
                        item.alt = currentValue.title
                        item.context = 'https://www.flickr.com/photos/' + currentValue.owner + '/'
                        item.context += currentValue.id
                        return item
                    }))
                }
                res.end()
            })
            
            response.on('error', console.error)
        })
    })
})

app.get('/latest', function(req, res) {
    db.collection('history').find({}, {
        "term": true,
        "timestamp": true,
        "_id": false
    }, {
        "limit": 10,
        "sort": [['timestamp', 'desc']]
    }).toArray(function(err, docs) {
        if (err) throw err
        res.send(docs)
        res.end()
    })
})