// ─────────────────────────────────────────────
//  BUILDING TYPE PRESETS
// ─────────────────────────────────────────────
var BUILDING_PRESETS = {
  office: {
    label:       'Office',
    N:           200,
    E:           3,
    cap:         1.2,
    L:           30,
    mu:          22,
    sigma:       7,
    v:           1.2,
    Tsafe:       180,
    dist:        'lognormal',
    description: 'Staff know exits well. Slight elevator-attempt delay added to reaction time.'
  },
  school: {
    label:       'School',
    N:           300,
    E:           4,
    cap:         1.0,
    L:           40,
    mu:          60,
    sigma:       20,
    v:           0.8,
    Tsafe:       240,
    dist:        'lognormal',
    description: 'Teachers gather classes before moving. Groups assigned to drill exits. Slower walking speed.'
  },
  mall: {
    label:       'Mall',
    N:           400,
    E:           4,
    cap:         1.1,
    L:           45,
    mu:          28,
    sigma:       14,
    v:           1.0,
    Tsafe:       210,
    dist:        'lognormal',
    description: 'Visitors unfamiliar with layout. 75% head to main entrance. High exit load imbalance.'
  },
  hospital: {
    label:       'Hospital',
    N:           250,
    E:           4,
    cap:         0.7,
    L:           35,
    mu:          45,
    sigma:       25,
    v:           0.7,
    Tsafe:       360,
    dist:        'lognormal',
    description: 'Mixed population: staff, ambulatory and non-ambulatory patients. Defend-in-place protocol extends T_safe.'
  }
};

// ─────────────────────────────────────────────
//  RANDOM NUMBER UTILITIES
// ─────────────────────────────────────────────
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
  // uniform
  return Math.max(1.0, (mu - sigma) + (2.0 * sigma * Math.random()));
}

// ─────────────────────────────────────────────
//  BUILDING-TYPE TRIAL ENGINES
// ─────────────────────────────────────────────

// OFFICE — standard behaviour with elevator-attempt delay
function runTrialOffice(p) {
  var N = p.N, E = p.E, cap = p.cap, L = p.L, v = p.v;

  // ~30% of staff try elevator first, adding 15-25s extra delay
  var reactionTimes = [];
  for (var i = 0; i < N; i++) {
    var rt = sampleReactionTime(p.mu, p.sigma, p.dist);
    if (Math.random() < 0.30) rt += 15 + Math.random() * 10; // elevator attempt
    reactionTimes.push(rt);
  }

  var walkTime = L / v;
  var exitQueues = [];
  for (var e = 0; e < E; e++) exitQueues.push([]);
  // balanced round-robin assignment — office workers know all exits
  for (var j = 0; j < N; j++) {
    exitQueues[j % E].push(reactionTimes[j] + walkTime);
  }

  return processQueues(exitQueues, E, cap);
}

// SCHOOL — classroom groups, teacher gates group, biased drill exit
function runTrialSchool(p) {
  var N = p.N, E = p.E, cap = p.cap, L = p.L, v = p.v;
  var classSize  = 25; // students per teacher
  var numClasses = Math.ceil(N / classSize);

  var exitQueues = [];
  for (var e = 0; e < E; e++) exitQueues.push([]);

  for (var c = 0; c < numClasses; c++) {
    // Each classroom is assigned a designated drill exit (not necessarily nearest)
    var assignedExit = c % E;

    // Teacher reacts first — their reaction time gates the whole class
    var teacherRT = sampleReactionTime(p.mu, p.sigma, p.dist);
    // Extra gathering time: 10-30s to line up students
    var gatherTime = 10 + Math.random() * 20;

    var studentsInClass = Math.min(classSize, N - c * classSize);
    if (studentsInClass <= 0) break;

    for (var s = 0; s < studentsInClass; s++) {
      // Students can't move until teacher has gathered them
      // Each student adds a small stagger (0-5s) as they line up
      var studentDelay = teacherRT + gatherTime + Math.random() * 5;
      // Path length slightly longer — kids walk in a line, longer effective distance
      var effectiveL = L * (1 + 0.1 * Math.random());
      exitQueues[assignedExit].push(studentDelay + effectiveL / v);
    }
  }

  return processQueues(exitQueues, E, cap);
}

