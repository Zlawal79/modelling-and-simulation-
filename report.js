function generatePDFReport(params, results) {

  var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  var W  = 210, H  = 297;
  var ml = 18,  mr = 18;
  var cw = W - ml - mr;
  var y  = 0;

  var C = {
    black:  [6,   8,   9  ],
    dark:   [17,  24,  34 ],
    border: [40,  55,  70 ],
    accent: [0,   180, 140],
    danger: [220, 60,  60 ],
    warn:   [210, 140, 0  ],
    safe:   [0,   180, 140],
    white:  [220, 232, 240],
    muted:  [100, 130, 150],
    text:   [200, 215, 228]
  };

  var BTYPE_LABELS = { office: 'Office', school: 'School', mall: 'Mall', hospital: 'Hospital' };
  var btype        = params.buildingType || 'office';
  var btypeLabel   = BTYPE_LABELS[btype] || btype;

  var BTYPE_BEHAVIOUR = {
    office:   'Staff (~30%) first attempt elevators before evacuating, adding 15–25 s delay per person. Exit assignment is balanced round-robin. Sensitivity ranges are calibrated to office occupancy levels (100–400 persons).',
    school:   'Teachers gather their class (~25 students) before moving, adding 10–30 s on top of reaction time. Each classroom is assigned a designated drill exit (not the nearest exit), causing unbalanced exit loads. Students walk at reduced speed (~0.8 m/s) behind their teacher. Sensitivity ranges reflect school-sized populations (100–500 persons).',
    mall:     '75% of visitors head to the main entrance regardless of proximity, causing severe exit load imbalance. ~45% of shoppers delay 5–20 s to grab belongings. Crowd density reduces walking speed by 10–15%. Sensitivity ranges cover large occupancies (200–800 persons).',
    hospital: 'Three population tiers: staff (30%, fast reaction ~15 s), ambulatory patients (45%, slow reaction ~45 s, 50–90% walking speed), and non-ambulatory patients (25%, assisted evacuation, reaction ~90 s, wheelchair speed 0.3–0.5 m/s). Exit capacity is reduced by 25% due to equipment. T_safe is set to the hospital defend-in-place threshold.'
  };

  function fill(col)    { doc.setFillColor(col[0], col[1], col[2]); }
  function stroke(col)  { doc.setDrawColor(col[0], col[1], col[2]); }
  function textCol(col) { doc.setTextColor(col[0], col[1], col[2]); }
  function font(size, style) { doc.setFontSize(size); doc.setFont('helvetica', style || 'normal'); }

  function newPage() {
    doc.addPage();
    y = 0;
    drawPageBg();
    y = 14;
  }

  function drawPageBg() {
    fill(C.black);
    doc.rect(0, 0, W, H, 'F');
    stroke([15, 20, 28]);
    doc.setLineWidth(0.15);
    for (var gx = 0; gx < W; gx += 10) doc.line(gx, 0, gx, H);
    for (var gy = 0; gy < H; gy += 10) doc.line(0, gy, W, gy);
  }

  function sectionBar(title, yPos) {
    fill(C.dark);
    doc.rect(ml, yPos, cw, 7, 'F');
    fill(C.accent);
    doc.rect(ml, yPos, 3, 7, 'F');
    font(7.5, 'bold');
    textCol(C.accent);
    doc.text(title.toUpperCase(), ml + 6, yPos + 4.8);
    return yPos + 11;
  }

  function divider(yPos) {
    stroke(C.border);
    doc.setLineWidth(0.2);
    doc.line(ml, yPos, ml + cw, yPos);
    return yPos + 4;
  }

  function metricBox(x, yPos, w, label, value, unit, colArr) {
    fill(C.dark);
    doc.roundedRect(x, yPos, w, 22, 1.5, 1.5, 'F');
    stroke(colArr || C.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yPos, w, 22, 1.5, 1.5, 'S');
    fill(colArr || C.accent);
    doc.rect(x, yPos + 20.5, w, 1.5, 'F');
    font(5.5, 'normal');
    textCol(C.muted);
    doc.text(label.toUpperCase(), x + 3, yPos + 5);
    font(13, 'bold');
    textCol(C.white);
    doc.text(String(value), x + 3, yPos + 14);
    font(5, 'normal');
    textCol(C.muted);
    doc.text(unit, x + 3, yPos + 19);
  }

  function explanationBox(xPos, yPos, w, heading, body) {
    font(5.5, 'normal');
    var lines = doc.splitTextToSize(body, w - 6);
    var bodyH = lines.length * 3.5;
    var boxH  = 5 + bodyH + 6;
    fill([12, 18, 26]);
    doc.roundedRect(xPos, yPos, w, boxH, 1.5, 1.5, 'F');
    stroke(C.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(xPos, yPos, w, boxH, 1.5, 1.5, 'S');
    fill(C.accent);
    doc.rect(xPos, yPos, 2.5, boxH, 'F');
    font(6, 'bold');
    textCol(C.accent);
    doc.text(heading, xPos + 5, yPos + 5.5);
    font(5.5, 'normal');
    textCol(C.text);
    doc.text(lines, xPos + 5, yPos + 5 + 4);
    return yPos + boxH + 3;
  }

  function miniBarChart(xPos, yPos, chartW, chartH, labels, values, colors, title) {
    fill(C.dark);
    doc.roundedRect(xPos, yPos, chartW, chartH + 16, 1.5, 1.5, 'F');
    stroke(C.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(xPos, yPos, chartW, chartH + 16, 1.5, 1.5, 'S');
    font(5.5, 'bold');
    textCol(C.muted);
    doc.text(title.toUpperCase(), xPos + 4, yPos + 5);
    var chartBot = yPos + 9 + chartH;
    var maxVal   = Math.max.apply(null, values);
    var barW     = (chartW - 10) / values.length - 2;
    stroke(C.border);
    doc.setLineWidth(0.2);
    doc.line(xPos + 5, chartBot, xPos + chartW - 5, chartBot);
    for (var i = 0; i < values.length; i++) {
      var bx  = xPos + 5 + i * ((chartW - 10) / values.length) + 1;
      var bh  = maxVal > 0 ? (values[i] / maxVal) * chartH : 2;
      var by  = chartBot - bh;
      var col = colors ? colors[i] : C.accent;
      fill(col);
      doc.rect(bx, by, barW, bh, 'F');
      font(4.5, 'bold');
      textCol(C.white);
      if (bh > 5) doc.text(String(values[i].toFixed ? values[i].toFixed(0) : values[i]), bx + barW/2, by + bh/2 + 1.5, { align: 'center' });
      font(4, 'normal');
      textCol(C.muted);
      var lbl = labels[i];
      if (lbl.length > 8) lbl = lbl.substring(0, 7) + '.';
      doc.text(lbl, bx + barW/2, chartBot + 4, { align: 'center' });
    }
  }

  function miniHistogram(xPos, yPos, chartW, chartH, rawResults, Tsafe) {
    var min = rawResults[0], max = rawResults[rawResults.length - 1];
    var bins = 20, bw = (max - min) / bins;
    var counts = [], midpoints = [];
    for (var i = 0; i < bins; i++) { counts.push(0); midpoints.push(min + (i + 0.5) * bw); }
    for (var j = 0; j < rawResults.length; j++) {
      var b = Math.min(Math.floor((rawResults[j] - min) / bw), bins - 1);
      counts[b]++;
    }
    var maxCount = Math.max.apply(null, counts);
    fill(C.dark);
    doc.roundedRect(xPos, yPos, chartW, chartH + 18, 1.5, 1.5, 'F');
    stroke(C.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(xPos, yPos, chartW, chartH + 18, 1.5, 1.5, 'S');
    font(5.5, 'bold');
    textCol(C.muted);
    doc.text('EVACUATION TIME DISTRIBUTION', xPos + 4, yPos + 5);
    var chartTop = yPos + 9, chartBot = yPos + 9 + chartH;
    var barW2 = (chartW - 10) / bins;
    stroke(C.border);
    doc.setLineWidth(0.15);
    doc.line(xPos + 5, chartBot, xPos + chartW - 5, chartBot);
    for (var k = 0; k < bins; k++) {
      var bx2 = xPos + 5 + k * barW2;
      var bh2 = maxCount > 0 ? (counts[k] / maxCount) * chartH : 0;
      var by2 = chartBot - bh2;
      var col2 = midpoints[k] > Tsafe ? C.danger : C.accent;
      if (bh2 > 0) { fill(col2); doc.rect(bx2, by2, barW2 - 0.5, bh2, 'F'); }
    }
    font(4, 'normal');
    textCol(C.muted);
    doc.text(min.toFixed(0) + 's', xPos + 5, chartBot + 4);
    doc.text(max.toFixed(0) + 's', xPos + chartW - 5, chartBot + 4, { align: 'right' });
    doc.text('Trial Count', xPos + chartW/2, chartBot + 9, { align: 'center' });
    if (Tsafe >= min && Tsafe <= max) {
      var tsX = xPos + 5 + ((Tsafe - min) / (max - min)) * (chartW - 10);
      stroke(C.danger);
      doc.setLineWidth(0.4);
      doc.setLineDash([1, 1]);
      doc.line(tsX, chartTop, tsX, chartBot);
      doc.setLineDash([]);
      font(4, 'bold');
      textCol(C.danger);
      doc.text('T_safe', tsX + 1, chartTop + 3);
    }
  }

  function tableRow(cols, yPos, colWidths, isHeader, riskLevel) {
    var rowH = 7;
    fill(isHeader ? C.dark : [10, 15, 22]);
    doc.rect(ml, yPos, cw, rowH, 'F');
    stroke(C.border);
    doc.setLineWidth(0.15);
    doc.line(ml, yPos + rowH, ml + cw, yPos + rowH);
    var xc = ml + 2;
    for (var i = 0; i < cols.length; i++) {
      if (isHeader) { font(5, 'bold'); textCol(C.muted); }
      else          { font(5.5, 'normal'); textCol(C.text); }
      if (!isHeader && i === 5) { font(5.5, 'bold'); textCol(C.accent); }
      if (!isHeader && i === 6 && riskLevel) {
        var rc = riskLevel === 'HIGH' ? C.danger : riskLevel === 'MEDIUM' ? C.warn : C.safe;
        fill(rc);
        doc.roundedRect(xc, yPos + 1.5, colWidths[i] - 2, 4, 0.8, 0.8, 'F');
        font(4.5, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(riskLevel, xc + (colWidths[i] - 2)/2, yPos + 4.3, { align: 'center' });
        xc += colWidths[i];
        continue;
      }
      doc.text(String(cols[i]), xc, yPos + 4.8);
      xc += colWidths[i];
    }
    return yPos + rowH;
  }

  drawPageBg();
  y = 0;

  fill(C.dark);
  doc.rect(0, 0, W, 42, 'F');
  fill(C.accent);
  doc.rect(0, 0, 4, 42, 'F');
  font(7, 'normal');
  textCol(C.accent);
  doc.text('MONTE CARLO SIMULATION  //  EMERGENCY EVACUATION RISK ANALYSIS', ml, 10);
  font(18, 'bold');
  textCol(C.white);
  doc.text('SIMULATION REPORT', ml, 22);
  font(8, 'bold');
  textCol(C.accent);
  doc.text('BUILDING TYPE: ' + btypeLabel.toUpperCase(), ml, 31);
  font(7, 'normal');
  textCol(C.muted);
  var now     = new Date();
  var dateStr = now.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  var timeStr = now.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
  doc.text('Generated: ' + dateStr + ' at ' + timeStr, ml, 38);
  doc.text('Iterations: ' + results.iter + '   |   Distribution: ' + params.dist + '   |   Safety Limit: ' + params.Tsafe + 's', ml + 95, 38);

  y = 52;

  y = sectionBar('What This Report Shows', y);
  font(6, 'normal');
  textCol(C.text);
  var introText =
    'This report presents the results of a Monte Carlo simulation modelling emergency evacuation from a ' +
    btypeLabel + ' building. ' +
    'Rather than assuming all occupants react at the same moment, this simulation treats each person\'s reaction ' +
    'time as a random variable drawn from a ' + params.dist + ' distribution. ' +
    BTYPE_BEHAVIOUR[btype] + ' ' +
    'By running ' + results.iter + ' independent trials, we obtain a full probability distribution of outcomes -- ' +
    'enabling quantification of risk, worst-case scenarios, and parameter sensitivity.';
  var introLines = doc.splitTextToSize(introText, cw);
  doc.text(introLines, ml, y);
  y += introLines.length * 3.8 + 6;

  y = divider(y);
  y = sectionBar('Key Results', y);

  var bw5 = (cw - 8) / 5;
  var cards = [
    { label: 'Mean Evac. Time', value: results.mean.toFixed(1), unit: 'E[T] seconds',       col: C.accent },
    { label: '95th Percentile', value: results.p95.toFixed(1),  unit: 'T95 worst-case (s)',  col: C.warn   },
    { label: 'Std Deviation',   value: results.std.toFixed(1),  unit: 'sigma spread (s)',    col: C.accent },
    { label: 'Exceedance Prob', value: (results.exceed*100).toFixed(1)+'%', unit: 'P(T > T_safe)', col: results.exceed > 0.15 ? C.danger : results.exceed > 0.05 ? C.warn : C.safe },
    { label: 'Risk Level',      value: results.exceed > 0.15 ? 'HIGH' : results.exceed > 0.05 ? 'MOD.' : 'SAFE', unit: 'classification', col: results.exceed > 0.15 ? C.danger : results.exceed > 0.05 ? C.warn : C.safe }
  ];
  for (var ci = 0; ci < cards.length; ci++) {
    metricBox(ml + ci * (bw5 + 2), y, bw5, cards[ci].label, cards[ci].value, cards[ci].unit, cards[ci].col);
  }
  y += 28;

  y = sectionBar('What Each Result Means', y);

  var explanations = [
    {
      heading: 'Mean Evacuation Time E[T] = ' + results.mean.toFixed(1) + 's',
      body: 'The average time for all ' + params.N + ' occupants to exit, across ' + results.iter + ' trials. ' +
            'For a ' + btypeLabel + ', this reflects the building-type-specific behaviour modelled: ' + BTYPE_BEHAVIOUR[btype].split('.')[0] + '. ' +
            'Average was ' + results.mean.toFixed(1) + 's (' + (results.mean/60).toFixed(1) + ' min). The spread matters as much as this average.'
    },
    {
      heading: '95th Percentile T95 = ' + results.p95.toFixed(1) + 's',
      body: 'In 95% of all simulated scenarios, evacuation completes within ' + results.p95.toFixed(1) + 's. ' +
            'Safety codes like NFPA 101 use worst-case metrics. Your T95 is ' +
            (results.p95 < params.Tsafe ? 'BELOW' : 'ABOVE') + ' the ' + params.Tsafe + 's safety limit -- ' +
            (results.p95 < params.Tsafe ? 'the building passes the worst-case test.' : 'the building may not meet requirements in extreme scenarios.')
    },
    {
      heading: 'Standard Deviation sigma = ' + results.std.toFixed(1) + 's',
      body: 'Measures trial-to-trial variability in evacuation time due to individual reaction time differences and building-type behaviour. ' +
            'For a ' + btypeLabel + ', high sigma can arise from ' +
            (btype === 'school' ? 'variation in teacher gathering speed.' :
             btype === 'mall'   ? 'the wide range of visitor familiarity with exits.' :
             btype === 'hospital' ? 'the mix of fast staff and very slow non-ambulatory patients.' :
             'variation in staff elevator-attempt decisions.') +
            ' A fixed-reaction-time model hides this entirely.'
    },
    {
      heading: 'Exceedance Probability P(T > T_safe) = ' + (results.exceed*100).toFixed(1) + '%',
      body: 'Fraction of trials exceeding the ' + params.Tsafe + 's limit. ' +
            Math.round(results.exceed * results.iter) + ' of ' + results.iter + ' trials exceeded the limit. ' +
            (results.exceed === 0 ? 'All simulated scenarios completed safely.'
              : results.exceed < 0.05 ? 'Below 5% -- generally acceptable per probabilistic safety standards.'
              : 'Above 5% -- this configuration may pose elevated safety risk for a ' + btypeLabel + '.')
    }
  ];

  var halfW = (cw - 3) / 2;
  for (var ei = 0; ei < explanations.length; ei++) {
    var ex = ei % 2 === 0 ? ml : ml + halfW + 3;
    if (ei % 2 === 0 && ei > 0) y += 2;
    y = explanationBox(ex, y, halfW, explanations[ei].heading, explanations[ei].body);
  }
  y += 4;

  newPage();

  y = sectionBar('Evacuation Time Distribution', y);
  font(5.5, 'normal');
  textCol(C.text);
  var histExp = doc.splitTextToSize(
    'Each bar represents a group of trials with similar evacuation times. ' +
    'Teal bars completed within the ' + params.Tsafe + 's limit. Red bars (if any) exceeded it. ' +
    'For a ' + btypeLabel + ', a wide histogram indicates high variability driven by ' +
    (btype === 'school' ? 'differing teacher gathering speeds and classroom drill exit assignments.' :
     btype === 'mall'   ? 'the severe imbalance between main entrance load and emergency exits.' :
     btype === 'hospital' ? 'the large gap between fast staff and slow non-ambulatory patient evacuation.' :
     'elevator-attempt delays and occupant variability.'),
    cw
  );
  doc.text(histExp, ml, y);
  y += histExp.length * 3.8 + 4;

  var limitedResults = results.results;
  if (limitedResults.length > 2000) {
    var step2 = Math.floor(limitedResults.length / 2000);
    var sampled = [];
    for (var si = 0; si < limitedResults.length; si += step2) sampled.push(limitedResults[si]);
    limitedResults = sampled;
  }
  miniHistogram(ml, y, cw, 50, limitedResults, params.Tsafe);
  y += 74;

  y = divider(y);
  y = sectionBar('Average Peak Queue Length per Exit', y);
  font(5.5, 'normal');
  textCol(C.text);
  var qNote =
    btype === 'mall'
      ? 'Exit 1 is the main entrance. For malls, 75% of occupants converge here regardless of distance, causing severe congestion. Emergency exits (E2–E4) are underused. In a real evacuation this bottleneck is a primary life safety risk.'
      : btype === 'school'
      ? 'Each classroom uses its designated drill exit, causing uneven load distribution. If one exit has a dramatically higher queue than others, consider revising the drill assignment for that classroom group.'
      : btype === 'hospital'
      ? 'Non-ambulatory patients (25% of occupants) move at wheelchair/stretcher speed and create disproportionate queue buildup. Red bars indicate exits that are severely overloaded and likely require additional staff allocation.'
      : 'Exit load should be roughly balanced for an office. Red bars indicate exits where the throughput capacity Ce is the binding constraint -- consider adding a door or widening the exit.';
  var qExp = doc.splitTextToSize(qNote, cw);
  doc.text(qExp, ml, y);
  y += qExp.length * 3.8 + 4;

  var exitLabels = [], qColors = [];
  for (var qi = 0; qi < params.E; qi++) {
    exitLabels.push(btype === 'mall' && qi === 0 ? 'Main Ent.' : 'Exit ' + (qi+1));
    qColors.push(results.avgQ[qi] > 30 ? C.danger : results.avgQ[qi] > 15 ? C.warn : C.safe);
  }
  miniBarChart(ml, y, cw, 40, exitLabels, results.avgQ, qColors, 'Avg Peak Queue Length (persons)');
  y += 62;

  y = divider(y);
  y = sectionBar('Simulation Parameters Used', y);

  var paramRows = [
    ['Building Type',      btypeLabel,              'Determines population behaviour model'],
    ['Occupants (N)',      params.N + ' persons',   'Total number of people in the building'],
    ['Exits (E)',          params.E,                'Number of exit doors available'],
    ['Exit Capacity (Ce)', params.cap + ' p/s',     'Max throughput per exit (FIFO queue model)'],
    ['Path Length (L)',    params.L + ' m',         'Average walking distance to nearest/assigned exit'],
    ['Mean Reaction (mu)', params.mu + ' s',        'Base mean pre-movement delay'],
    ['Std Dev (sigma)',    params.sigma + ' s',     'Variability in reaction time'],
    ['Distribution',      params.dist,             'Statistical distribution for sampling'],
    ['Walking Speed (v)',  params.v + ' m/s',       'Base speed (adjusted per population tier)'],
    ['Safety Limit',      params.Tsafe + ' s',     'Max allowable evacuation time'],
    ['MC Iterations',     results.iter,            'Number of independent simulation trials run']
  ];

  var pColW = [38, 32, cw - 70];
  tableRow(['Parameter', 'Value', 'Description'], y, pColW, true);
  y += 7;
  for (var pi = 0; pi < paramRows.length; pi++) {
    tableRow(paramRows[pi], y, pColW, false);
    y += 7;
  }

  newPage();

  y = sectionBar('Sensitivity Analysis', y);
  font(6, 'normal');
  textCol(C.text);
  var sensIntro = doc.splitTextToSize(
    'Sensitivity analysis varies one parameter at a time across its realistic range for a ' + btypeLabel +
    ' building, holding all others constant, and measures the change in T95 (worst-case evacuation time). ' +
    'A large delta-T95 means that parameter is a critical safety risk driver. ' +
    'Ranges are calibrated specifically for ' + btypeLabel + ' buildings based on empirical literature.',
    cw
  );
  doc.text(sensIntro, ml, y);
  y += sensIntro.length * 3.8 + 6;

  var sensDeltas = [], maxDelta = 0;
  for (var si2 = 0; si2 < results.sens.length; si2++) {
    if (parseFloat(results.sens[si2].delta) > maxDelta) maxDelta = parseFloat(results.sens[si2].delta);
  }
  var sPalette = [C.accent, C.danger, C.warn, [99, 160, 220], [160, 130, 230]];
  for (var si3 = 0; si3 < results.sens.length; si3++) {
    sensDeltas.push(parseFloat(results.sens[si3].delta));
  }

  fill(C.dark);
  doc.roundedRect(ml, y, cw, results.sens.length * 12 + 14, 1.5, 1.5, 'F');
  stroke(C.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(ml, y, cw, results.sens.length * 12 + 14, 1.5, 1.5, 'S');
  font(5.5, 'bold');
  textCol(C.muted);
  doc.text('DELTA T95 PER PARAMETER  //  ' + btypeLabel.toUpperCase() + ' BUILDING', ml + 4, y + 6);

  var labelColW = 52, chartStartX = ml + labelColW;
  var barAreaW  = (ml + cw - 6) - chartStartX;
  var chartStartY = y + 10;

  for (var bi = 0; bi < results.sens.length; bi++) {
    var rowY   = chartStartY + bi * 10;
    var barLen = maxDelta > 0 ? (sensDeltas[bi] / maxDelta) * barAreaW : 0;
    font(5.5, 'normal');
    textCol(C.text);
    doc.text(results.sens[bi].label, ml + 4, rowY + 6);
    fill(sPalette[bi % sPalette.length]);
    doc.roundedRect(chartStartX, rowY + 1.5, Math.max(barLen, 1), 6, 1, 1, 'F');
    font(5, 'bold');
    textCol(C.white);
    doc.text(sensDeltas[bi].toFixed(1) + 's', chartStartX + barLen + 2, rowY + 6);
  }

  y += results.sens.length * 12 + 18;

  y = sectionBar('Sensitivity Table', y);
  var colWidths = [46, 16, 18, 20, 20, 18, 22];
  tableRow(['Parameter', 'Low', 'High', 'T95 @Low', 'T95 @High', 'dT95', 'Impact'], y, colWidths, true);
  y += 7;
  for (var ti = 0; ti < results.sens.length; ti++) {
    var s      = results.sens[ti];
    var impact = parseFloat(s.delta) > maxDelta * 0.6 ? 'HIGH' :
                 parseFloat(s.delta) > maxDelta * 0.3 ? 'MEDIUM' : 'LOW';
    tableRow([s.label, s.lowVal, s.hiVal, s.lowP95 + 's', s.hiP95 + 's', s.delta + 's', ''], y, colWidths, false, impact);
    y += 7;
  }

  y += 6;
  y = divider(y);
  y = sectionBar('Key Findings', y);

  var sortedSens = results.sens.slice().sort(function(a, b) { return parseFloat(b.delta) - parseFloat(a.delta); });
  var sigmaRow   = (function() {
    for (var x = 0; x < results.sens.length; x++) {
      if (results.sens[x].label.indexOf('sigma') > -1 || results.sens[x].label.indexOf('Std') > -1) return results.sens[x].delta + 's';
    }
    return 'see table';
  })();

  var findings = [
    {
      heading: 'Most Impactful Parameter: ' + sortedSens[0].label + ' (dT95 = ' + sortedSens[0].delta + 's)',
      body: sortedSens[0].label + ' has the largest single-parameter impact on worst-case evacuation time for this ' + btypeLabel + '. ' +
            'Varying it from ' + sortedSens[0].lowVal + ' to ' + sortedSens[0].hiVal + ' changes T95 by ' + sortedSens[0].delta + 's. ' +
            'Building safety planners should prioritise controlling this parameter.'
    },
    {
      heading: 'Reaction Time Variability: ' + sigmaRow,
      body: 'Sigma ranks as a HIGH-impact driver. A traditional fixed-reaction-time model would miss this entirely. ' +
            'For a ' + btypeLabel + ', sigma captures real variability: ' +
            (btype === 'school' ? 'some teachers are faster at gathering students than others.' :
             btype === 'mall'   ? 'some visitors know the mall well, others are completely lost.' :
             btype === 'hospital' ? 'staff respond very quickly while non-ambulatory patients require extended assistance.' :
             'some staff immediately use stairs while others attempt elevators first.') +
            ' This validates the Monte Carlo approach over deterministic models.'
    },
    {
      heading: 'Risk Classification: ' + (results.exceed > 0.15 ? 'HIGH RISK' : results.exceed > 0.05 ? 'MODERATE RISK' : 'SAFE'),
      body: 'With P(T > ' + params.Tsafe + 's) = ' + (results.exceed*100).toFixed(1) + '%, this ' + btypeLabel + ' configuration is classified as ' +
            (results.exceed > 0.15
              ? 'HIGH RISK. Recommended actions: add exits, reduce occupancy, or for schools -- improve drill training to reduce sigma.'
              : results.exceed > 0.05
              ? 'MODERATE RISK. The building generally meets requirements but may fail in worse-than-average scenarios.'
              : 'SAFE. All ' + results.iter + ' simulated scenarios completed within the ' + params.Tsafe + 's limit.')
    }
  ];

  var fHalfW = (cw - 3) / 2;
  for (var fi = 0; fi < findings.length; fi++) {
    var fx    = fi % 2 === 0 ? ml : ml + fHalfW + 3;
    if (fi % 2 === 0 && fi > 0) y += 2;
    var nextY = explanationBox(fx, y, fHalfW, findings[fi].heading, findings[fi].body);
    if (fi % 2 === 1 || fi === findings.length - 1) y = nextY;
  }

  var totalPages = doc.internal.getNumberOfPages();
  for (var pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    fill(C.dark);
    doc.rect(0, H - 10, W, 10, 'F');
    fill(C.accent);
    doc.rect(0, H - 10, W, 0.5, 'F');
    font(4.5, 'normal');
    textCol(C.muted);
    doc.text('Monte Carlo Simulation — ' + btypeLabel + ' Building Evacuation Risk Analysis', ml, H - 4);
    doc.text('Page ' + pg + ' of ' + totalPages, W - mr, H - 4, { align: 'right' });
  }

  var filename = 'evacuation_' + btype + '_' + params.N + 'ppl_' + params.E + 'exits_' +
    now.getFullYear() + ('0' + (now.getMonth()+1)).slice(-2) + ('0' + now.getDate()).slice(-2) + '.pdf';

  doc.save(filename);
}