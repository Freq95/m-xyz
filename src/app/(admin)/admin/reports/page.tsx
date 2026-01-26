'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, Button, Avatar } from '@/components/ui';
import { Flag, Eye, Ban, EyeOff, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Reporter {
  id: string;
  displayName: string | null;
  fullName: string;
  avatarUrl: string | null;
}

interface Report {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  actionTaken: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reporter: Reporter;
  reviewer: Reporter | null;
}

interface ReportWithTarget extends Report {
  target: {
    id: string;
    title?: string;
    body?: string;
    status?: string;
    author?: Reporter;
    displayName?: string;
    fullName?: string;
    avatarUrl?: string | null;
    bio?: string;
    isBanned?: boolean;
    post?: { id: string; title: string | null };
  } | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'În așteptare', color: 'bg-orange-500/10 text-orange-500' },
  reviewed: { label: 'Rezolvat', color: 'bg-green-500/10 text-green-500' },
  dismissed: { label: 'Respins', color: 'bg-gray-500/10 text-gray-500' },
};

const targetTypeLabels: Record<string, string> = {
  post: 'Postare',
  comment: 'Comentariu',
  user: 'Utilizator',
};

export default function AdminReportsPage() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status') || 'pending';

  const [reports, setReports] = useState<Report[]>([]);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState<ReportWithTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  const fetchReports = useCallback(async (reset = true) => {
    if (reset) {
      setIsLoading(true);
    }

    try {
      const params = new URLSearchParams({ limit: '20' });
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (!reset && cursor) {
        params.append('cursor', cursor);
      }

      const response = await fetch(`/api/admin/reports?${params}`);
      const result = await response.json();

      if (response.ok) {
        if (reset) {
          setReports(result.data.reports);
        } else {
          setReports((prev) => [...prev, ...result.data.reports]);
        }
        setCursor(result.meta?.cursor);
        setHasMore(result.meta?.hasMore || false);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, cursor]);

  useEffect(() => {
    setCursor(undefined);
    fetchReports(true);
  }, [statusFilter]);

  const fetchReportDetails = async (reportId: string) => {
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`);
      const result = await response.json();
      if (response.ok) {
        setReportDetails(result.data.report);
      }
    } catch (error) {
      console.error('Failed to fetch report details:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleExpand = async (reportId: string) => {
    if (expandedReport === reportId) {
      setExpandedReport(null);
      setReportDetails(null);
    } else {
      setExpandedReport(reportId);
      await fetchReportDetails(reportId);
    }
  };

  const handleAction = async (
    reportId: string,
    action: 'hide_content' | 'ban_user' | 'dismiss' | 'resolve'
  ) => {
    setActionLoading(`${reportId}-${action}`);

    try {
      // Get the report details to know the target
      const report = reports.find((r) => r.id === reportId);
      if (!report) return;

      // Perform the action based on type
      if (action === 'hide_content') {
        const endpoint =
          report.targetType === 'post'
            ? `/api/admin/posts/${report.targetId}`
            : `/api/admin/comments/${report.targetId}`;

        await fetch(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'hide', reason: report.reason }),
        });

        // Then resolve the report
        await fetch(`/api/admin/reports/${reportId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resolve', actionTaken: 'content_hidden' }),
        });
      } else if (action === 'ban_user') {
        const userId = report.targetType === 'user'
          ? report.targetId
          : reportDetails?.target?.author?.id;

        if (userId) {
          await fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ban', reason: report.reason }),
          });

          await fetch(`/api/admin/reports/${reportId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'resolve', actionTaken: 'user_banned' }),
          });
        }
      } else if (action === 'dismiss') {
        await fetch(`/api/admin/reports/${reportId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'dismiss' }),
        });
      } else if (action === 'resolve') {
        await fetch(`/api/admin/reports/${reportId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resolve', actionTaken: 'reviewed' }),
        });
      }

      // Refresh reports
      fetchReports(true);
      setExpandedReport(null);
      setReportDetails(null);
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Rapoarte</h1>

        {/* Status Filter */}
        <div className="flex gap-2">
          {['pending', 'reviewed', 'dismissed', 'all'].map((status) => (
            <a
              key={status}
              href={`/admin/reports?status=${status}`}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                statusFilter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {status === 'all'
                ? 'Toate'
                : status === 'pending'
                ? 'În așteptare'
                : status === 'reviewed'
                ? 'Rezolvate'
                : 'Respinse'}
            </a>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-secondary rounded w-1/3 mb-2" />
              <div className="h-3 bg-secondary rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card className="p-8 text-center">
          <Flag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nu există rapoarte</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const isExpanded = expandedReport === report.id;
            const statusInfo = statusLabels[report.status] || statusLabels.pending;

            return (
              <Card key={report.id} className="overflow-hidden">
                {/* Report Header */}
                <button
                  onClick={() => handleExpand(report.id)}
                  className="w-full p-4 flex items-center gap-4 text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {targetTypeLabels[report.targetType] || report.targetType}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{report.reason}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Raportat de {report.reporter.displayName || report.reporter.fullName} •{' '}
                      {formatDate(report.createdAt)}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border p-4 bg-secondary/30">
                    {isLoadingDetails ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-secondary rounded w-1/2" />
                        <div className="h-20 bg-secondary rounded" />
                      </div>
                    ) : reportDetails ? (
                      <>
                        {/* Target Content */}
                        <div className="mb-4">
                          <p className="text-xs text-muted-foreground mb-2">Conținut raportat:</p>
                          {reportDetails.target ? (
                            <Card className="p-3 bg-background">
                              {reportDetails.targetType === 'post' && (
                                <>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Avatar
                                      src={reportDetails.target.author?.avatarUrl}
                                      fallback={
                                        reportDetails.target.author?.displayName ||
                                        reportDetails.target.author?.fullName ||
                                        '?'
                                      }
                                      size="sm"
                                    />
                                    <span className="text-sm font-medium">
                                      {reportDetails.target.author?.displayName ||
                                        reportDetails.target.author?.fullName}
                                    </span>
                                    {reportDetails.target.status === 'hidden' && (
                                      <span className="px-2 py-0.5 bg-gray-500/10 text-gray-500 rounded text-xs">
                                        Ascuns
                                      </span>
                                    )}
                                  </div>
                                  {reportDetails.target.title && (
                                    <p className="font-medium mb-1">{reportDetails.target.title}</p>
                                  )}
                                  <p className="text-sm text-muted-foreground line-clamp-3">
                                    {reportDetails.target.body}
                                  </p>
                                </>
                              )}

                              {reportDetails.targetType === 'comment' && (
                                <>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Avatar
                                      src={reportDetails.target.author?.avatarUrl}
                                      fallback={
                                        reportDetails.target.author?.displayName ||
                                        reportDetails.target.author?.fullName ||
                                        '?'
                                      }
                                      size="sm"
                                    />
                                    <span className="text-sm font-medium">
                                      {reportDetails.target.author?.displayName ||
                                        reportDetails.target.author?.fullName}
                                    </span>
                                    {reportDetails.target.status === 'hidden' && (
                                      <span className="px-2 py-0.5 bg-gray-500/10 text-gray-500 rounded text-xs">
                                        Ascuns
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground line-clamp-3">
                                    {reportDetails.target.body}
                                  </p>
                                  {reportDetails.target.post && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      Pe postarea: {reportDetails.target.post.title || 'Fără titlu'}
                                    </p>
                                  )}
                                </>
                              )}

                              {reportDetails.targetType === 'user' && (
                                <div className="flex items-center gap-3">
                                  <Avatar
                                    src={reportDetails.target.avatarUrl}
                                    fallback={
                                      reportDetails.target.displayName ||
                                      reportDetails.target.fullName ||
                                      '?'
                                    }
                                    size="lg"
                                  />
                                  <div>
                                    <p className="font-medium">
                                      {reportDetails.target.displayName ||
                                        reportDetails.target.fullName}
                                    </p>
                                    {reportDetails.target.bio && (
                                      <p className="text-sm text-muted-foreground">
                                        {reportDetails.target.bio}
                                      </p>
                                    )}
                                    {reportDetails.target.isBanned && (
                                      <span className="inline-block mt-1 px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-xs">
                                        Suspendat
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Card>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              Conținutul nu mai există
                            </p>
                          )}
                        </div>

                        {/* Report Details */}
                        {report.details && (
                          <div className="mb-4">
                            <p className="text-xs text-muted-foreground mb-1">Detalii:</p>
                            <p className="text-sm">{report.details}</p>
                          </div>
                        )}

                        {/* Actions */}
                        {report.status === 'pending' && (
                          <div className="flex flex-wrap gap-2">
                            {(reportDetails.targetType === 'post' ||
                              reportDetails.targetType === 'comment') &&
                              reportDetails.target?.status !== 'hidden' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAction(report.id, 'hide_content')}
                                  isLoading={actionLoading === `${report.id}-hide_content`}
                                  disabled={!!actionLoading}
                                >
                                  <EyeOff className="w-4 h-4 mr-1" />
                                  Ascunde conținut
                                </Button>
                              )}

                            {reportDetails.target &&
                              !reportDetails.target.isBanned &&
                              (reportDetails.targetType === 'user' ||
                                reportDetails.target.author) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                                  onClick={() => handleAction(report.id, 'ban_user')}
                                  isLoading={actionLoading === `${report.id}-ban_user`}
                                  disabled={!!actionLoading}
                                >
                                  <Ban className="w-4 h-4 mr-1" />
                                  Suspendă utilizator
                                </Button>
                              )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(report.id, 'resolve')}
                              isLoading={actionLoading === `${report.id}-resolve`}
                              disabled={!!actionLoading}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Marchează rezolvat
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAction(report.id, 'dismiss')}
                              isLoading={actionLoading === `${report.id}-dismiss`}
                              disabled={!!actionLoading}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Respinge
                            </Button>
                          </div>
                        )}

                        {/* Review Info */}
                        {report.status !== 'pending' && report.reviewedAt && (
                          <div className="text-xs text-muted-foreground mt-2">
                            {report.actionTaken === 'dismissed' ? 'Respins' : 'Rezolvat'} de{' '}
                            {report.reviewer?.displayName || report.reviewer?.fullName || 'Admin'}{' '}
                            pe {formatDate(report.reviewedAt)}
                            {report.actionTaken && report.actionTaken !== 'dismissed' && (
                              <> • Acțiune: {report.actionTaken}</>
                            )}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Load More */}
          {hasMore && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={() => fetchReports(false)}>
                Mai multe rapoarte
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
