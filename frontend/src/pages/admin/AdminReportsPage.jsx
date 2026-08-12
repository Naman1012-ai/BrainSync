import React, { useState, useEffect } from 'react';
import { rtdbService } from '../../services/rtdbService';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import { Flag, CheckCircle2, Clock, AlertTriangle, ExternalLink } from 'lucide-react';

export default function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingReportId, setUpdatingReportId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = rtdbService.subscribe('reports', (data) => {
      if (!data) {
        setReports([]);
      } else {
        const list = Object.values(data)
          .filter(Boolean)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setReports(list);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (reportId, newStatus, targetUid) => {
    setUpdatingReportId(reportId);
    try {
      await adminService.updateReportStatus(reportId, newStatus, targetUid);
    } catch (err) {
      console.error('[AdminReportsPage] Error updating report status:', err);
    } finally {
      setUpdatingReportId(null);
    }
  };

  const statusVariants = {
    OPEN: 'bg-amber-950 text-amber-300 border-amber-800',
    IN_REVIEW: 'bg-purple-950 text-purple-300 border-purple-800',
    RESOLVED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    CLOSED: 'bg-slate-800 text-slate-400 border-slate-700',
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Flag className="h-6 w-6 text-purple-400" /> Platform Moderation & Issue Dispatches
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review user-submitted bug dispatches, UI feedback, security issues, and manage status transitions.
          </p>
        </div>

        <Badge variant="default" className="bg-purple-900/60 text-purple-300 border border-purple-700 font-mono self-start sm:self-auto">
          {reports.length} Total Reports
        </Badge>
      </div>

      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
        {reports.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs italic">
            No issue reports submitted yet.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.reportId}
                className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-purple-300 bg-purple-950 px-2 py-0.5 rounded-md border border-purple-800">
                        {report.reportId}
                      </span>
                      <span className={`text-[10px] font-mono font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${statusVariants[report.status] || statusVariants.OPEN}`}>
                        {report.status}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-850 px-2 py-0.5 rounded-md">
                        {report.severity} Severity
                      </span>
                      <span className="text-xs text-slate-400">Category: {report.category}</span>
                    </div>

                    <h3 className="text-base font-extrabold text-white pt-1">{report.title}</h3>
                  </div>

                  {/* Status Transition Control */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-slate-400">Update Status:</span>
                    <select
                      value={report.status}
                      disabled={updatingReportId === report.reportId}
                      onChange={(e) => handleStatusChange(report.reportId, e.target.value, report.createdBy?.uid)}
                      className="bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500 cursor-pointer"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_REVIEW">IN_REVIEW</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900 p-4 rounded-xl border border-slate-800 font-medium">
                  {report.description}
                </p>

                {/* Attachment if present */}
                {report.attachmentUrl && (
                  <div className="flex items-center gap-2 text-xs font-medium text-purple-300 bg-purple-950/40 p-2.5 rounded-xl border border-purple-900/60">
                    <ExternalLink className="h-4 w-4 text-purple-400 shrink-0" />
                    <span>Attachment: {report.attachmentName || 'Download File'}</span>
                    <a
                      href={report.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto underline text-purple-400 hover:text-purple-200 font-bold"
                    >
                      View Attachment
                    </a>
                  </div>
                )}

                {/* Footer Metadata & Telemetry */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-850">
                  <div>Reported By: <strong className="text-slate-200">{report.createdBy?.name || 'User'} ({report.createdBy?.email})</strong></div>
                  <div>Route Context: <strong className="text-slate-200">{report.context?.currentRoute || 'N/A'}</strong></div>
                  <div className="text-right">Submitted {formatTimestamp(report.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
