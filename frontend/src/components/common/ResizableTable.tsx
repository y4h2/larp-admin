import { useState, useCallback } from 'react';
import { Table } from 'antd';
import type { TableProps, TableColumnType } from 'antd';
import { Resizable, type ResizeCallbackData } from 'react-resizable';
import 'react-resizable/css/styles.css';

// Resizable header cell component
interface ResizableHeaderCellProps extends React.HTMLAttributes<HTMLTableCellElement> {
  width: number;
  onResize: (e: React.SyntheticEvent, data: ResizeCallbackData) => void;
  resizable?: boolean;
}

function ResizableHeaderCell({
  width,
  onResize,
  resizable = true,
  ...restProps
}: ResizableHeaderCellProps) {
  if (!width || !resizable) {
    return <th {...restProps} />;
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          style={{
            position: 'absolute',
            right: -5,
            bottom: 0,
            width: 10,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 1,
          }}
          onClick={(e) => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ ...restProps.style, position: 'relative' }} />
    </Resizable>
  );
}

export interface ResizableColumn<T> extends TableColumnType<T> {
  resizable?: boolean;
}

interface ResizableTableProps<T> extends Omit<TableProps<T>, 'columns'> {
  columns: ResizableColumn<T>[];
  fixFirstColumn?: boolean;
}

export function ResizableTable<T extends object>({
  columns: initialColumns,
  fixFirstColumn = true,
  scroll,
  ...restProps
}: ResizableTableProps<T>) {
  // Track column widths in state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    initialColumns.forEach((col, index) => {
      const key = (col.key || col.dataIndex || index) as string;
      widths[key] = (col.width as number) || 150;
    });
    return widths;
  });

  // Handle column resize
  const handleResize = useCallback(
    (key: string) =>
      (_: React.SyntheticEvent, { size }: ResizeCallbackData) => {
        setColumnWidths((prev) => ({
          ...prev,
          [key]: size.width,
        }));
      },
    []
  );

  // Build columns with resize handlers and fixed first column
  const columns = initialColumns.map((col, index) => {
    const key = (col.key || col.dataIndex || index) as string;
    const width = columnWidths[key] || (col.width as number) || 150;
    const isFirstColumn = index === 0;
    const resizable = col.resizable !== false;

    return {
      ...col,
      width,
      // Fix first column if enabled
      fixed: fixFirstColumn && isFirstColumn ? ('left' as const) : col.fixed,
      onHeaderCell: () => ({
        width,
        onResize: handleResize(key),
        resizable,
      }),
    };
  });

  // Calculate total width for scroll
  const totalWidth = Object.values(columnWidths).reduce((sum, w) => sum + w, 0);

  // Custom header components
  const components = {
    header: {
      cell: ResizableHeaderCell,
    },
  };

  return (
    <Table
      {...restProps}
      columns={columns}
      components={components}
      scroll={{ x: Math.max(totalWidth, (scroll?.x as number) || 0), ...scroll }}
    />
  );
}

// Add CSS styles for resize handle
const style = document.createElement('style');
style.textContent = `
  .react-resizable {
    position: relative;
  }
  .react-resizable-handle {
    position: absolute;
    right: -5px;
    bottom: 0;
    width: 10px;
    height: 100%;
    cursor: col-resize;
    z-index: 1;
  }
  .react-resizable-handle:hover,
  .react-resizable-handle:active {
    background-color: rgba(24, 144, 255, 0.2);
  }
  /* Fixed column shadow */
  .ant-table-cell-fix-left-last::after {
    box-shadow: inset 10px 0 8px -8px rgba(0, 0, 0, 0.1) !important;
  }
`;
document.head.appendChild(style);

export default ResizableTable;
