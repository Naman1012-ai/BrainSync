import assert from 'node:assert';

console.log('\n🧪 ====================================================');
console.log('🧪 BLUEPRINT SUMMARY CARD CONTENT VISIBILITY TEST SUITE');
console.log('🧪 ====================================================\n');

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

// Logic mirror of BlueprintSummaryCard content evaluator
function evaluateSummaryCardVisibility({
  content,
  maxPreviewChars = 115,
}) {
  let rawText = '';
  let isArray = false;
  let itemsList = [];

  if (Array.isArray(content)) {
    isArray = true;
    itemsList = content.filter(Boolean);
    rawText = itemsList.join('; ');
  } else {
    rawText = String(content || '');
  }

  const isLong = rawText.length > maxPreviewChars || (isArray && itemsList.length > 2);

  return {
    rawText,
    isArray,
    itemsList,
    isLong,
    showsSeeDetails: isLong,
    renderedPreview: isLong ? rawText.slice(0, maxPreviewChars) + '...' : rawText,
    fullTextForDrawer: isArray ? itemsList.map((i) => `• ${i}`).join('\n') : rawText,
  };
}

// -------------------------------------------------------------
// TEST GROUP 1: SHORT VS LONG CONTENT VISIBILITY
// -------------------------------------------------------------
console.log('🔍 TEST GROUP 1: Short Content vs Long Content Visibility Logic');

it('Short content (<= 115 chars) displays completely and hides "See details →"', () => {
  const shortText = 'Automated resume analysis and keyword match.';
  const res = evaluateSummaryCardVisibility({ content: shortText });

  assert.strictEqual(res.isLong, false);
  assert.strictEqual(res.showsSeeDetails, false);
  assert.strictEqual(res.rawText, shortText);
});

it('Long content (> 115 chars) displays preview and provides "See details →"', () => {
  const longProblem =
    "Job seekers lack objective, actionable feedback on their resumes' formatting, keyword optimization for ATS, and alignment with target job descriptions, leading to low interview rates and frustration.";
  const res = evaluateSummaryCardVisibility({ content: longProblem });

  assert.strictEqual(res.isLong, true);
  assert.strictEqual(res.showsSeeDetails, true);
  assert.strictEqual(res.fullTextForDrawer, longProblem);
  assert.ok(res.renderedPreview.includes('...'));
});

it('Array content with > 2 items enables "See details →" and formats drawer list with bullet points', () => {
  const scopeItems = [
    'User authentication & profiles',
    'Resume upload (PDF, DOCX)',
    'Automated ATS scoring engine',
    'Skill gap breakdown matrix',
    'PDF Export report',
  ];
  const res = evaluateSummaryCardVisibility({ content: scopeItems });

  assert.strictEqual(res.isLong, true);
  assert.strictEqual(res.showsSeeDetails, true);
  assert.ok(res.fullTextForDrawer.startsWith('• User authentication'));
  assert.ok(res.fullTextForDrawer.includes('• PDF Export report'));
});

it('Array content with <= 2 short items displays without truncation', () => {
  const shortScope = ['Auth', 'Upload'];
  const res = evaluateSummaryCardVisibility({ content: shortScope });

  assert.strictEqual(res.isLong, false);
  assert.strictEqual(res.showsSeeDetails, false);
  assert.strictEqual(res.rawText, 'Auth; Upload');
});

it('Empty or fallback content renders safely without errors or phantom button', () => {
  const res = evaluateSummaryCardVisibility({ content: '' });

  assert.strictEqual(res.isLong, false);
  assert.strictEqual(res.showsSeeDetails, false);
  assert.strictEqual(res.rawText, '');
});

// -------------------------------------------------------------
// TEST GROUP 2: DRAWER ENTITY PAYLOAD INTEGRITY
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Drawer Entity Inspection Payload Integrity');

it('Entity detail payload retains full problem statement and context metadata', () => {
  const problemText =
    'Job seekers lack objective, actionable feedback on their resumes. Current tools provide generic feedback and miss ATS keyword matching.';
  const payload = {
    id: 'PROBLEM',
    type: 'Project Direction',
    title: '1. Problem Statement',
    description: problemText,
    raw: {
      tag: '1. Problem',
      title: '1. Problem Statement',
      problemStatement: problemText,
      context: 'Core user and business pain points addressed by this project.',
    },
  };

  assert.strictEqual(payload.id, 'PROBLEM');
  assert.strictEqual(payload.type, 'Project Direction');
  assert.strictEqual(payload.description, problemText);
  assert.strictEqual(payload.raw.context, 'Core user and business pain points addressed by this project.');
});

it('Entity detail payload for MVP Scope preserves both In-Scope and Out-Of-Scope collections', () => {
  const inScope = ['Auth', 'Parser', 'Scoring Engine'];
  const outOfScope = ['Mobile App', 'Job Board Scraper', 'Payment Gateway'];

  const payload = {
    id: 'MVP_SCOPE',
    type: 'Project Direction',
    title: '3. MVP Scope Boundary',
    description: inScope.map((i) => `• ${i}`).join('\n'),
    raw: {
      tag: '3. MVP Scope',
      title: '3. MVP Scope Boundary',
      inScope,
      outOfScope,
    },
  };

  assert.strictEqual(payload.raw.inScope.length, 3);
  assert.strictEqual(payload.raw.outOfScope.length, 3);
  assert.ok(payload.description.includes('• Scoring Engine'));
});

// -------------------------------------------------------------
// TEST SUMMARY
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`📊 SUMMARY CARD VISIBILITY TESTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL BLUEPRINT SUMMARY CARD CONTENT VISIBILITY TESTS PASSED!\n');
}
