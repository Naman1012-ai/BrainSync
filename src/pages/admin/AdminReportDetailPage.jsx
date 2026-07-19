import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { rtdbService } from '../../services/rtdbService';
import { adminService } from '../../services/adminService';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import {
  Flag,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Ban,
  XCircle,
  FileText,
  User,
  Clock,
} from 'lucide-react';

export default function AdminReportDetailPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (!reportId) return;
    setLoading(true);

    const unsubscribe = rtdbService.subscribe(`reports/${reportId}`, (data) => {
      setReport(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [reportId]);

  const handleUpdateStatus = async (newStatus) => {
    if (!report) return;
    setActionLoading(true);
    try {
      await adminService.updateReportStatus(
        reportId,
        newStatus,
        report.createdBy?.uid
      );
      await adminService.logAdminAudit(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        'UPDATE_REPORT_STATUS',
        reportId,
        `Updated report status to "${newStatus}"`
      );
      setToastMsg(`Report status updated to "${newStatus}".`);
    } catch (err) {
      setToastMsg(err.message || 'Failed to update report status.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !report) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  const statusColors = {
    OPEN: 'bg-amber-950 text-amber-300 border-amber-800',
    IN_REVIEW: 'bg-purple-950 text-purple-300 border-purple-800',
    RESOLVED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    DISMISSED: 'bg-slate-800 text-slate-400 border-slate-700',
    ESCALATED: 'bg-rose-950 text-rose-300 border-rose-800',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/admin/reports')}
          className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          Back to Reports Center
        </Button>

        <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs">
          Report Reference: {report.reportId}
        </Badge>
      </div>

      {toastMsg && (
        <div className="p-3.5 rounded-xl bg-purple-950/80 border border-purple-800 text-xs font-bold text-purple-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-purple-400" /> {toastMsg}
        </div>
      )}

      {/* Main Report Card */}
      <Card className="p-6 bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`text-xs font-mono font-extrabold uppercase px-3 py-0.5 rounded-full border ${statusColors[report.status] || statusColors.OPEN}`}>
                {report.status}
              </span>
              <span className="text-xs font-bold text-amber-400 bg-amber-950 px-2.5 py-0.5 rounded-md border border-amber-800">
                {report.severity} Severity
              </span>
              <span className="text-xs font-bold text-slate-300">Category: {report.category}</span>
            </div>
            <h1 className="text-xl font-black text-white pt-1">{report.title}</h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCircle2 className="h-4 w-4" />}
              onClick={() => handleUpdateStatus('RESOLVED')}
              isLoading={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              Resolve Report
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<XCircle className="h-4 w-4 text-slate-400" />}
              onClick={() => handleUpdateStatus('DISMISSED')}
              isLoading={actionLoading}
              className="bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs"
            >
              Dismiss
            </Button>
          </div>
        </div>

        {/* Detailed Explanation */}
        <div className="space-y-2">
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Report Details & Explanation</label>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed font-medium">
            {report.description}
          </div>
        </div>

        {/* Attachment Evidence */}
        {report.attachmentUrl && (
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">Attached Evidence File</label>
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-950/40 border border-purple-900/60 text-xs font-mono text-purple-200">
              <span className="truncate">{report.attachmentName || 'Attachment File'}</span>
              <a
                href={report.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="underline text-purple-400 hover:text-purple-200 font-bold flex items-center gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View File
              </a>
            </div>
          </div>
        )}

        {/* Context Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Reporter Attribution</span>
            <p className="text-white font-bold">{report.createdBy?.name || 'User'}</p>
            <p className="text-slate-400">{report.createdBy?.email}</p>
            <p className="text-purple-400 text-[10px]">{report.createdBy?.uid}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Telemetric Context</span>
            <p className="text-slate-300">Route: {report.context?.currentRoute || 'N/A'}</p>
            <p className="text-slate-300">OS: {report.context?.os || 'Unknown'}</p>
            <p className="text-slate-300">Submitted: {formatTimestamp(report.createdAt)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
