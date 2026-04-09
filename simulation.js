function randNormal() {
  var u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function sampleReactionTime(mu, sigma, dist) {
  if (dist === 'lognormal') {
    var mu_ln  = Math.log((mu * mu) / Math.sqrt((sigma * sigma) + (mu * mu)));
    var sig_ln = Math.sqrt(Math.log(1.0 + (sigma * sigma) / (mu * mu)));
    var sample = Math.exp(mu_ln + sig_ln * randNormal());
    return Math.max(1.0, sample);
  }
  if (dist === 'normal') {
    return Math.max(1.0, mu + sigma * randNormal());
  }
  return Math.max(1.0, (mu - sigma) + (2.0 * sigma * Math.random()));
}

function runTrial(p) {
  var N = p.N, E = p.E, cap = p.cap, L = p.L, v = p.v;
  var mu = p.mu, sigma = p.sigma, dist = p.dist;

  var reactionTimes = [];
  for (var i = 0; i < N; i++) {
    reactionTimes.push(sampleReactionTime(mu, sigma, dist));
  }

  var walkTime = L / v;

  var exitQueues = [];
  for (var e = 0; e < E; e++) {
    exitQueues.push([]);
  }
  for (var j = 0; j < N; j++) {
    exitQueues[j % E].push(reactionTimes[j] + walkTime);
  }

  var totalEvacTime = 0;
  var perExitQ = [];

  for (var e2 = 0; e2 < E; e2++) {
    var arrivals = exitQueues[e2].slice().sort(function(a, b) { return a - b; });
    var exitTime = 0;
    var peakQ = 0;

    for (var k = 0; k < arrivals.length; k++) {
      exitTime = Math.max(exitTime, arrivals[k]) + (1.0 / cap);

      var inQueue = 0;
      for (var m = 0; m <= k; m++) {
        if (arrivals[m] > exitTime - (arrivals.length / cap)) inQueue++;
      }
      if (inQueue > peakQ) peakQ = inQueue;
    }

    perExitQ.push(peakQ);
    if (exitTime > totalEvacTime) totalEvacTime = exitTime;
  }

  var maxQ = 0;
  for (var q = 0; q < perExitQ.length; q++) {
    if (perExitQ[q] > maxQ) maxQ = perExitQ[q];
  }

  return { T: totalEvacTime, peakQ: maxQ, perExitQ: perExitQ };
}

function monteCarlo(params, iterations) {
  var results   = [];
  var queueSums = [];
  for (var e = 0; e < params.E; e++) queueSums.push(0);

  for (var i = 0; i < iterations; i++) {
    var r = runTrial(params);
    results.push(r.T);
    for (var e2 = 0; e2 < r.perExitQ.length; e2++) {
      queueSums[e2] += r.perExitQ[e2];
    }
  }

  results.sort(function(a, b) { return a - b; });

  var sum = 0;
  for (var j = 0; j < results.length; j++) sum += results[j];
  var mean = sum / iterations;

  var varSum = 0;
  for (var k = 0; k < results.length; k++) {
    varSum += (results[k] - mean) * (results[k] - mean);
  }
  var std = Math.sqrt(varSum / iterations);

  var p95idx = Math.floor(0.95 * iterations);
  var p95 = results[Math.min(p95idx, results.length - 1)];

  var exceedCount = 0;
  for (var m = 0; m < results.length; m++) {
    if (results[m] > params.Tsafe) exceedCount++;
  }
  var exceed = exceedCount / iterations;

  var avgQ = [];
  for (var n = 0; n < queueSums.length; n++) {
    avgQ.push(parseFloat((queueSums[n] / iterations).toFixed(1)));
  }

  return {
    results: results,
    mean:    mean,
    std:     std,
    p95:     p95,
    exceed:  exceed,
    avgQ:    avgQ
  };
}

function sensitivityAnalysis(baseParams, iterations) {
  var sweeps = [
    { label: 'Mean Reaction Time (mu)', key: 'mu',    low: 15,  high: 30  },
    { label: 'Std Deviation (sigma)',   key: 'sigma', low: 5,   high: 15  },
    { label: 'Occupancy (N)',           key: 'N',     low: 100, high: 500 },
    { label: 'Exit Capacity (Ce)',      key: 'cap',   low: 1.0, high: 1.5 },
    { label: 'Path Length (L)',         key: 'L',     low: 10,  high: 50  }
  ];

  var iter = Math.min(iterations, 400);
  var rows = [];

  for (var s = 0; s < sweeps.length; s++) {
    var sw    = sweeps[s];
    var pLow  = JSON.parse(JSON.stringify(baseParams));
    var pHigh = JSON.parse(JSON.stringify(baseParams));
    pLow[sw.key]  = sw.low;
    pHigh[sw.key] = sw.high;

    var rLow  = monteCarlo(pLow,  iter);
    var rHigh = monteCarlo(pHigh, iter);

    rows.push({
      label:  sw.label,
      lowVal: sw.low,
      hiVal:  sw.high,
      lowP95: rLow.p95.toFixed(1),
      hiP95:  rHigh.p95.toFixed(1),
      delta:  Math.abs(rHigh.p95 - rLow.p95).toFixed(1)
    });
  }

  return rows;
}

function saveParams(params, results) {
  try {
    localStorage.setItem('evac_params',  JSON.stringify(params));
    localStorage.setItem('evac_results', JSON.stringify(results));
  } catch(e) {}
}

function loadParams() {
  try {
    var p = localStorage.getItem('evac_params');
    return p ? JSON.parse(p) : null;
  } catch(e) { return null; }
}

function loadResults() {
  try {
    var r = localStorage.getItem('evac_results');
    return r ? JSON.parse(r) : null;
  } catch(e) { return null; }
}