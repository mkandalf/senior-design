var imageCollector = function(expectedCount, completeFn) {
    var receivedCount = 0;
    return function() {
        if (++receivedCount === expectedCount) {
            completeFn();
        } else {
            console.log(receivedCount);
        }
    };
}();

distances = {
  euclidean: function(v1, v2) {
      var total = 0;
      for (var i = 0; i < v1.length; i++) {
         total += Math.pow(v2[i] - v1[i], 2);      
      }
      return Math.sqrt(total);
   },
   manhattan: function(v1, v2) {
     var total = 0;
     for (var i = 0; i < v1.length ; i++) {
        total += Math.abs(v2[i] - v1[i]);      
     }
     return total;
   },
   max: function(v1, v2) {
     var max = 0;
     for (var i = 0; i < v1.length; i++) {
        max = Math.max(max , Math.abs(v2[i] - v1[i]));      
     }
     return max;
   }
};

function KMeans(centroids) {
   this.centroids = centroids || [];
};

KMeans.prototype.randomCentroids = function(points, k) {
   var centroids = points.slice(0); // copy
   centroids.sort(function() {
      return (Math.round(Math.random()) - 0.5);
   });
   return centroids.slice(0, k);
};

KMeans.prototype.classify = function(point, distance) {
   var min = Infinity,
       index = 0;

   distance = distance || "euclidean";
   if (typeof distance == "string") {
      distance = distances[distance];
   }

   for (var i = 0; i < this.centroids.length; i++) {
      var dist = distance(point, this.centroids[i]);
      if (dist < min) {
         min = dist;
         index = i;
      }
   }

   return index;
};

