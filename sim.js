(function(){
    "use strict";

    var config;

    var stats = {
        numDemands: 0,
        numServiced: 0,
        distanceTraveled: 0,
        waitTimeOfServiced: 0
    };

    function Region() {
        if (this.constructor === Region) {
            throw "Can't instantiate abstract class";
        }
    }

    Region.prototype = {
        median: function() {
            throw "Abstract method";
        },
        uniformPoint: function() {
            throw "Abstract method";
        },
        split: function(n) {
            throw "Abstract method";
        },
        contains: function(p) {
            throw "Abstract method";
        }
    };

    function Square(size, lowerLeft) {
        this.size = size;
        this.lowerLeft = lowerLeft;
    }
    Square.prototype = Object.create(Region.prototype);
    Square.prototype.constructor = Square;
    Square.prototype.median = function() {
        return {x: this.size/2 + this.lowerLeft.x, y: this.size/2 + this.lowerLeft.y};
    };
    Square.prototype.uniformPoint = function() {
        return {x: Math.random() * this.size + this.lowerLeft.x, y: Math.random * this.size + this.lowerLeft.y};
    };
    Square.prototype.split = function(n) {
        if (Math.sqrt(n)*Math.sqrt(n) !== n) {
            throw "Cannot split square into a non-square number of regions";
        }
        var root = Math.sqrt(n);
        var ret = [];
        for (var i = 0; i < root; i+=1) {
            for (var j = 0; j < root; j+=1) {
                ret.push(new Square(this.size/root, {x:this.lowerLeft.x + this.size * i / root, y:this.lowerLeft.y + this.size * j / root}));
            }
        }
        return ret;
    };
    Square.prototype.contains = function(p) {
        return (this.lowerLeft.x <= p.x && this.lowerLeft.x + this.size >= p.x) &&
               (this.lowerLeft.y <= p.y && this.lowerLeft.y + this.size >= p.y);
    };

    function Circle(radius, lowerLeft) {
        this.radius = radius;
        this.lowerLeft = lowerLeft;
    }
    Circle.prototype = Object.create(Region.prototype);
    Circle.prototype.constructor = Circle;
    Circle.prototype.median = function() {
        return {x: this.radius + this.lowerLeft.x, y: this.radius + this.lowerLeft.y};
    };
    Circle.prototype.uniformPoint = function() {
        while (true) {
            var test = {x: Math.random() * this.radius * 2 + this.lowerLeft.x, y: Math.random() * this.radius * 2 + this.lowerLeft.y};
            if (this.contains(test)) {
                return test;
            }
        }
    };
    Circle.prototype.split = function(n) {
        throw "unimplemented";
    };
    Circle.prototype.contains = function(p) {
        var shifted = {
            x: p.x - this.lowerLeft.x - this.radius,
            y: p.y - this.lowerLeft.y - this.radius
        };
        if (shifted.x * shifted.x + shifted.y * shifted.y <= this.radius * this.radius) {
            return true;
        }
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
                } else if (this.x !== config.region.median().x || this.y !== config.region.median().y) {
                    this.state = REPOSITIONING;
                    this.goToLocation(state, queue, config.region.median(), this.maybeTakeAction.bind(this), {str: 'Repositioned to median'});
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
                    } else if ((this.x !== config.region.median().x || this.y !== config.region.median().y) && this.mustReposition) {
                        this.state = REPOSITIONING;
                        var destination = {
                            x: this.x + alpha * (config.region.median().x - this.x),
                            y: this.y + alpha * (config.region.median().y - this.y)
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
    };

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

    var Demand = function(loc, createdAt, demandNum) {
        this.x = loc.x;
        this.y = loc.y;
        this.createdAt = createdAt;
        this.demandNum = demandNum;
    };

    Demand.prototype = {
        service: function(state){
            // If we want service time not to be zero, we can add a callback here
            // TODO: Add demand serviced animation to animation list here, if necessary
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
        return new Demand(config.region.uniformPoint(), state.time, demandNum);
    };

    var addDemand = function(state, queue, demandNum) {
        var newDemand = genDemand(state, demandNum);
        // TODO: Add demand creation animation to animation list here, if necessary
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

    var scheduleNextAnimationFrame = function(state, queue){
        var delay = config.simulationSpeed / config.fps;
        queue.schedule(delay, function(state, queue){
            // TODO: Render frame here
            scheduleNextAnimationFrame(state, queue);
        }, 'frame');
        
    };

    function run(){
        config = {
            lambda: 0.1,
            v: 1,
            region: new Circle(0.5, {x: 0, y: 0}),
            simulationSpeed: 1,
            fps: 30
        };

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
                metadata: metadata ? metadata : {}
            };
            this.queue(data);
            return data;
        };

        scheduleNextDemand(state, eventQueue);
        scheduleNextAnimationFrame(state, eventQueue);
        //state.servers.push(new Server(config.region.median(), FCFSPolicy));
        //state.servers.push(new Server(config.region.median(), ReturnToMedianPolicy));
        state.servers.push(new Server(config.region.median(), new ReturnPartwayToMedianPolicy(0.5)));

        var count = 0;
        while (eventQueue.length && count < 100) {
            var nextEvent = eventQueue.dequeue();
            state.time = nextEvent.time;
            if (nextEvent.type != 'frame') {
                count += 1;
                console.log('(' + Math.floor(state.time * 100) / 100 + 's)', nextEvent.metadata.str);
            }
            nextEvent.execute(state, eventQueue);
        }
        console.log("Average wait time of serviced demands", stats.waitTimeOfServiced / stats.numServiced);
        console.log("Average distance traveled per serviced demand", stats.distanceTraveled / stats.numDemands);
    }
    run();
})();
