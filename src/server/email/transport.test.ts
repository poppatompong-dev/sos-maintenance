import { describe, expect, it } from 'vitest';
import {
  createMockEmailTransport,
  createSmtpEmailTransport,
} from './transport';

describe('EmailTransport', () => {
  it('returns null from createSmtpEmailTransport when no host is provided or configured', () => {
    const transport = createSmtpEmailTransport({});
    expect(transport).toBeNull();
  });

  it('creates an SmtpEmailTransport instance when host is provided', () => {
    const transport = createSmtpEmailTransport({
      host: 'smtp.example.com',
      port: 587,
    });
    expect(transport).not.toBeNull();
    expect(typeof transport?.sendEmail).toBe('function');
  });

  it('delivers email via mock transport successfully', async () => {
    const log: Array<{ to: string; subject: string; text: string }> = [];
    const mock = createMockEmailTransport(log);

    const res = await mock.sendEmail({
      to: 'technician@nakhonsawan.go.th',
      subject: 'งานซ่อมเสา EP01',
      text: 'มีงานซ่อมใหม่ได้รับมอบหมาย',
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toBe('mock-msg-1');
    expect(log).toHaveLength(1);
    expect(log[0].to).toBe('technician@nakhonsawan.go.th');
    expect(log[0].subject).toBe('งานซ่อมเสา EP01');
  });

  it('returns error when mock transport is configured to fail', async () => {
    const mock = createMockEmailTransport([], true);

    const res = await mock.sendEmail({
      to: 'technician@nakhonsawan.go.th',
      subject: 'ทดสอบล้มเหลว',
      text: 'ข้อความทดสอบ',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Connection refused');
  });
});
