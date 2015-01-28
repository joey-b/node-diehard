/*jslint indent:2*/
/*global require:true, module:true, console:true, process:true*/

(function () {
  'use strict';

  var async = require('async'),
    debug = require('debug')('diehard'),
    Diehard;

  Diehard = function (handlers) {
    this.handlers = handlers;
  };

  Diehard.prototype.register = function (handler) {
    if (!handler) {
      throw new Error('You must pass a handler to diehard#register.');
    }
    this.handlers.push(handler);
    debug('Handler registered.');
  };

  Diehard.prototype.die = function (signal, uncaughtErr) {
    if (uncaughtErr) {
      console.log(uncaughtErr);
    }

    var handlers = [];

    // remove all handlers from shared state
    while (this.handlers.length) {
      handlers.push(this.handlers.pop());
    }

    handlers = handlers
      .map(function (handler) {
        // transform given handler into a function that takes the signature: (signal, uncaughtErr, done)
        if (handler.length === 0) {
          // we were passed a synchronous handler
          /*jslint unparam:true*/
          return function (signal, uncaughtErr, done) {
            handler();
            done();
          };
        } else if (handler.length === 1) {
          /*jslint unparam:true*/
          return function (signal, uncaughtErr, done) {
            handler(done);
          };
        } else if (handler.length === 2) {
          /*jslint unparam:true*/
          return function (signal, uncaughtErr, done) {
            handler(signal, done);
          };
        } else if (handler.length === 3) {
          return handler;
        } else {
          throw new Error('Invalid handler passed to diehard.');
        }
      })
      .map(function (handler) {
        // wrap the handler in a function that async.parallel can call
        return function (done) {
          debug('Calling handler...');
          handler(signal, uncaughtErr, done);
        };
      });

    debug(handlers.length + ' handlers are registered.');
    debug('Attempting to exit gracefully...');
    async.parallel(handlers, function (err) {
      if (err) {
        console.log(err);
      } else {
        debug('... graceful exit completed successfully.');
      }

      if (uncaughtErr || err) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    });
  };

  Diehard.prototype.listen = function (options) {
    var ON_DEATH = require('death')(options || { uncaughtException: true });
    ON_DEATH(this.die.bind(this));
  };

  module.exports = Diehard;

}());

