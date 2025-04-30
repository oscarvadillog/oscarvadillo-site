import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const cronSecret = process.env.CRON_SECRET_TOKEN;
const emailTo = process.env.REPORT_EMAIL_TO;

const resend = new Resend(resendApiKey);

export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const token = body?.token;
  const userAgent = req.headers.get('user-agent') || '';

  if (!token || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized (token)' }, { status: 401 });
  }

  if (!userAgent.toLowerCase().includes('cron-job.org')) {
    return NextResponse.json({ error: 'Unauthorized (user-agent)' }, { status: 401 });
  }

  if (!resendApiKey || !emailTo) {
    return NextResponse.json({ error: 'Missing email config' }, { status: 500 });
  }

  try {
    const emailContent = `
      <h1>Reporte Mensual</h1>
      <p>Hola,</p>
      <p>Este es tu informe mensual automático generado el día ${new Date().toLocaleDateString()}.</p>
    `;

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: emailTo,
      subject: 'Informe mensual (Consumo ACS y Calefacción)',
      html: emailContent,
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
  }
}
