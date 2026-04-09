function generatePDFReport(params, results) {

  var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  var W  = 210;
  var H  = 297;
  var ml = 18;
  var mr = 18;
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
    for (var gx = 0; gx < W; gx += 10) {
      doc.line(gx, 0, gx, H);
    }
    for (var gy = 0; gy < H; gy += 10) {
      doc.line(0, gy, W, gy);
    }
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
    font(6, 'bold');
    var headH = 5;
    font(5.5, 'normal');
    var lines = doc.splitTextToSize(body, w - 6);
    var bodyH = lines.length * 3.5;
    var boxH  = headH + bodyH + 6;
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
    doc.text(lines, xPos + 5, yPos + headH + 4);
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
      if (bh > 5) doc.text(String(values[i].toFixed ? values[i].toFixed(0) : values[i]), bx + barW / 2, by + bh / 2 + 1.5, { align: 'center' });
      font(4, 'normal');
      textCol(C.muted);
      var lbl = labels[i];
      if (lbl.length > 8) lbl = lbl.substring(0, 7) + '.';
      doc.text(lbl, bx + barW / 2, chartBot + 4, { align: 'center' });
    }
  }

  function miniHistogram(xPos, yPos, chartW, chartH, rawResults, Tsafe) {
    var min = rawResults[0];
    var max = rawResults[rawResults.length - 1];
    var bins = 20;
    var bw   = (max - min) / bins;
    var counts    = [];
    var midpoints = [];
    for (var i = 0; i < bins; i++) {
      counts.push(0);
      midpoints.push(min + (i + 0.5) * bw);
    }
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
    var chartTop = yPos + 9;
    var chartBot = yPos + 9 + chartH;
    var barW2    = (chartW - 10) / bins;
    stroke(C.border);
    doc.setLineWidth(0.15);
    doc.line(xPos + 5, chartBot, xPos + chartW - 5, chartBot);
    for (var k = 0; k < bins; k++) {
      var bx2  = xPos + 5 + k * barW2;
      var bh2  = maxCount > 0 ? (counts[k] / maxCount) * chartH : 0;
      var by2  = chartBot - bh2;
      var col2 = midpoints[k] > Tsafe ? C.danger : C.accent;
      if (bh2 > 0) {
        fill(col2);
        doc.rect(bx2, by2, barW2 - 0.5, bh2, 'F');
      }
    }
    font(4, 'normal');
    textCol(C.muted);
    doc.text(min.toFixed(0) + 's', xPos + 5, chartBot + 4);
    doc.text(max.toFixed(0) + 's', xPos + chartW - 5, chartBot + 4, { align: 'right' });
    doc.text('Trial Count', xPos + chartW / 2, chartBot + 9, { align: 'center' });
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
      if (isHeader) {
        font(5, 'bold');
        textCol(C.muted);
      } else {
        font(5.5, 'normal');
        textCol(C.text);
      }
      if (!isHeader && i === 5) {
        font(5.5, 'bold');
        textCol(C.accent);
      }
      if (!isHeader && i === 6 && riskLevel) {
        var rc = riskLevel === 'HIGH' ? C.danger : riskLevel === 'MEDIUM' ? C.warn : C.safe;
        fill(rc);
        doc.roundedRect(xc, yPos + 1.5, colWidths[i] - 2, 4, 0.8, 0.8, 'F');
        font(4.5, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(riskLevel, xc + (colWidths[i] - 2) / 2, yPos + 4.3, { align: 'center' });
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
  doc.rect(0, 0, W, 38, 'F');
  fill(C.accent);
  doc.rect(0, 0, 4, 38, 'F');
  font(7, 'normal');
  textCol(C.accent);
  doc.text('MONTE CARLO SIMULATION  //  EMERGENCY EVACUATION RISK ANALYSIS', ml, 10);
  font(18, 'bold');
  textCol(C.white);
  doc.text('SIMULATION REPORT', ml, 22);
  font(7, 'normal');
  textCol(C.muted);
  var now     = new Date();
  var dateStr = now.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  var timeStr = now.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
  doc.text('Generated: ' + dateStr + ' at ' + timeStr, ml, 30);
  doc.text('Iterations: ' + results.iter + '   |   Distribution: ' + params.dist + '   |   Safety Limit: ' + params.Tsafe + 's', ml + 100, 30);

  y = 48;

  y = sectionBar('What This Report Shows', y);
  font(6, 'normal');
  textCol(C.text);
  var introLines = doc.splitTextToSize(
    'This report presents the results of a Monte Carlo simulation that models emergency building evacuation. ' +
    'Rather than assuming all occupants react at the same time (as traditional models do), this simulation ' +
    'treats each person\'s reaction time as a random variable drawn from a ' + params.dist + ' distribution. ' +
    'By running ' + results.iter + ' independent trials with different randomly generated reaction times, ' +
    'we obtain a full probability distribution of evacuation outcomes -- not just one fixed number. ' +
    'This allows us to quantify risk, identify worst-case scenarios, and understand how different building ' +
    'parameters influence safety.',
    cw
  );
  doc.text(introLines, ml, y);
  y += introLines.length * 3.8 + 6;

  y = divider(y);
  y = sectionBar('Key Results', y);

  var bw5 = (cw - 8) / 5;
  var cards = [
    { label: 'Mean Evac. Time', value: results.mean.toFixed(1), unit: 'E[T] seconds',      col: C.accent },
    { label: '95th Percentile', value: results.p95.toFixed(1),  unit: 'T95 worst-case (s)', col: C.warn   },
    { label: 'Std Deviation',   value: results.std.toFixed(1),  unit: 'sigma spread (s)',   col: C.accent },
    { label: 'Exceedance Prob', value: (results.exceed * 100).toFixed(1) + '%', unit: 'P(T > T_safe)', col: results.exceed > 0.15 ? C.danger : results.exceed > 0.05 ? C.warn : C.safe },
    { label: 'Risk Level', value: results.exceed > 0.15 ? 'HIGH' : results.exceed > 0.05 ? 'MOD.' : 'SAFE', unit: 'classification', col: results.exceed > 0.15 ? C.danger : results.exceed > 0.05 ? C.warn : C.safe }
  ];
  for (var ci = 0; ci < cards.length; ci++) {
    metricBox(ml + ci * (bw5 + 2), y, bw5, cards[ci].label, cards[ci].value, cards[ci].unit, cards[ci].col);
  }
  y += 28;

  y = sectionBar('What Each Result Means', y);

  var explanations = [
    {
      heading: 'Mean Evacuation Time E[T] = ' + results.mean.toFixed(1) + 's',
      body: 'This is the average time in seconds for all ' + params.N + ' occupants to exit the building, ' +
            'calculated across all ' + results.iter + ' simulation trials. Think of this as the expected ' +
            'evacuation time under normal conditions with realistic reaction time variability. ' +
            'In ' + results.iter + ' independent runs, the average was ' + results.mean.toFixed(1) + ' seconds (' + (results.mean / 60).toFixed(1) + ' minutes). ' +
            'This number alone does not tell the full story -- the spread matters too.'
    },
    {
      heading: '95th Percentile T95 = ' + results.p95.toFixed(1) + 's',
      body: 'This is the most important metric for building safety decisions. T95 means that in 95% of all simulated ' +
            'scenarios, evacuation completes within ' + results.p95.toFixed(1) + ' seconds. Only 5% of trials took longer. ' +
            'Safety codes like NFPA 101 use worst-case metrics rather than averages because a building must be safe ' +
            'even under difficult conditions. Your T95 of ' + results.p95.toFixed(1) + 's is ' +
            (results.p95 < params.Tsafe ? 'BELOW' : 'ABOVE') + ' the ' + params.Tsafe + 's safety limit -- ' +
            (results.p95 < params.Tsafe ? 'the building passes the worst-case test.' : 'the building may not meet safety requirements in extreme scenarios.')
    },
    {
      heading: 'Standard Deviation sigma = ' + results.std.toFixed(1) + 's',
      body: 'The standard deviation measures how much evacuation times vary from trial to trial due to ' +
            'reaction time variability. A low sigma means results are consistent and predictable. ' +
            'A high sigma means outcomes are unpredictable -- some trials finish quickly, others take much longer. ' +
            'This is the core insight of the project: by treating reaction time as random, we can measure ' +
            'and report this variability, which a fixed-reaction-time model completely hides.'
    },
    {
      heading: 'Exceedance Probability P(T > T_safe) = ' + (results.exceed * 100).toFixed(1) + '%',
      body: 'This answers the direct safety question: what fraction of the time does evacuation fail to complete ' +
            'within the required ' + params.Tsafe + ' seconds? Out of ' + results.iter + ' trials, ' +
            Math.round(results.exceed * results.iter) + ' trials (' + (results.exceed * 100).toFixed(1) + '%) exceeded the limit. ' +
            (results.exceed === 0
              ? 'A result of 0.0% means the building safely evacuates under all simulated conditions with these parameters.'
              : results.exceed < 0.05
              ? 'A result below 5% is generally considered acceptable in probabilistic safety standards.'
              : 'A result above 5% suggests this building configuration may pose an elevated safety risk.')
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
    'Each bar represents a group of simulation trials that produced a similar evacuation time. ' +
    'Teal bars are trials that completed within the ' + params.Tsafe + 's safety limit. ' +
    'Red bars (if any) are trials that exceeded the safety limit. ' +
    'A narrow histogram means reaction time variability has little effect on outcomes. ' +
    'A wide histogram means variability causes large swings in evacuation time, which is a key risk indicator.',
    cw
  );
  doc.text(histExp, ml, y);
  y += histExp.length * 3.8 + 4;

  var limitedResults = results.results;
  if (limitedResults.length > 2000) {
    var step2   = Math.floor(limitedResults.length / 2000);
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
  var qExp = doc.splitTextToSize(
    'This shows how many people were waiting at each exit on average during peak congestion. ' +
    'A high queue length shown in red means that exit is a serious bottleneck -- people are arriving ' +
    'faster than the exit can process them. Green bars indicate manageable queue lengths. ' +
    'If all exits show similar queue lengths, the load is evenly distributed. ' +
    'Uneven bars suggest some exits are underused while others are overloaded.',
    cw
  );
  doc.text(qExp, ml, y);
  y += qExp.length * 3.8 + 4;

  var exitLabels = [];
  var qColors    = [];
  for (var qi = 0; qi < params.E; qi++) {
    exitLabels.push('Exit ' + (qi + 1));
    qColors.push(results.avgQ[qi] > 30 ? C.danger : results.avgQ[qi] > 15 ? C.warn : C.safe);
  }
  miniBarChart(ml, y, cw, 40, exitLabels, results.avgQ, qColors, 'Avg Peak Queue Length (persons)');
  y += 62;

  y = divider(y);
  y = sectionBar('Simulation Parameters Used', y);

  var paramRows = [
    ['Occupants (N)',      params.N + ' persons',       'Total number of people in the building'],
    ['Exits (E)',          params.E,                    'Number of exit doors available'],
    ['Exit Capacity (Ce)', params.cap + ' persons/sec', 'Max throughput per exit (FIFO queue model)'],
    ['Path Length (L)',    params.L + ' m',             'Average walking distance to nearest exit'],
    ['Mean Reaction (mu)', params.mu + ' s',            'Average pre-movement delay after alarm'],
    ['Std Dev (sigma)',    params.sigma + ' s',         'Variability in reaction time across occupants'],
    ['Distribution',      params.dist,                 'Statistical distribution used for sampling'],
    ['Walking Speed (v)',  params.v + ' m/s',           'Constant walking speed, fixed per run'],
    ['Safety Limit',      params.Tsafe + ' s',         'NFPA 101 maximum allowable evacuation time'],
    ['MC Iterations',     results.iter,                'Number of independent simulation trials run']
  ];

  var pColW = [40, 35, cw - 75];
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
    'Sensitivity analysis answers the question: which parameters have the biggest impact on worst-case ' +
    'evacuation time? We run separate Monte Carlo sweeps for each parameter, holding all others constant, ' +
    'and measure how much T95 changes from the parameter\'s minimum to maximum value. ' +
    'A large delta-T95 means that parameter is a critical risk driver. ' +
    'A small delta-T95 means the parameter has limited influence under these conditions.',
    cw
  );
  doc.text(sensIntro, ml, y);
  y += sensIntro.length * 3.8 + 6;

  var sensDeltas = [];
  var maxDelta   = 0;
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
  doc.text('DELTA T95 PER PARAMETER (SECONDS)', ml + 4, y + 6);

  var labelColW   = 52;
  var chartStartX = ml + labelColW;
  var barAreaW    = (ml + cw - 6) - chartStartX;
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
    tableRow(
      [s.label, s.lowVal, s.hiVal, s.lowP95 + 's', s.hiP95 + 's', s.delta + 's', ''],
      y, colWidths, false, impact
    );
    y += 7;
  }

  y += 6;
  y = divider(y);
  y = sectionBar('Key Findings', y);

  var sortedSens = results.sens.slice().sort(function(a, b) { return parseFloat(b.delta) - parseFloat(a.delta); });
  var sigmaRow   = (function() {
    for (var x = 0; x < results.sens.length; x++) {
      if (results.sens[x].label.indexOf('sigma') > -1 || results.sens[x].label.indexOf('Std') > -1) {
        return results.sens[x].delta + 's';
      }
    }
    return 'see table';
  })();

  var findings = [
    {
      heading: 'Most Impactful Parameter: ' + sortedSens[0].label + ' (dT95 = ' + sortedSens[0].delta + 's)',
      body: sortedSens[0].label + ' has the largest single-parameter impact on worst-case evacuation time. ' +
            'Varying it from ' + sortedSens[0].lowVal + ' to ' + sortedSens[0].hiVal +
            ' changes T95 by ' + sortedSens[0].delta + ' seconds. Building designers should prioritize ' +
            'controlling this parameter to reduce evacuation risk.'
    },
    {
      heading: 'Reaction Time Variability Impact: ' + sigmaRow,
      body: 'This is the core finding of the project. The standard deviation of reaction time, representing ' +
            'how differently people respond to an alarm, has a high impact on worst-case evacuation time. ' +
            'A traditional model using one fixed reaction time would completely miss this variability, ' +
            'potentially underestimating risk. This validates the probabilistic Monte Carlo approach.'
    },
    {
      heading: 'Risk Classification: ' + (results.exceed > 0.15 ? 'HIGH RISK' : results.exceed > 0.05 ? 'MODERATE RISK' : 'SAFE'),
      body: 'With P(T > ' + params.Tsafe + 's) = ' + (results.exceed * 100).toFixed(1) + '%, ' +
            'this building configuration is classified as ' +
            (results.exceed > 0.15
              ? 'HIGH RISK. Immediate design changes are recommended -- consider adding exits, reducing occupancy, or improving alarm systems.'
              : results.exceed > 0.05
              ? 'MODERATE RISK. The building generally meets requirements but may fail in worse-than-average conditions.'
              : 'SAFE. All ' + results.iter + ' simulated evacuation scenarios completed within the ' + params.Tsafe + 's limit.')
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
    doc.text('Monte Carlo Simulation of Human Reaction Time Effects on Emergency Evacuation Performance', ml, H - 4);
    doc.text('Page ' + pg + ' of ' + totalPages, W - mr, H - 4, { align: 'right' });
  }

  var filename = 'evacuation_report_' + params.N + 'ppl_' + params.E + 'exits_' +
    now.getFullYear() +
    ('0' + (now.getMonth() + 1)).slice(-2) +
    ('0' + now.getDate()).slice(-2) + '.pdf';

  doc.save(filename);
}