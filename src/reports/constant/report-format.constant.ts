export const REPORT_FORMATS = ['formatted', 'decimal'] as const;

export type ReportFormat = (typeof REPORT_FORMATS)[number];


export const DEFAULT_REPORT_FORMAT: ReportFormat = 'formatted';
export const DECIMAL_REPORT_FORMAT: ReportFormat = 'decimal';
