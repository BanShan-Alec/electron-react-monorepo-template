import { ApiOutlined, ReloadOutlined, UsbOutlined } from '@ant-design/icons';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { UsbDeviceItem } from '@shared/types/usb';
import { Badge, Button, Empty, Skeleton, Tag } from 'antd';
import { memo } from 'react';
import { AppCard } from '@/components/ui/AppCard';
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
    <AppCard
      title={
        <CardTitle
          icon={<UsbOutlined />}
          title={t`USB 硬件设备监控`}
          subtitle={t`基于 C++ 原生库 node-usb 探针`}
        />
      }
      extra={
        <div className="flex items-center gap-2">
          <Badge count={devices.length} overflowCount={99} color="var(--color-success)" />
          <Button size="small" icon={<ReloadOutlined />} loading={isLoading} onClick={onRefresh}>
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
          {devices.map((device) => {
            const displayName =
              device.productName ||
              (device.manufacturerName ? `${device.manufacturerName} Device` : t`未知 USB 设备`);
            const deviceKey =
              device.serialNumber ||
              `${device.vendorIdHex}-${device.productIdHex}-${device.deviceClass}-${device.deviceSubClass ?? 0}-${device.deviceProtocol ?? 0}`;

            return (
              <div
                key={deviceKey}
                className="bg-background-sunken p-2.5 rounded-lg border border-border/60 flex items-center justify-between gap-3 text-xs select-text"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ApiOutlined />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{displayName}</div>
                    {device.manufacturerName && device.productName && (
                      <div className="text-xs text-foreground-secondary truncate">
                        {device.manufacturerName}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 font-mono">
                  <Tag color="blue" className="mr-0 text-xs">
                    VID: {device.vendorIdHex}
                  </Tag>
                  <Tag color="cyan" className="mr-0 text-xs">
                    PID: {device.productIdHex}
                  </Tag>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppCard>
  );
};

export const UsbCard = memo(_UsbCard);
