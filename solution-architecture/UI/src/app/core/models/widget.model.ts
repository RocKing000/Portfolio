export interface WidgetPosition {
  row: number;
  col: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface WidgetConfig {
  title: string;
  dataSource: string;
  filters?: WidgetFilters;
  chartConfig?: ChartConfig;
  refreshInterval?: number;
}

export interface WidgetFilters {
  signalType?: string;
  source?: string;
  severity?: number;
  status?: string;
  periodType?: string;
  lastN?: number;
  limit?: number;
  orderBy?: string;
}

export interface ChartConfig {
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  colors?: string[];
  dimension?: string;
  measure?: string;
  orientation?: 'vertical' | 'horizontal';
  labels?: string[];
}

export interface GridConfig {
  columns: number;
  rowHeight: number;
  margin: number;
  containerPadding: number;
  isDraggable: boolean;
  isResizable: boolean;
  maxRows: number;
}
