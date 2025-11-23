import { Typography, Space, Breadcrumb } from 'antd';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

const { Title } = Typography;

export interface BreadcrumbItem {
  title: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  extra?: ReactNode;
}

export default function PageHeader({ title, subtitle, breadcrumbs, extra }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={breadcrumbs.map((item, index) => ({
            title: item.path ? (
              <Link to={item.path}>{item.title}</Link>
            ) : (
              item.title
            ),
            key: index,
          }))}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Space direction="vertical" size={4}>
          <Title level={4} style={{ margin: 0 }}>
            {title}
          </Title>
          {subtitle && (
            <Typography.Text type="secondary">{subtitle}</Typography.Text>
          )}
        </Space>
        {extra && <div>{extra}</div>}
      </div>
    </div>
  );
}
