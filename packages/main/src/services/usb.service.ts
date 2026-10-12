import type { UsbDeviceItem } from '@app/shared/types/usb';
import { usb as usbCore } from 'usb';

export class UsbService {
  /**
   * 获取当前主机所有已连接的 USB 设备列表并映射为安全元数据
   */
  public async getDeviceList(): Promise<UsbDeviceItem[]> {
    const rawDevices = await usbCore.getDevices();

    return rawDevices.map((d) => {
      const vendorHex = `0x${d.vendorId.toString(16).padStart(4, '0')}`;
      const productHex = `0x${d.productId.toString(16).padStart(4, '0')}`;

      return {
        vendorIdHex: vendorHex,
        productIdHex: productHex,
        vendorId: d.vendorId,
        productId: d.productId,
        productName: d.productName ?? null,
        manufacturerName: d.manufacturerName ?? null,
        serialNumber: d.serialNumber ?? null,
        deviceClass: d.deviceClass,
        deviceSubClass: d.deviceSubclass,
        deviceProtocol: d.deviceProtocol,
      };
    });
  }
}

export const usbService = new UsbService();