// MALL — visitors go to familiar entrance, high exit imbalance
function runTrialMall(p) {
  var N = p.N, E = p.E, cap = p.cap, L = p.L, v = p.v;

  var exitQueues = [];
  for (var e = 0; e < E; e++) exitQueues.push([]);

  for (var i = 0; i < N; i++) {
    var rt = sampleReactionTime(p.mu, p.sigma, p.dist);

    // Visitors often grab belongings first (+5-20s)
    if (Math.random() < 0.45) rt += 5 + Math.random() * 15;

    // Exit choice: 75% head to main entrance (exit 0), rest spread across others
    var exitChoice;
    var r = Math.random();
    if (r < 0.75) {
      exitChoice = 0; // main entrance — heavily congested
    } else if (r < 0.88) {
      exitChoice = 1 % E;
    } else if (r < 0.96) {
      exitChoice = 2 % E;
    } else {
      exitChoice = 3 % E;
    }

    // Path to chosen exit is longer if not the nearest one
    var distMultiplier = (exitChoice === 0) ? 1.0 : (0.6 + Math.random() * 0.8);
    var effectiveL = L * distMultiplier;

    // Crowd slows walking speed in a mall (dense corridors)
    var crowdSlowdown = 0.85 + Math.random() * 0.15;
    var effectiveV = v * crowdSlowdown;

    exitQueues[exitChoice].push(rt + effectiveL / effectiveV);
  }

  return processQueues(exitQueues, E, cap);
}

// HOSPITAL — 3 population tiers: staff, ambulatory patients, non-ambulatory
function runTrialHospital(p) {
  var N = p.N, E = p.E, cap = p.cap, L = p.L, v = p.v;

  // Population split: ~30% staff, ~45% ambulatory patients, ~25% non-ambulatory
  var nStaff        = Math.round(N * 0.30);
  var nAmbulatory   = Math.round(N * 0.45);
  var nNonAmbulatory = N - nStaff - nAmbulatory;

  var exitQueues = [];
  for (var e = 0; e < E; e++) exitQueues.push([]);

  // STAFF — fast reaction, know exits
  for (var i = 0; i < nStaff; i++) {
    var rt = sampleReactionTime(15, 5, p.dist); // fast
    var exitChoice = i % E;
    exitQueues[exitChoice].push(rt + L / (v * 1.1));
  }

  // AMBULATORY PATIENTS — slow reaction, need staff to guide them
  for (var j = 0; j < nAmbulatory; j++) {
    var rt2 = sampleReactionTime(45, 20, p.dist); // slower
    var exitChoice2 = j % E;
    var patientV = v * (0.5 + Math.random() * 0.4); // 0.5–0.9x normal speed
    exitQueues[exitChoice2].push(rt2 + L / patientV);
  }

  // NON-AMBULATORY — need to be moved by staff, very long delay
  // Each non-ambulatory patient requires 1–2 staff members and a wheelchair/stretcher
  // Model: long reaction delay (staff must come to them first), very slow movement
  for (var k = 0; k < nNonAmbulatory; k++) {
    var staffResponseTime = sampleReactionTime(90, 35, p.dist); // staff must reach them
    var exitChoice3 = k % E;
    // Wheelchairs/stretchers: 0.3–0.5 m/s effective speed, also reduce exit capacity
    var assistedV = 0.3 + Math.random() * 0.2;
    exitQueues[exitChoice3].push(staffResponseTime + L / assistedV);
  }

  // Hospital exits are wider for wheelchairs but non-ambulatory patients
  // take longer to pass through — effective cap reduced
  var effectiveCap = cap * 0.75; // narrowed by equipment
  return processQueues(exitQueues, E, effectiveCap);
}

