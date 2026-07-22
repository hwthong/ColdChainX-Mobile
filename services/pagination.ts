export interface PagedResult<T> {
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  data: T[];
}
