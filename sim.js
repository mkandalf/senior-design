(function(){
	"use strict";

	var config = {
		lambda: 0.01,
		v: 1,
	};

	var median = {x: 0.5, y: 0.5};

	var stats = {
		numDemands: 0,
		numServiced: 0,
		distanceTraveled: 0,
		waitTimeOfServiced: 0
	};

	var IDLE = 0;
	var TRANSIT = 1;
	var REPOSITIONING = 3;

	var Server = function(loc, policy) {
		this.x = loc.x;
		this.y = loc.y;
		this.policy = policy;
		this.policy.maybeTakeAction = this.policy.maybeTakeAction.bind(this);
		this.policy.onNewDemand = this.policy.onNewDemand.bind(this);
		this.state = 0; // 0: idle, 1: transit, 2: service, 3: repositioning
		this.arrivalEvent = null;
	};

	// TODO: Figure out multi vehicle policies
	var FCFSPolicy = {
		maybeTakeAction: function(state, queue) {
			if (this.state === IDLE) {
				if (state.demands.length) {
					this.goToDemand(state, queue, state.demands[0]);
				}
			}
		},
		onNewDemand: function(state, queue, demand) {
			this.maybeTakeAction(state, queue);
		}
	};

	var ReturnToMedianPolicy = {
		maybeTakeAction: function(state, queue) {
			if (this.state === REPOSITIONING && state.demands.length) {
				this.updateCurrentLocation(state);
				queue.remove(this.arrivalEvent);
				this.arrivalEvent = null;
				this.state = IDLE;
			}
			if (this.state === IDLE) {
				if (state.demands.length) {
					this.goToDemand(state, queue, state.demands[0]);
				} else if (this.x !== median.x || this.y !== median.y) {
					this.state = REPOSITIONING;
					this.goToLocation(state, queue, median, this.maybeTakeAction.bind(this), {str: 'Repositioned to median'});
				}
			}
		},
		onNewDemand: function(state, queue, demand) {
			this.maybeTakeAction(state, queue);
		}
	};

	var ReturnPartwayToMedianPolicy = function(alpha) {
		if (alpha <= 0 || alpha >= 1) {
			throw "Please instantiate return partway to median policy with a valid 0 < alpha < 1";
		}
		return {
			init: function() {
				this.mustReposition = false;
			},
			maybeTakeAction: function(state, queue) {
				if (this.state === REPOSITIONING && state.demands.length) {
					this.updateCurrentLocation(state);
					queue.remove(this.arrivalEvent);
					this.arrivalEvent = null;
					this.state = IDLE;
				}
				if (this.state === IDLE) {
					if (state.demands.length) {
						this.mustReposition = true;
						this.goToDemand(state, queue, state.demands[0]);
					} else if ((this.x !== median.x || this.y !== median.y) && this.mustReposition) {
						this.state = REPOSITIONING;
						var destination = {
							x: this.x + alpha * (median.x - this.x),
							y: this.y + alpha * (median.y - this.y)
						};
						this.goToLocation(state, queue, destination, function(state, queue) {
							this.mustReposition = false;
							this.maybeTakeAction(state, queue);
						}.bind(this), {str: 'Repositioned partway'});
					}
				}
			},
			onNewDemand: function(state, queue, demand) {
				this.maybeTakeAction(state, queue);
			}
		};
	}

	Server.prototype = {
		onNewDemand: function(state, queue, demand){
			this.policy.onNewDemand(state, queue, demand);
		},
		maybeTakeAction: function(state, queue){
			this.policy.maybeTakeAction(state, queue);
		},
		updateCurrentLocation: function(state){
			var start = this.arrivalEvent.metadata.start;
			var destination = this.arrivalEvent.metadata.destination;
			var interp = (state.time - this.arrivalEvent.scheduledAt) /
						 (this.arrivalEvent.time - this.arrivalEvent.scheduledAt);
			this.x = start.x + (destination.x - start.x) * interp;
			this.y = start.y + (destination.y - start.y) * interp;
			stats.distanceTraveled += Math.sqrt((start.x - this.x) * (start.x - this.x) + (start.y - this.y) * (start.y - this.y));
		},
		goToDemand: function(state, queue, demand){
			var self = this;
			this.state = TRANSIT;
			this.goToLocation(state, queue, demand, function(state, queue){
				demand.service(state);
				self.maybeTakeAction(state, queue);
			}, {demandNum: demand.demandNum, str: 'Arrived at demand ' + demand.demandNum});
		},
		goToLocation: function(state, queue, loc, cb, metadata){
			if (this.arrivalEvent !== null) {
				queue.remove(this.arrivalEvent);
				this.updateCurrentLocation(state);
				// Show animation to indicate path abandon?
			}
			var travelTime = Math.sqrt((loc.x - this.x) * (loc.x - this.x) +
									   (loc.y - this.y) * (loc.y - this.y)) / config.v;
			var self = this;
			var _metadata = {start: {x: self.x, y: self.y}, destination: {x: loc.x, y: loc.y}};
			for (var attrname in metadata) {
				if (metadata.hasOwnProperty(attrname)) {
					_metadata[attrname] = metadata[attrname];
				}
			}
			this.arrivalEvent = queue.schedule(travelTime, function(state, queue){
				self.state = IDLE;
				self.updateCurrentLocation(state);
				self.arrivalEvent = null;
				cb(state, queue);
			}, 'arrival', _metadata);
		}
	};

	var Demand = function(x, y, createdAt, demandNum) {
		this.x = x;
		this.y = y;
		this.createdAt = createdAt;
		this.demandNum = demandNum;
	};

	Demand.prototype = {
		service: function(state){
			// If we want service time not to be zero, we can add a callback here
			var idx = state.demands.indexOf(this);
			if (idx === -1) {
				throw "Tried to service demand twice";
			}
			state.demands.splice(idx, 1);
			stats.numServiced += 1;
			stats.waitTimeOfServiced += state.time - this.createdAt;
		}
	};

	var exp = function(lambda) {
		return (-1/lambda)*Math.log(Math.random(0,1));
	};

	var genDemand = function(state, demandNum) {
		// Can change this to do a circle...
		return new Demand(Math.random(0,1), Math.random(0,1), state.time, demandNum);
	};

	var addDemand = function(state, queue, demandNum) {
		var newDemand = genDemand(state, demandNum);
		state.demands.push(newDemand);
		for (var i = 0; i < state.servers.length; i+=1) {
			state.servers[i].onNewDemand(state, queue, newDemand);
		}
	};

	var scheduleNextDemand = function(state, queue){
		var interarrivalTime = exp(config.lambda);
		var demandNum = stats.numDemands;
		stats.numDemands += 1;
		queue.schedule(interarrivalTime, function(state, queue){
			addDemand(state, queue, demandNum);
			scheduleNextDemand(state, queue);
		}, 'demand', {demandNum: demandNum, str: 'Demand appeared num ' + demandNum});
		
	};

	function run(){
		var state = {
			time: 0,
			demands: [],
			servers: [],
			animations: []
		};

		var eventQueue = new PriorityQueue({ comparator: function(a, b) { return a.time - b.time; }});
		eventQueue.schedule = function(waitTime, execFunc, type, metadata) {
			var eventTime = state.time + waitTime;
			var data = {
				time: eventTime,
				scheduledAt: state.time,
				execute: execFunc,
				type: type,
				metadata: metadata ? metadata : null
			};
			this.queue(data);
			return data;
		};

		scheduleNextDemand(state, eventQueue);
		//state.servers.push(new Server(median, FCFSPolicy));
		//state.servers.push(new Server(median, ReturnToMedianPolicy));
		state.servers.push(new Server(median, ReturnPartwayToMedianPolicy(0.2)));

		var count = 0;
		while (eventQueue.length && count < 1000) {
			count += 1;
			var nextEvent = eventQueue.dequeue();
			state.time = nextEvent.time;
			console.log('(' + Math.floor(state.time * 100) / 100 + ')', nextEvent.metadata.str);
			nextEvent.execute(state, eventQueue);
		}
		console.log(stats.waitTimeOfServiced / stats.numServiced);
		console.log(stats.distanceTraveled / stats.numDemands);
	}
	run();
})();
