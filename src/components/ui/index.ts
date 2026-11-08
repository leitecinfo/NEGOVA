/**
 * NEGOVA Design System - Unified UI Components (@/components/ui)
 * 
 * Este módulo centraliza todos los componentes de interfaz reutilizables
 * tanto para Workspace como para módulos transversales, eliminando la duplicación
 * con @/components/admin/ui y unificando tokens de diseño y comportamiento.
 */

// 1. Componentes Canónicos Principales
export * from "./badge";
export * from "./button";
export * from "./confirm-dialog";
export * from "./confirm-modal";
export * from "./custom-modal";
export * from "./data-table";
export * from "./date-picker";
export * from "./empty-state";
export * from "./error-state";
export * from "./image-cropper-modal";
export * from "./input";
export * from "./kpi-card";
export * from "./loading-skeleton";
export * from "./logout-modal";
export * from "./modal-portal";
export * from "./number-input";
export * from "./pagination";
export * from "./search-input";
export * from "./search-select";
export * from "./select";
export * from "./status-badge";
export * from "./table-toolbar";
export * from "./tabs";
export * from "./textarea";
export * from "./user-avatar";
export { BarcodeScannerModal, type BarcodeScannerModalProps } from "@/components/scanner/barcode-scanner-modal";

// 2. Aliases Retrocompatibles (para migración progresiva sin rupturas)
export {
  Button as AdminButton,
  IconButton as AdminIconButton,
  ButtonGroup as AdminButtonGroup,
  type ButtonProps as AdminButtonProps,
  type IconButtonProps as AdminIconButtonProps,
  type ButtonVariant as AdminButtonVariant,
  type ButtonSize as AdminButtonSize,
} from "./button";

export {
  Input as AdminInput,
  type InputProps as AdminInputProps,
} from "./input";

export {
  SearchInput as AdminSearchInput,
  type SearchInputProps as AdminSearchInputProps,
} from "./search-input";

export {
  Select as AdminSelect,
  type SelectProps as AdminSelectProps,
  type SelectOption as AdminSelectOption,
} from "./select";

export {
  SearchSelect as AdminSearchSelect,
  type SearchSelectProps as AdminSearchSelectProps,
  type SearchSelectOption as AdminSearchSelectOption,
} from "./search-select";

export {
  KpiCard as AdminKpiCard,
  KpiGrid as AdminKpiGrid,
  type KpiVariant as AdminKpiVariant,
  type KpiCardProps as AdminKpiCardProps,
  type KpiGridProps as AdminKpiGridProps,
} from "./kpi-card";

export {
  Tabs as AdminTabs,
  type TabItem as AdminTabItem,
  type TabsProps as AdminTabsProps,
} from "./tabs";

export {
  DataTable as AdminDataTable,
  type DataTableColumn as AdminDataTableColumn,
  type DataTableProps as AdminDataTableProps,
} from "./data-table";

export {
  Pagination as AdminPagination,
  type PaginationProps as AdminPaginationProps,
} from "./pagination";

export {
  TableToolbar as AdminTableToolbar,
  type TableToolbarProps as AdminTableToolbarProps,
} from "./table-toolbar";

export {
  Badge as AdminBadge,
  type BadgeProps as AdminBadgeProps,
  type BadgeVariant as AdminBadgeVariant,
} from "./badge";

export {
  StatusBadge as AdminStatusBadge,
  type StatusBadgeProps as AdminStatusBadgeProps,
  type StatusBadgeVariant as AdminStatusBadgeVariant,
} from "./status-badge";

export {
  EmptyState as AdminEmptyState,
  type EmptyStateProps as AdminEmptyStateProps,
} from "./empty-state";

export {
  LoadingSkeleton as AdminLoadingSkeleton,
  TableSkeleton as AdminTableSkeleton,
  KpiSkeleton as AdminKpiSkeleton,
  CardSkeleton as AdminCardSkeleton,
} from "./loading-skeleton";

export {
  ErrorState as AdminErrorState,
  type ErrorStateProps as AdminErrorStateProps,
} from "./error-state";

export {
  ConfirmDialog as AdminConfirmDialog,
  type ConfirmDialogProps as AdminConfirmDialogProps,
  type ConfirmVariant as AdminConfirmVariant,
} from "./confirm-dialog";

export {
  LogoutModal as AdminLogoutModal,
  type LogoutModalProps as AdminLogoutModalProps,
} from "./logout-modal";