KMeans.prototype.cluster = function(points, k, distance, snapshotPeriod, snapshotCb) {
   k = k || Math.max(2, Math.ceil(Math.sqrt(points.length / 2)));

   distance = distance || "euclidean";
   if (typeof distance == "string") {
      distance = distances[distance];
   }

   this.centroids = this.centroids || this.randomCentroids(points, k);

   var assignment = new Array(points.length);
   var clusters = new Array(k);

   var iterations = 0;
   var movement = true;
   while (movement) {
      // update point-to-centroid assignments
      for (var i = 0; i < points.length; i++) {
         assignment[i] = this.classify(points[i], distance);
      }

      // update location of each centroid
      movement = false;
      for (var j = 0; j < k; j++) {
         var assigned = [];
         for (var i = 0; i < assignment.length; i++) {
            if (assignment[i] == j) {
               assigned.push(points[i]);
            }
         }

         if (!assigned.length) {
            continue;
         }

         var centroid = this.centroids[j];
         var newCentroid = new Array(centroid.length);

         for (var g = 0; g < centroid.length; g++) {
            var sum = 0;
            for (var i = 0; i < assigned.length; i++) {
               sum += assigned[i][g];
            }
            newCentroid[g] = sum / assigned.length;

            if (newCentroid[g] != centroid[g]) {
               movement = true;
            }
         }

         this.centroids[j] = newCentroid;
         clusters[j] = assigned;
      }

      if (snapshotCb && (iterations++ % snapshotPeriod == 0)) {
         snapshotCb(clusters);
      }
   }

   return clusters;
};


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
        uniformPoint: function() {
            throw "Abstract method";
        },
        split: function(n) {
            throw "Abstract method";
        },
        contains: function(p) {
            throw "Abstract method";
        },
        distanceToMedian: function(p) {
            return Math.sqrt(Math.pow(this.median.x - p.x, 2) + Math.pow(this.median.y - p.y, 2));
        }
    };

    function Square(size, lowerLeft) {
        this.size = size;
        this.lowerLeft = lowerLeft;
        this.upperRight = {x: size + lowerLeft.x, y: size + lowerLeft.y};
        this.median = {x: this.size/2 + this.lowerLeft.x, y: this.size/2 + this.lowerLeft.y};
    }
    Square.prototype = Object.create(Region.prototype);
    Square.prototype.constructor = Square;
    Square.prototype.uniformPoint = function() {
        return {x: Math.random() * this.size + this.lowerLeft.x, y: Math.random() * this.size + this.lowerLeft.y};
    };
    Square.prototype.split = function(n) {
        if (Math.sqrt(n) * Math.sqrt(n) !== n) {
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
    Square.prototype.draw = function(ctx, scale) {
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#000000";
        ctx.strokeRect(this.lowerLeft.x * scale, this.lowerLeft.y * scale, this.size * scale, this.size * scale);
        ctx.beginPath();
        ctx.arc(scale * this.median.x - 2, scale * this.median.y - 2, 4, 0, 2 * Math.PI, false);
        //ctx.fillStyle = 'green';
        ctx.fill();
        ctx.lineWidth = 3;
        //ctx.strokeStyle = "#003300";
        ctx.stroke();
    };

    function Circle(radius, lowerLeft) {
        this.radius = radius;
        this.lowerLeft = lowerLeft;
        this.upperRight = {x: 2 * radius + lowerLeft.x, y: 2 * radius + lowerLeft.y};
        this.median = {x: this.radius + this.lowerLeft.x, y: this.radius + this.lowerLeft.y};
    }
    Circle.prototype = Object.create(Region.prototype);
    Circle.prototype.constructor = Circle;
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
    Circle.prototype.draw = function(ctx, scale) {
          ctx.beginPath();
          ctx.arc(scale * config.region.median.x, scale * config.region.median.y, scale * config.region.radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = 'green';
          //ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = "#003300";
          ctx.stroke();
    };

    function ArbitraryRegion(p) {
        this.median = {x: p.x, y: p.y};
    }
    ArbitraryRegion.prototype = Object.create(Region.prototype);
    ArbitraryRegion.prototype.constructor = ArbitraryRegion;
    ArbitraryRegion.prototype.uniformPoint = function() {
    };
    ArbitraryRegion.prototype.split = function(n) {
    };
    ArbitraryRegion.prototype.contains = function(p) {
    };
    ArbitraryRegion.prototype.draw = function(ctx, scale) {
    };

    function Line(length, lowerLeft) {
        this.length = length;
        this.lowerLeft = lowerLeft;
        this.upperRight = {x: length + lowerLeft.x, y: lowerLeft.y};
        this.median = {x: this.length / 2 + this.lowerLeft.x, y: this.lowerLeft.y};
    }
    Line.prototype = Object.create(Region.prototype);
    Line.prototype.constructor = Line;
    Line.prototype.uniformPoint = function() {
          return {x: Math.random() * this.length + this.lowerLeft.x, y: this.lowerLeft.y};
    };
    Line.prototype.split = function(n) {
        var ret = [];
        for (var i = 0; i < n; i+=1) {
              ret.push(new Line(this.length/n, {x:this.lowerLeft.x + this.length * i / n, y:this.lowerLeft.y}));
        }
        return ret;
    };
    Line.prototype.contains = function(p) {
        return (p.y == this.lowerLeft.y && this.lowerLeft.x <= p.x && this.lowerLeft.x + this.length >= p.x);
    };
    Line.prototype.draw = function(ctx, scale) {
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#000000";
        ctx.strokeRect(this.lowerLeft.x * scale, this.lowerLeft.y * scale, this.length * scale, 0);
        ctx.beginPath();
        ctx.arc(scale * this.median.x - 2, scale * this.median.y - 2, 4, 0, 2 * Math.PI, false);
        //ctx.fillStyle = 'green';
        ctx.fill();
        ctx.lineWidth = 3;
        //ctx.strokeStyle = "#003300";
        ctx.stroke();
    };

    var IDLE = 0;
    var TRANSIT = 1;
    var REPOSITIONING = 3;

    var Server = function(loc, policy, median) {
        this.median = median ? median : config.region.median;
        this.x = loc.x;
        this.y = loc.y;
        this.policy = policy;
        this.policy.maybeTakeAction = this.policy.maybeTakeAction.bind(this);
        this.policy.onNewDemand = this.policy.onNewDemand.bind(this);
        this.policy.init();
        this.demands = [];
        this.state = IDLE; // 0: idle, 1: transit, 2: service, 3: repositioning
        this.arrivalEvent = null;
    };

    var LearningStrategy = function(n) {
        this.n = n;
        this.partition = config.region.split(n);
        this.medians = [];
        for (var i = 0; i < this.partition.length; i++){
            this.medians.push([this.partition[i].median.x, this.partition[i].median.y]);
        }
        this.demandsSeen = [];
        this.servers = [];
        for (var i = 0; i < n; i+=1) {
            this.servers.push(new Server(this.partition[i].median, new ReturnPartwayToMedianPolicy(config.r), this.partition[i].median));
        }
    };
    LearningStrategy.prototype = {
        onNewDemand: function(state, queue, demand) {
            this.demandsSeen.push([demand.x, demand.y]);
            var k = new KMeans(this.medians);
            var clusters = k.cluster(this.demandsSeen, this.n);
            this.medians = k.centroids;
            for (var i = 0; i < this.partition.length; i++) {
                if (this.partition[i].contains({x: demand.x, y: demand.y})) {
                    this.servers[i].onNewDemand(state, queue, demand);
                }
            }
        },
        getServers: function() {
            return this.servers;
        },
        draw: function(ctx, scale) {
          for (var i = 0; i < this.partition.length; i++) {
            //this.partition[i].draw(ctx, scale);
            ctx.lineWidth = 5;
            ctx.strokeStyle = "#000000";
            ctx.beginPath();
            ctx.arc(scale * this.medians[i][0] - 2, scale * this.medians[i][1] - 2, 4, 0, 2 * Math.PI, false);
            //ctx.fillStyle = 'green';
            ctx.fill();
            ctx.lineWidth = 3;
            //ctx.strokeStyle = "#003300";
            ctx.stroke();
          }
        }
    };

    var PartitionStrategy = function(n) {
        this.partitions = config.region.split(n);
        var that = this;
        this.servers = this.partitions.map(function(partition) {
            return new Server(partition.median, new ReturnPartwayToMedianPolicy(config.r), partition.median);
        });
    };
    PartitionStrategy.prototype = {
        onNewDemand: function(state, queue, demand) {
            var min, minIndex;
            this.partitions.forEach(function(partition, i) {
                var d = partition.distanceToMedian({x: demand.x, y: demand.y});
                console.log(d);
                if (!min || d < min) {
                    min = d;
                    minIndex = i;
                }
            });
            this.servers[minIndex].onNewDemand(state, queue, demand);
        },
        getServers: function() {
            return this.servers;
        },
        draw: function(ctx, scale) {
            this.partitions.forEach(function(partition) {
                partition.draw(ctx, scale);
            });
        }
    };

    // TODO: Figure out multi vehicle policies
    var FCFSPolicy = {
        init: function() {
            this.demands = [];
        },
        maybeTakeAction: function(state, queue) {
            if (this.state === IDLE) {
                if (this.demands.length) {
                    this.goToDemand(state, queue, this.demands[0]);
                }
            }
        },
        onNewDemand: function(state, queue, demand) {
            this.demands.push(demand);
            this.maybeTakeAction(state, queue);
        }
    };

    var ReturnToMedianPolicy = {
        init: function() {
            this.demands = [];
        },
        maybeTakeAction: function(state, queue) {
            if (this.state === REPOSITIONING && this.demands.length) {
                this.updateCurrentLocation(state);
                queue.remove(this.arrivalEvent);
                this.arrivalEvent = null;
                this.state = IDLE;
            }
            if (this.state === IDLE) {
                if (this.demands.length) {
                    this.goToDemand(state, queue, this.demands[0]);
                } else if (this.x !== this.median.x || this.y !== this.median.y) {
                    this.state = REPOSITIONING;
                    this.goToLocation(state, queue, this.median, this.maybeTakeAction.bind(this), {str: 'Repositioned to median'});
                }
            }
        },
        onNewDemand: function(state, queue, demand) {
            this.demands.push(demand);
            this.maybeTakeAction(state, queue);
        }
    };

    var ReturnPartwayToMedianPolicy = function(alpha) {
        if (alpha <= 0 || alpha >= 1) {
            throw "Please instantiate return partway to median policy with a valid 0 < alpha < 1";
        }
        return {
            init: function() {
                this.demands = [];
                this.mustReposition = false;
            },
            maybeTakeAction: function(state, queue) {
                if (this.state === REPOSITIONING && this.demands.length) {
                    this.updateCurrentLocation(state);
                    queue.remove(this.arrivalEvent);
                    this.arrivalEvent = null;
                    this.state = IDLE;
                }
                if (this.state === IDLE) {
                    if (this.demands.length) {
                        this.mustReposition = true;
                        this.goToDemand(state, queue, this.demands[0]);
                    } else if ((this.x !== this.median.x || this.y !== this.median.y) && this.mustReposition) {
                        this.state = REPOSITIONING;
                        var destination = {
                            x: this.x + config.r * (this.median.x - this.x),
                            y: this.y + config.r * (this.median.y - this.y)
                        };
                        this.goToLocation(state, queue, destination, function(state, queue) {
                            this.mustReposition = false;
                            this.maybeTakeAction(state, queue);
                        }.bind(this), {str: 'Repositioned partway'});
                    }
                }
            },
            onNewDemand: function(state, queue, demand) {
                this.demands.push(demand);
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
            if (!this.arrivalEvent) {
              return;
            }
            var oldX = this.x;
            var oldY = this.y;
            var start = this.arrivalEvent.metadata.start;
            var destination = this.arrivalEvent.metadata.destination;
            var interp = (state.time - this.arrivalEvent.scheduledAt) /
                         (this.arrivalEvent.time - this.arrivalEvent.scheduledAt);
            this.x = start.x + (destination.x - start.x) * interp;
            this.y = start.y + (destination.y - start.y) * interp;
            stats.distanceTraveled += Math.sqrt((oldX - this.x) * (oldX - this.x) + (oldY - this.y) * (oldY - this.y));
        },
        goToDemand: function(state, queue, demand){
            var self = this;
            this.state = TRANSIT;
            this.goToLocation(state, queue, demand, function(state, queue){
                demand.service(state);
                self.demands.shift();
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
            this.arrivalEvent = queue.schedule(travelTime, function(state, queue, _cb){
                self.state = IDLE;
                self.updateCurrentLocation(state);
                self.arrivalEvent = null;
                cb(state, queue);
                _cb();
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
        config.strategy.onNewDemand(state, queue, newDemand);
    };

    var scheduleNextDemand = function(state, queue){
        var interarrivalTime = exp(config.lambda * config.n);
        var demandNum = stats.numDemands;
        stats.numDemands += 1;
        queue.schedule(interarrivalTime, function(state, queue, cb){
            addDemand(state, queue, demandNum);
            scheduleNextDemand(state, queue);
            cb();
        }, 'demand', {demandNum: demandNum, str: 'Demand appeared num ' + demandNum});
    };

    var scheduleNextAnimationFrame = function(state, queue, scale, img, ctx, demand_list, demand_dict, canvas){
        var delay = config.simulationSpeed / config.fps;
        queue.schedule(delay, function(state, queue, cb){
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            var demand_count = state['demands'].length;
            config.strategy.draw(ctx, scale);
            config.region.draw(ctx, scale);
            for (var i=0; i < demand_count; i++) {
              var coords = (state.demands[i].x * scale) + "," + (state.demands[i].y * scale);
              if (typeof(demand_dict[coords]) !== 'undefined') {
                ctx.drawImage(demand_dict[coords], (state.demands[i].x * scale) - (75/2),
                  (state.demands[i].y * scale) - (75/2), 75,75);
              }
              else {
                var random = demand_list[Math.floor(Math.random() * demand_list.length)]
                demand_dict[coords] = random;
                ctx.drawImage(random, (state.demands[i].x * scale) - (75/2),
                  (state.demands[i].y * scale) - (75/2), 75,75);
              }
            }
            for (var i = 0; i < state.servers.length; i++) {
              state.servers[i].updateCurrentLocation(state, queue);
              if (state.servers[i].arrivalEvent){
                ctx.lineWidth = 2;
                //ctx.strokeStyle = "#4440ff";
                ctx.beginPath();
                ctx.moveTo(state.servers[i].x * scale,state.servers[i].y * scale);
                ctx.lineTo(state.servers[i].arrivalEvent.metadata.start.x * scale,state.servers[i].arrivalEvent.metadata.start.y * scale);
                //ctx.lineTo(state.servers[i].arrivalEvent.metadata.destination.x * scale,state.servers[i].arrivalEvent.metadata.destination.y * scale);
                ctx.stroke();
              }
              ctx.drawImage(img, state.servers[i].x * scale - (75 / 2), state.servers[i].y * scale - (75 / 2), 75, 75);
            }
            scheduleNextAnimationFrame(state, queue, scale, img, ctx, demand_list, demand_dict, canvas);
            requestAnimationFrame(cb);
        }, 'frame');
        
    };

    function run(){
        config = {
            lambda: 2.2,
            v: 1,
            region: new Square(1, {x: 0, y: 0}),
            simulationSpeed: .2,
            fps: 1,
            r: 0.5,
            n: 4
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

        config.strategy = new LearningStrategy(config.n);
        state.servers = config.strategy.getServers();

        var canvas = document.getElementById('canvas');
        var scale = canvas.width / Math.max(config.region.upperRight.x, config.region.upperRight.y);
        var ctx = canvas.getContext('2d');
        var img = new Image();
        img.src = 'drone.png'
        var demand_srcs = ['sick.png', 'fire.png', 'food.png', 'water.png'];
        var demand_list = [];
        for (var i=0; i < demand_srcs.length; i++) {
          var demand_img = new Image();
          demand_img.src = demand_srcs[i];
          demand_list.push(demand_img);
        }
          // var ic = imageCollector(2, function(){
            ctx.drawImage(img, config.region.lowerLeft.x * scale, 
                config.region.lowerLeft.y * scale, 100, 50);
          scheduleNextDemand(state, eventQueue);
          //img.onload = function(){
          //
          scheduleNextAnimationFrame(state, eventQueue, scale, img, ctx, demand_list, {}, canvas);
          //};
          //state.servers.push(new Server(config.region.median(), FCFSPolicy));
          //state.servers.push(new Server(config.region.median(), ReturnToMedianPolicy));
          //state.servers.push(new Server(config.region.median(), new ReturnPartwayToMedianPolicy(0.5)));

          var count = 0;
          var runNext = function() {
              config.simulationSpeed = document.getElementById('slider1').value;
              config.r = document.getElementById('slider2').value;
              config.lambda = document.getElementById('slider3').value;
              var nextEvent = eventQueue.dequeue();
              state.time = nextEvent.time;
              count += 1;
              if (nextEvent.type != 'frame') {
                  console.log('(' + Math.floor(state.time * 100) / 100 + 's)', nextEvent.metadata.str);
              document.getElementById("time").innerHTML = "Average wait time of serviced demands: " + Math.floor(stats.waitTimeOfServiced / stats.numServiced * 100) / 100;
              document.getElementById("distance").innerHTML = "Average distance traveled per serviced demand: " + Math.floor(stats.distanceTraveled / stats.numDemands * 100)/  100;


              }
              nextEvent.execute(state, eventQueue, runNext);
          }
          runNext();
          //while (eventQueue.length && count < 100) {
          //}
          console.log("Average wait time of serviced demands", stats.waitTimeOfServiced / stats.numServiced);
          console.log("Average distance traveled per serviced demand", stats.distanceTraveled / stats.numDemands);
    //   });
    // img.onload = ic;
    // demand_img.onload = ic;
    }
    window.onload = run;
})();
