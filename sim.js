// The largest x value from the data is 868
// The largest y value from the data is 529

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

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function Point(x, y){
  this._x = x;
  this._y = y;
};

Point.prototype.lat = function() {
  return this._x;
};
Point.prototype.lng = function() {
  return this._y;
};

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

KMeans.randomCentroids = function(points, k) {
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

   this.centroids = this.centroids || KMeans.randomCentroids(points, k);

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

    var voronoi = new Voronoi();

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

    function Rectangle(w, h, lowerLeft) {
        this.w = w;
        this.h = h;
        this.lowerLeft = lowerLeft;
        this.upperRight = {x: w + lowerLeft.x, y: h + lowerLeft.y};
        this.median = {x: this.w/2 + this.lowerLeft.x, y: this.h/2 + this.lowerLeft.y};
        this.points = _.shuffle(RAW_POINTS);
    }
    Rectangle.prototype = Object.create(Region.prototype);
    Rectangle.prototype.constructor = Rectangle;
    Rectangle.prototype.uniformPoint = function() {
        return {x: Math.random() * this.w + this.lowerLeft.x, y: Math.random() * this.h + this.lowerLeft.y};
    };
    Rectangle.prototype.betaPoint = function(alpha, beta) {
        return {x: rbeta(alpha, beta) * this.w + this.lowerLeft.x, y: rbeta(alpha, beta) * this.h + this.lowerLeft.y};
    }
    Rectangle.prototype.sample = function() {
        if (!this.points.length) {
            this.points = _.shuffle(RAW_POINTS);
        }
        var p = this.points.pop();
        var normalized = {x: p.x / 868 * this.w, y: p.y / 868 * this.w};
        return normalized;
    };
    Rectangle.prototype.split = function(n) {
        if (Math.sqrt(n) * Math.sqrt(n) !== n) {
            throw "Cannot split square into a non-square number of regions";
        }
        var root = Math.sqrt(n);
        var ret = [];
        for (var i = 0; i < root; i+=1) {
            for (var j = 0; j < root; j+=1) {
                ret.push(new Rectangle(this.w/root, this.h/root, {x:this.lowerLeft.x + this.w * i / root, y:this.lowerLeft.y + this.h * j / root}));
            }
        }
        return ret;
    };
    Rectangle.prototype.contains = function(p) {
        return (this.lowerLeft.x <= p.x && this.lowerLeft.x + this.w >= p.x) &&
               (this.lowerLeft.y <= p.y && this.lowerLeft.y + this.h >= p.y);
    };
    Rectangle.prototype.draw = function(ctx, scale) {
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#000000";
        ctx.strokeRect(this.lowerLeft.x * scale, this.lowerLeft.y * scale, this.w * scale, this.h * scale);
        ctx.beginPath();
        ctx.arc(scale * this.median.x - 2, scale * this.median.y - 2, 4, 0, 2 * Math.PI, false);
        //ctx.fillStyle = 'green';
        ctx.fill();
        ctx.lineWidth = 3;
        //ctx.strokeStyle = "#003300";
        ctx.stroke();
    };


    function Square(size, lowerLeft) {
        this.size = size;
        this.lowerLeft = lowerLeft;
        this.upperRight = {x: size + lowerLeft.x, y: size + lowerLeft.y};
        this.median = {x: this.size/2 + this.lowerLeft.x, y: this.size/2 + this.lowerLeft.y};
        this.points = _.shuffle(RAW_POINTS);
    }
    Square.prototype = Object.create(Region.prototype);
    Square.prototype.constructor = Square;
    Square.prototype.uniformPoint = function() {
        return {x: Math.random() * this.size + this.lowerLeft.x, y: Math.random() * this.size + this.lowerLeft.y};
    };
    Square.prototype.betaPoint = function(alpha, beta) {
        return {x: rbeta(alpha, beta) * this.size + this.lowerLeft.x, y: rbeta(alpha, beta) * this.size + this.lowerLeft.y};
    }
    Square.prototype.sample = function() {
        if (!this.points.length) {
            this.points = _.shuffle(RAW_POINTS);
        }
        var p = this.points.pop();
        var normalized = {x: p.x / 868, y: p.y / 868};
        return normalized;
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
        this.partitions = config.region.split(n);
        this.medians = [];
        this.originalMedians = [];
        for (var i = 0; i < this.partitions.length; i++){
            this.medians.push([this.partitions[i].median.x, this.partitions[i].median.y]);
            this.originalMedians.push([this.partitions[i].median.x, this.partitions[i].median.y]);
        }
        this.mediansChanged = true;
        this.demandsSeen = [];
        this.servers = [];
        for (var i = 0; i < n; i+=1) {
            this.servers.push(new Server(this.partitions[i].median, new ReturnPartwayToMedianPolicy(config.r), this.partitions[i].median));
        }
        this.numUnchanged = 0;
        this.computeMedians();
    };
    LearningStrategy.prototype = {
        extantMedians: function() {
          for (var i = 0; i < this.medians.length; i++){
              if (this.medians[i][0] === this.originalMedians[i][0] && this.medians[i][1] === this.originalMedians[i][1]) {
                  return true;
              }
          }
          return false;
        },
        computeMedians: function() {
          if ((this.demandsSeen.length % Math.floor(Math.sqrt(this.demandsSeen.length))) == 0) {
              this.mediansChanged = true;
              if (this.demandsSeen.length < this.n){
                var k = new KMeans(this.medians);
              } else if (this.extantMedians()) {
                var k = new KMeans(KMeans.randomCentroids(this.demandsSeen, this.n));
              } else {
                var k = new KMeans(this.medians);
              }
              var clusters = k.cluster(this.demandsSeen, this.n);
              this.clusters = clusters;
              this.medians = k.centroids;
              var availablePartitions = _.clone(this.partitions);
              var amountChanged = 0;
              var self = this;
              this.medians.forEach(function(median, i){
                var min, minIndex;
                availablePartitions.forEach(function(partition, idx){
                  var d = partition.distanceToMedian({x: median[0], y:median[1]});
                  if (min === undefined || d < min) {
                    min = d;
                    minIndex = idx;
                  }
                });
                amountChanged += min;
                availablePartitions[minIndex].median = {x: median[0], y: median[1]};
                availablePartitions.splice(minIndex, 1);
              });
              this.partitions.forEach(function(partition, idx){
                self.servers[idx].median = partition.median;
              });
              if (amountChanged <= 0.0005) {
                this.numUnchanged += 1;
              } else {
                this.numUnchanged = 0;
              }
            }
        },
        onNewDemand: function(state, queue, demand) {
            this.demandsSeen.push([demand.x, demand.y]);
            this.computeMedians();
            var min, minIndex;
            this.partitions.forEach(function(partition, i) {
                var d = partition.distanceToMedian({x: demand.x, y: demand.y});
                if (min === undefined || d < min) {
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
          var bbox = {
              xl: 0, xr: config.region.upperRight.x,
              yt: 0, yb: config.region.upperRight.y
          };
          if (this.mediansChanged) {
            var medians = this.medians.map(function(m) {
                return {x: m[0], y: bbox.yb - m[1]};
            });
            if (this.diagram) {
                voronoi.recycle(this.diagram);
            }
            this.diagram = voronoi.compute(medians, bbox);
            this.mediansChanged = false;
          }
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.strokeStyle = '#000';
          // edges
          this.diagram.edges.forEach(function(edge) {
              var v = edge.va;
              ctx.moveTo(scale*v.x, scale*(bbox.yb - v.y));
              v = edge.vb;
              ctx.lineTo(scale*v.x, scale*(bbox.yb - v.y));
          });
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.strokeStyle = '#22c';
          _.each(this.clusters, function(cluster) {
            var convexHull = new ConvexHullGrahamScan();
            if (cluster) {
              _.each(cluster, function(p) {
                convexHull.addPoint(p[0], p[1]);
              });
              //var points = _.map(cluster, function(p) {
                //return new Point(p[0], p[1]);
              //});
              //var hullPoints = [];
              //var hullPoints_size = chainHull_2D(points, points.length, hullPoints);
              var hullPoints = convexHull.getHull();
              for (var i = 0; i < hullPoints.length; i++) {
                ctx.moveTo(scale*hullPoints[i].x, scale*hullPoints[i].y);
                ctx.lineTo(scale*hullPoints[(i+1) % hullPoints.length].x, scale*hullPoints[(i+1) % hullPoints.length].y);
              }
            }
          });
          ctx.stroke();
          for (var i = 0; i < this.partitions.length; i++) {
            //this.partition[i].draw(ctx, scale);
            ctx.lineWidth = 5;
            ctx.strokeStyle = "#f00";
            ctx.beginPath();
            ctx.arc(scale * this.medians[i][0] - 2, scale * this.medians[i][1] - 2, 4, 0, 2 * Math.PI, false);
            ctx.fillStyle = '#f00';
            ctx.fill();
            ctx.lineWidth = 3;
            //ctx.strokeStyle = "#003300";
            ctx.stroke();

          }
        }
    };

    var PartitionStrategy = function(n) {
        this.partitions = config.region.split(n);
        this.servers = this.partitions.map(function(partition) {
            return new Server(partition.median, new ReturnPartwayToMedianPolicy(config.r), partition.median);
        });
        this.diagram = undefined;
    };
    PartitionStrategy.prototype = {
        onNewDemand: function(state, queue, demand) {
            var min, minIndex;
            this.partitions.forEach(function(partition, i) {
                var d = partition.distanceToMedian({x: demand.x, y: demand.y});
                if (min === undefined || d < min) {
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
            // Assume all partitions are ArbitraryRegions
            var bbox = {
                xl: 0, xr: config.region.upperRight.x,
                yt: 0, yb: config.region.upperRight.y
            };
            var medians = this.partitions.map(function(p) {
                return {x: p.median.x, y: bbox.yb - p.median.y}
            });
            if (this.diagram) {
                voronoi.recycle(this.diagram);
            }
            this.diagram = voronoi.compute(medians, bbox);
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.strokeStyle = '#000';
            // edges
            this.diagram.edges.forEach(function(edge) {
                var v = edge.va;
                ctx.moveTo(scale*v.x, scale*(bbox.yb - v.y));
                v = edge.vb;
                ctx.lineTo(scale*v.x, scale*(bbox.yb - v.y));
            });
            ctx.stroke();
            /*
            this.partitions.forEach(function(partition) {
                partition.draw(ctx, scale);
            });
            */
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
        var point;
        switch(getParameterByName('distribution')) {
            case 'uniform':
                point = config.region.uniformPoint();
                break;
            case 'beta':
                var alpha = parseInt(getParameterByName('alpha'), 10) || 4;
                var beta = parseInt(getParameterByName('beta'), 10) || 4;
                point = config.region.betaPoint(alpha, beta);
                break;
            case 'katrina':
                point = config.region.sample();
            default:
                point = config.region.sample();
                break;
        }
        return new Demand(point, state.time, demandNum);
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
            // config.region.draw(ctx, scale);
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
              ctx.drawImage(img, state.servers[i].x * scale - (60 / 2), state.servers[i].y * scale - (60 / 2), 60, 60);
            }
            config.strategy.draw(ctx, scale);
            scheduleNextAnimationFrame(state, queue, scale, img, ctx, demand_list, demand_dict, canvas);
            requestAnimationFrame(cb);
        }, 'frame');
        
    };

    function run(){
        config = {
            lambda: 2.2,
            v: 1,
            region: new Rectangle(1.461, 1, {x: 0, y: 0}),
            simulationSpeed: .2,
            fps: 30,
            r: 0.5,
            n: parseInt(getParameterByName('servers'), 10) || 4
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
