import { ApiOutlined, ReloadOutlined, UsbOutlined } from '@ant-design/icons';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { UsbDeviceItem } from '@shared/types/usb';
import { Badge, Button, Card, Empty, Skeleton, Tag } from 'antd';
import { memo } from 'react';
import { CardTitle } from '@/components/ui/CardTitle';

export interface IUsbCardProps {
  devices: UsbDeviceItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

const _UsbCard = (props: IUsbCardProps) => {
  useLingui();
  const { devices, isLoading, onRefresh } = props;

  const showSkeleton = isLoading && devices.length === 0;

  return (
    <Card
      className="glass-card transition-all duration-200 hover:border-border/80"
      title={
        <CardTitle
          icon={<UsbOutlined />}
          title={t`USB 硬件设备监控`}
          subtitle={t`基于 C++ 原生库 node-usb 探针`}
        />
      }
      extra={
        <div className="flex items-center gap-2">
          <Badge count={devices.length} overflowCount={99} style={{ backgroundColor: '#10b981' }} />
          <Button
            type="primary"
            size="small"
            icon={<ReloadOutlined />}
            loading={isLoading}
            onClick={onRefresh}
          >
            {t`刷新`}
          </Button>
        </div>
      }
    >
      {showSkeleton ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : devices.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t`未检测到连接的 USB 设备`} />
      ) : (
        <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto pr-1">
          {devices.map((device, idx) => {
            const displayName =
              device.productName ||
              (device.manufacturerName ? `${device.manufacturerName} Device` : t`未知 USB 设备`);

            return (
              <div
                key={`${device.vendorIdHex}-${device.productIdHex}-${idx}`}
                className="bg-background-secondary p-2.5 rounded-lg border border-border/60 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ApiOutlined />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{displayName}</div>
                    {device.manufacturerName && device.productName && (
                      <div className="text-[11px] text-foreground-secondary truncate">
                        {device.manufacturerName}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 font-mono">
                  <Tag color="blue" className="mr-0 text-[11px]">
                    VID: {device.vendorIdHex}
                  </Tag>
                  <Tag color="cyan" className="mr-0 text-[11px]">
                    PID: {device.productIdHex}
                  </Tag>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export const UsbCard = memo(_UsbCard);
