import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatTimestamp } from '../utils/formatting';

/**
 * Sanitize text to avoid invalid PDF characters.
 */
function cleanText(text = '') {
  return String(text)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Helper to sanitize filenames for browser download.
 */
export function getSafeFilename(title = 'Project', version = '1.0', ext = 'pdf') {
  const safeTitle = String(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'project';
  const safeVersion = String(version).replace(/[^a-zA-Z0-9.-]/g, '');
  return `brainsync-blueprint-${safeTitle}-v${safeVersion}.${ext}`;
}

/**
 * PDF Document Generator for BrainSync AI Blueprints (Phase 6).
 * Renders a crisp, multi-page vector PDF document with selectable text, custom layout, and page numbering.
 */
export function generateBlueprintPdf(blueprintDoc, orgName = 'Workspace') {
  if (!blueprintDoc || !blueprintDoc.content) {
    throw new Error('Cannot generate PDF: Invalid or missing Blueprint content.');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const content = blueprintDoc.content;
  const title = blueprintDoc.ideaTitle || 'Project Blueprint';
  const version = blueprintDoc.version || '1.0';
  const lastSource = blueprintDoc.lastModifiedSource === 'manual' ? 'Manually Edited' : 'Google Gemini AI';
  const dateStr = formatTimestamp(blueprintDoc.updatedAt || blueprintDoc.generatedAt || Date.now());

  // Colors
  const primaryDark = [15, 23, 42]; // #0F172A (Slate 900)
  const indigoPrimary = [79, 70, 229]; // #4F46E5 (Indigo 600)
  const purpleDark = [30, 27, 75]; // #1E1B4B (Indigo 950)
  const textDark = [30, 41, 59]; // #1E293B (Slate 800)
  const textMuted = [100, 116, 139]; // #64748B (Slate 500)

  // Helper for adding new page when content reaches bottom boundary
  const checkSpace = (neededHeight = 20) => {
    if (y + neededHeight > pageHeight - 20) {
      doc.addPage();
      y = margin + 10;
    }
  };

  // Helper to render section headings
  const addSectionHeader = (titleText) => {
    checkSpace(18);
    y += 4;
    doc.setFillColor(...purpleDark);
    doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(titleText.toUpperCase(), margin + 4, y + 5.5);
    y += 12;
  };

  // ----------------------------------------------------
  // 1. COVER / HEADER BANNER
  // ----------------------------------------------------
  doc.setFillColor(...primaryDark);
  doc.rect(0, 0, pageWidth, 42, 'F');

  // BrainSync Title Logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('BRAINSYNC', margin, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254);
  doc.text('TECHNICAL MVP PROJECT BLUEPRINT', margin, 20);

  // Version Badge & Date
  doc.setFillColor(...indigoPrimary);
  doc.roundedRect(pageWidth - margin - 28, 10, 28, 7, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`VERSION ${version}`, pageWidth - margin - 25, 15);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Export Date: ${dateStr}`, pageWidth - margin - 45, 26);
  doc.text(`Workspace: ${orgName}`, pageWidth - margin - 45, 31);
  doc.text(`Source: ${lastSource}`, pageWidth - margin - 45, 36);

  // Project Main Title
  y = 48;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...textDark);
  const titleLines = doc.splitTextToSize(title, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 2;

  // Problem Statement Banner
  if (blueprintDoc.problemStatement) {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    const probLines = doc.splitTextToSize(`Problem Statement: ${cleanText(blueprintDoc.problemStatement)}`, contentWidth - 8);
    const boxHeight = probLines.length * 4.5 + 6;
    doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...textDark);
    doc.text(probLines, margin + 4, y + 5);
    y += boxHeight + 6;
  }

  // ----------------------------------------------------
  // 2. PROJECT OVERVIEW
  // ----------------------------------------------------
  addSectionHeader('1. Executive Project Overview');
  if (content.projectOverview) {
    if (content.projectOverview.summary) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...indigoPrimary);
      doc.text('Project Summary & Vision:', margin, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...textDark);
      const sumLines = doc.splitTextToSize(cleanText(content.projectOverview.summary), contentWidth);
      doc.text(sumLines, margin, y);
      y += sumLines.length * 4.5 + 4;
    }
  }

  // ----------------------------------------------------
  // 3. MVP SCOPE
  // ----------------------------------------------------
  if (content.mvpScope) {
    addSectionHeader('2. MVP Scope Boundaries');
    const scopeData = [
      ['Must Have (Critical)', (content.mvpScope.inScope || []).join('\n• ') ? '• ' + (content.mvpScope.inScope || []).join('\n• ') : 'None'],
      ['Out of Scope (Post-MVP)', (content.mvpScope.outOfScope || []).join('\n• ') ? '• ' + (content.mvpScope.outOfScope || []).join('\n• ') : 'None'],
      ['Success Criteria', (content.mvpScope.successCriteria || []).join('\n• ') ? '• ' + (content.mvpScope.successCriteria || []).join('\n• ') : 'None'],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Category', 'Scope Deliverables & Metrics']],
      body: scopeData,
      theme: 'grid',
      headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: textDark },
      columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' } },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ----------------------------------------------------
  // 4. RECOMMENDED TECH STACK
  // ----------------------------------------------------
  if (content.recommendedTechStack) {
    addSectionHeader('3. Recommended Technology Stack');
    const stack = content.recommendedTechStack;
    const stackRows = [
      ['Frontend Frameworks', (stack.frontend || []).join(', ') || 'N/A'],
      ['Backend & Server', (stack.backend || []).join(', ') || 'N/A'],
      ['Database Engines', (stack.database || []).join(', ') || 'N/A'],
      ['Cloud & Hosting', (stack.hosting || []).join(', ') || 'N/A'],
      ['Third-Party APIs & Services', (stack.thirdPartyApis || []).join(', ') || 'N/A'],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Layer / Component', 'Technologies Recommended']],
      body: stackRows,
      theme: 'striped',
      headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: textDark },
      columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' } },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ----------------------------------------------------
  // 5. CORE FEATURES BREAKDOWN
  // ----------------------------------------------------
  if (content.coreFeatures?.length > 0) {
    addSectionHeader('4. Core Features Breakdown');
    const featureRows = content.coreFeatures.map((feat) => [
      feat.featureName || 'Untitled Feature',
      cleanText(feat.description || ''),
      feat.priority || 'Must Have',
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Feature Name', 'Description & Purpose', 'Priority']],
      body: featureRows,
      theme: 'grid',
      headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: textDark },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold' },
        2: { cellWidth: 28, fontStyle: 'bold' },
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ----------------------------------------------------
  // 6. TECHNICAL ARCHITECTURE & DATABASE
  // ----------------------------------------------------
  if (content.technicalArchitecture || content.databaseDesign) {
    addSectionHeader('5. Technical Architecture & Database Design');

    if (content.technicalArchitecture) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...indigoPrimary);
      doc.text(`Architecture Pattern: ${content.technicalArchitecture.architecturePattern || 'Modular Monolith'}`, margin, y);
      y += 4.5;
      if (content.technicalArchitecture.dataFlowDescription) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...textDark);
        const flowLines = doc.splitTextToSize(cleanText(content.technicalArchitecture.dataFlowDescription), contentWidth);
        doc.text(flowLines, margin, y);
        y += flowLines.length * 4 + 4;
      }
    }

    if (content.databaseDesign?.entities?.length > 0) {
      const dbRows = content.databaseDesign.entities.map((ent) => {
        const isOpt = ent.isOptional || (ent.entityType && String(ent.entityType).toLowerCase().includes('optional'));
        const typeBadge = isOpt ? '[Optional Entity]' : '[Necessary Entity]';
        const reqFields = (ent.fields || []).join(', ') || 'None';
        const optFields = Array.isArray(ent.optionalFields) && ent.optionalFields.length > 0
          ? `\n(Optional: ${ent.optionalFields.join(', ')})`
          : '';
        return [
          `${ent.entityName || 'Entity'}\n${typeBadge}`,
          `Required: ${reqFields}${optFields}`,
        ];
      });

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Database Entity & Type', 'Required & Optional Attributes']],
        body: dbRows,
        theme: 'striped',
        headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: textDark },
        columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' } },
      });
      y = doc.lastAutoTable.finalY + 6;
    }
  }

  // ----------------------------------------------------
  // 7. TEAM ALLOCATION
  // ----------------------------------------------------
  if (content.teamAllocation?.length > 0) {
    addSectionHeader('6. Strategic Team Member Allocation');
    const teamRows = content.teamAllocation.map((m) => [
      m.memberName || 'Team Member',
      m.assignedRole || 'Contributor',
      (m.recommendedTasks || []).join('\n• ') ? '• ' + (m.recommendedTasks || []).join('\n• ') : 'General Development',
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Team Member', 'Assigned Role', 'Recommended Technical Tasks']],
      body: teamRows,
      theme: 'grid',
      headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: textDark },
      columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 1: { cellWidth: 35 } },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ----------------------------------------------------
  // 8. CHALLENGES & ROADMAP
  // ----------------------------------------------------
  if (content.developmentRoadmap?.length > 0) {
    addSectionHeader('7. Development Roadmap & Sprint Schedule');
    const roadRows = content.developmentRoadmap.map((r) => [
      r.phase || 'Phase',
      r.duration || 'Sprint',
      (r.deliverables || []).join('\n• ') ? '• ' + (r.deliverables || []).join('\n• ') : 'Deliverables',
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Phase Name', 'Duration', 'Sprint Deliverables']],
      body: roadRows,
      theme: 'grid',
      headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: textDark },
      columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' }, 1: { cellWidth: 25 } },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ----------------------------------------------------
  // 9. COMMUNITY INTELLIGENCE SYNTHESIS (PHASE 4)
  // ----------------------------------------------------
  const community = blueprintDoc.communityIntelligence || content.communityIntelligence;
  if (community?.communityInsights?.keyInsights?.length > 0) {
    addSectionHeader('8. Community Intelligence & Feedback Insights');

    const stats = community.communityInsights.statistics || {};
    const statsRow = [
      [
        `Suggestions Analyzed: ${stats.suggestionsAnalyzed || 0} (${stats.suggestionsRelevant || 0} Relevant)`,
        `Comments Analyzed: ${stats.commentsAnalyzed || 0} (${stats.commentsRelevant || 0} Relevant)`,
        `Questions Analyzed: ${stats.questionsAnalyzed || 0} (${stats.questionsRelevant || 0} Relevant)`,
      ],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Community Suggestions', 'Community Comments', 'Community Questions']],
      body: statsRow,
      theme: 'striped',
      headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: textDark },
    });
    y = doc.lastAutoTable.finalY + 4;

    const insightRows = community.communityInsights.keyInsights.map((ins, i) => [
      `#${i + 1}`,
      ins.insight || 'Insight',
      (ins.category || 'General').toUpperCase(),
      (ins.impact || 'medium').toUpperCase(),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['No.', 'Key Consolidated Insight', 'Category', 'Impact']],
      body: insightRows,
      theme: 'grid',
      headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: textDark },
      columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 25 }, 3: { cellWidth: 20, fontStyle: 'bold' } },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ----------------------------------------------------
  // FOOTER & PAGE NUMBERING ON ALL PAGES
  // ----------------------------------------------------
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text('BrainSync AI Blueprint Specification Document · Confidential Project Asset', margin, pageHeight - 7);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin - 15, pageHeight - 7);
  }

  return {
    doc,
    filename: getSafeFilename(title, version, 'pdf'),
  };
}
