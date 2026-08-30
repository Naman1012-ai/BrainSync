import assert from 'node:assert';
import { validateBlueprintOutput } from './blueprintValidator.js';
import { createDefaultBlueprint2Content } from '../../constants/blueprintSchema.js';

console.log('\n🧪 ====================================================');
console.log('🧪 BLUEPRINT 2.0 EXPORT & CANONICAL SCHEMA TEST SUITE');
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

// -------------------------------------------------------------
// TEST GROUP 1: CANONICAL SCHEMA 2 INTEGRITY ACROSS EXPORTS
// -------------------------------------------------------------
console.log('🔍 TEST GROUP 1: Canonical Schema 2 Document Integrity');

it('Canonical Blueprint 2.0 content retains schemaVersion 2 without flattening into legacy fields', () => {
  const v2Content = createDefaultBlueprint2Content();
  const validated = validateBlueprintOutput(v2Content);

  assert.strictEqual(validated.schemaVersion, 2);
  assert.ok(validated.projectUnderstanding, 'Must have projectUnderstanding');
  assert.ok(Array.isArray(validated.requirements), 'Must have requirements array');
  assert.ok(validated.architecture, 'Must have architecture');
  assert.ok(validated.execution, 'Must have execution');
  assert.ok(validated.intelligence, 'Must have intelligence');
  assert.ok(validated.quality, 'Must have quality');

  // Verify that legacy root fields are NOT arbitrarily injected into the canonical content
  assert.strictEqual(validated.mvpScope, undefined);
  assert.strictEqual(validated.recommendedTechStack, undefined);
  assert.strictEqual(validated.coreFeatures, undefined);
  assert.strictEqual(validated.developmentRoadmap, undefined);
});

// -------------------------------------------------------------
// TEST GROUP 2: EXPORT DOCUMENT SERIALIZATION & VERSION UNIFICATION
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Export Document Serialization & Version Unification');

it('JSON Export retains authoritative version, metadata, and canonical content', () => {
  const targetDoc = {
    blueprintId: 'bp_ws123_idea456',
    workspaceId: 'ws123',
    mvpIdeaId: 'idea456',
    version: '2.0',
    status: 'completed',
    ideaTitle: 'AI Health Tracker',
    content: createDefaultBlueprint2Content(),
  };

  const validatedContent = validateBlueprintOutput(targetDoc.content);
  const exportDocument = {
    blueprintId: targetDoc.blueprintId,
    workspaceId: targetDoc.workspaceId,
    mvpIdeaId: targetDoc.mvpIdeaId,
    version: targetDoc.version,
    schemaVersion: validatedContent.schemaVersion || 2,
    status: 'completed',
    ideaTitle: targetDoc.ideaTitle,
    content: validatedContent,
  };

  const jsonString = JSON.stringify(exportDocument, null, 2);
  const parsed = JSON.parse(jsonString);

  assert.strictEqual(parsed.version, '2.0');
  assert.strictEqual(parsed.schemaVersion, 2);
  assert.strictEqual(parsed.content.schemaVersion, 2);
  assert.ok(parsed.content.projectUnderstanding.summary.length > 0);
  assert.strictEqual(parsed.content.requirements.length, 3);
  assert.strictEqual(parsed.content.execution.tasks.length, 2);
});

// -------------------------------------------------------------
// TEST GROUP 3: STRUCTURED PDF DATA EXTRACTABILITY
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: Structured PDF Data Extractability');

it('Extracts all 8 core Blueprint 2.0 sections for PDF rendering', () => {
  const v2Content = createDefaultBlueprint2Content();

  // 1. Project Understanding
  assert.ok(v2Content.projectUnderstanding.summary, 'Section 1: Summary exists');
  assert.ok(v2Content.projectUnderstanding.mvpScope, 'Section 1: MVP Scope exists');

  // 2. Requirements
  assert.ok(v2Content.requirements.length >= 3, 'Section 2: Requirements present');
  assert.ok(v2Content.requirements[0].id, 'Section 2: Requirement ID present');
  assert.ok(v2Content.requirements[0].priority, 'Section 2: Requirement priority present');

  // 3. Architecture
  assert.ok(v2Content.architecture.architecturePattern, 'Section 3: Architecture pattern present');
  assert.ok(v2Content.architecture.technologyStack, 'Section 3: Tech stack present');
  assert.ok(v2Content.architecture.dataArchitecture.entities.length > 0, 'Section 3: DB entities present');

  // 4. Execution
  assert.ok(v2Content.execution.tasks.length >= 2, 'Section 4: Tasks present');
  assert.ok(v2Content.execution.features.length >= 2, 'Section 4: Features present');
  assert.strictEqual(typeof v2Content.execution.tasks[0].estimatedEffortHours, 'number', 'Section 4: Estimated effort is numeric');

  // 5. Team Intelligence (from execution.roles & teamExecutionSummary)
  assert.ok(v2Content.execution.roles.length > 0, 'Section 5: Roles present');
  assert.ok(v2Content.execution.teamExecutionSummary, 'Section 5: Team Summary present');

  // 6. Risks
  assert.ok(v2Content.quality.risks.length > 0, 'Section 6: Risks present');
  assert.ok(v2Content.quality.risks[0].mitigation, 'Section 6: Mitigation present');

  // 7. Quality Gates
  assert.strictEqual(v2Content.quality.qualityGates.length, 8, 'Section 7: 8 Quality Gates present');
  assert.ok(v2Content.quality.productionReadiness, 'Section 7: Production readiness present');

  // 8. Discussion Intelligence & Recommendations
  assert.ok(v2Content.intelligence.recommendations.length > 0, 'Section 8: Recommendations present');
  assert.ok(v2Content.intelligence.discussionIntelligence, 'Section 8: Discussion intelligence present');
});

// -------------------------------------------------------------
// TEST SUMMARY
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`📊 EXPORT & CANONICAL SCHEMA TESTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL EXPORT & CANONICAL SCHEMA TESTS PASSED PERFECTLY!\n');
}