// ─────────────────────────────────────────────
//  SHARED QUEUE PROCESSOR
// ─────────────────────────────────────────────
function processQueues(exitQueues, E, cap) {
  var totalEvacTime = 0;
  var perExitQ = [];

  for (var e = 0; e < E; e++) {
    var arrivals = exitQueues[e].slice().sort(function(a, b) { return a - b; });
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

// ─────────────────────────────────────────────
//  MAIN TRIAL DISPATCHER
// ─────────────────────────────────────────────
function runTrial(p) {
  var type = p.buildingType || 'office';
  if (type === 'school')   return runTrialSchool(p);
  if (type === 'mall')     return runTrialMall(p);
  if (type === 'hospital') return runTrialHospital(p);
  return runTrialOffice(p);
}

// ─────────────────────────────────────────────
//  MONTE CARLO ENGINE
// ─────────────────────────────────────────────
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
  var p95    = results[Math.min(p95idx, results.length - 1)];

  var exceedCount = 0;
  for (var m = 0; m < results.length; m++) {
    if (results[m] > params.Tsafe) exceedCount++;
  }
  var exceed = exceedCount / iterations;

  var avgQ = [];
  for (var n = 0; n < queueSums.length; n++) {
    avgQ.push(parseFloat((queueSums[n] / iterations).toFixed(1)));
  }

  return { results: results, mean: mean, std: std, p95: p95, exceed: exceed, avgQ: avgQ };
}

// ─────────────────────────────────────────────
//  SENSITIVITY ANALYSIS — ranges vary by building type
// ─────────────────────────────────────────────
function sensitivityAnalysis(baseParams, iterations) {
  var type = baseParams.buildingType || 'office';

  var sweepDefs = {
    office: [
      { label: 'Mean Reaction (mu)',    key: 'mu',    low: 15,  high: 35  },
      { label: 'Std Deviation (sigma)', key: 'sigma', low: 4,   high: 14  },
      { label: 'Occupancy (N)',         key: 'N',     low: 100, high: 400 },
      { label: 'Exit Capacity (Ce)',    key: 'cap',   low: 1.0, high: 1.5 },
      { label: 'Path Length (L)',       key: 'L',     low: 15,  high: 50  }
    ],
    school: [
      { label: 'Mean Reaction (mu)',    key: 'mu',    low: 40,  high: 90  },
      { label: 'Std Deviation (sigma)', key: 'sigma', low: 10,  high: 35  },
      { label: 'Occupancy (N)',         key: 'N',     low: 100, high: 500 },
      { label: 'Exit Capacity (Ce)',    key: 'cap',   low: 0.8, high: 1.2 },
      { label: 'Path Length (L)',       key: 'L',     low: 20,  high: 60  }
    ],
    mall: [
      { label: 'Mean Reaction (mu)',    key: 'mu',    low: 18,  high: 45  },
      { label: 'Std Deviation (sigma)', key: 'sigma', low: 8,   high: 22  },
      { label: 'Occupancy (N)',         key: 'N',     low: 200, high: 800 },
      { label: 'Exit Capacity (Ce)',    key: 'cap',   low: 0.9, high: 1.4 },
      { label: 'Path Length (L)',       key: 'L',     low: 25,  high: 70  }
    ],
    hospital: [
      { label: 'Mean Reaction (mu)',    key: 'mu',    low: 25,  high: 90  },
      { label: 'Std Deviation (sigma)', key: 'sigma', low: 15,  high: 40  },
      { label: 'Occupancy (N)',         key: 'N',     low: 100, high: 400 },
      { label: 'Exit Capacity (Ce)',    key: 'cap',   low: 0.5, high: 0.9 },
      { label: 'Path Length (L)',       key: 'L',     low: 20,  high: 55  }
    ]
  };

  var sweeps = sweepDefs[type] || sweepDefs.office;
  var iter   = Math.min(iterations, 400);
  var rows   = [];

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

// ─────────────────────────────────────────────
//  STORAGE
// ─────────────────────────────────────────────
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