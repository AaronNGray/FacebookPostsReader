//
//  Facebook.PostsReader
//
//    const facebook = require("./lib/facebook.js");
//    const fs = require("fs");
//
//    postsReader = new facebook.PostsReader({
//        access_token: req.session.access_token,
//        finished: function(data) { fs.writeFileSync(__dirname + "/timeline.json", JSON.stringify(data)); }
//    });
//

const FB = require('fb');
const fetch = require('node-fetch');
const _ = require("underscore");

class PostsReader {
    constructor(options) {
        this.api_version = options.api_version || "v2.8";
        this.user = options.user || "me";
        this.access_token = options.access_token;
        this.limit = options.limit || 250;
        this.accumulator = [];
        this.next = null;
        this.timer = null;
        this.rate = options.rate * 1000 || 5 * 60 * 1000;
        this.delay = options.delay * 1000 || 10 * 60 * 1000;
        this.timeout = options.timeout * 1000 || 5 * 60 * 1000;

        this.finished = options.finished || function() { console.log("finished()"); }
        this.error = options.error || function() { console.log("error()"); }

        this.fields = options.fields || allFields;
    }

    async initialize() {
        console.log("PostsReader.prototype.initialize()");
        var time = new Date();
        console.log("", time.getHours(), ": ", time.getMinutes(), ": ", time.getSeconds());

        this.next = "https://graph.facebook.com/" + this.api_version + "/me/feed" + "?" +
            "fields=" + this.fields.join(',') + "&" +
            "limit=" + this.limit + "&" +
            "access_token=" + this.access_token
        ;

        var response = await fetch(this.next, {timeout: this.timeout} );

        if (response.error)
            return this._error(response.error);

        var result = await response.json();

        if (result.error || !result.data) {
            return this._error(result.error, this.accumulator);
        }

        if (!result.paging.next) {
            this._finished(this.accumulator);
            return
        }

        console.log("result.data: ", result.data);
        this.accumulator = result.data;
        var time = new Date();
        console.log("", time.getHours(), ": ", time.getMinutes(), ": ", time.getSeconds(), " - ","this.accumulator.length = ", this.accumulator.length);

        this.next = result.paging.next;
        console.log("result.paging.next: ", result.paging.next);

        this.timer = setTimeout(_.bind(this.batch, this), this.rate);
    }

    async batch() {
        //console.log("PostsReader.prototype.batch()");

        //console.log("this.next = ", this.next);

        var response = await fetch(this.next, {timeout: this.timeout} );
        var result = await response.json();

        if (result.error && result.error.code == 1) {
            do {
                response = await fetch(this.next, {timeout: this.timeout} );
                result = await response.json();
            }
            while (result.error && result.error.code == 1);
        } else if (result.error && result.error.code == 4) {
            this.timer = setTimeout(_.bind(this.batch, this), this.delay);
            return
        }

        if (result.error || !result.data) {
            return this._error(result.error, this.accumulator);
        }

        var time = new Date();
        this.accumulator = this.accumulator.concat(result.data);
        console.log("", time.getHours(), ": ", time.getMinutes(), ": ", time.getSeconds(), " - ","this.accumulator.length = ", this.accumulator.length);

        if (result && result.data.length == 0) {
            this._finished(this.accumulator);
            return
        }

        if (result && !result.paging && !result.paging.next) {
            this._finished(this.accumulator);
            return
        }

        this.next = result.paging && result.paging.next;
        console.log("result.paging: ", result.paging);
        console.log("result.paging.next: ", result.paging && result.paging.next);

        if (typeof this.next == "string") {
            this.timer = setTimeout(_.bind(this.batch, this), this.rate);
        }
        else {
            clearTimeout(this.timer);
            this._finished(this.accumulator);
        }
    }

    _finished(data) {
        this.finished(data);
    }
    _error(error, data) {
        this.error(error, data);
    }

    static allFields = [
        'id',
        'application',
        'call_to_action',
        'caption',
        'comments',
        'created_time',
        'description',
        'feed_targeting',
        'from',
        'icon',
        //'instagram_eligibility',
        'is_hidden',
        //'is_instagram_eligible',
        'is_published',
        'likes',
        'link',
        'message',
        //'message_tags',
        'name',
        'object_id',
        'parent_id',
        'permalink_url',
        'picture',
        'place',
        'privacy',
        'properties',
        'shares',
        'source',
        'status_type',
        'story',
        'story_tags',
        'targeting',
        'to',
        'type',
        'updated_time',
        //'with_tags'
    ];

};

module.exports = PostsReader;
