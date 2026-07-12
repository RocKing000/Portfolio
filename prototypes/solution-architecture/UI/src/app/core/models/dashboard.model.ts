export interface Layout {
  layoutId: string;
  userId: string;
  tenantId: string;
  layoutName: string;
  description?: string;
  gridConfig?: string;
  isDefault: boolean;
  isPublic: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  isOwner: boolean;
  permissionLevel: 'VIEW' | 'EDIT';
  ownerName?: string;
  widgetCount: number;
}

export interface LayoutDetails extends Layout {
  widgets: Widget[];
}

export interface Widget {
  widgetId: string;
  layoutId: string;
  widgetType: string;
  title?: string;
  position: string;
  config?: string;
  isLocked: boolean;
  isVisible: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetTemplate {
  templateId: string;
  templateName: string;
  widgetType: string;
  category: string;
  description?: string;
  defaultConfig?: string;
  defaultPosition?: string;
  isPremium: boolean;
  isActive: boolean;
}

export interface LayoutShare {
  shareId: string;
  layoutId: string;
  sharedWithUserId: string;
  sharedByUserId: string;
  permissionLevel: 'VIEW' | 'EDIT';
  createdAt: Date;
  sharedWithName?: string;
  sharedByName?: string;
}

export interface CreateLayoutRequest {
  layoutName: string;
  description?: string;
  gridConfig?: string;
  isDefault: boolean;
  isPublic?: boolean;
}

export interface AddWidgetRequest {
  layoutId: string;
  widgetType: string;
  title?: string;
  position: string;
  config?: string;
  displayOrder?: number;
}

export interface UpdateWidgetRequest {
  title?: string;
  config?: string;
  position?: string;
  isVisible?: boolean;
  isLocked?: boolean;
}

export interface ShareLayoutRequest {
  sharedWithUserId: string;
  permissionLevel: 'VIEW' | 'EDIT';
}
