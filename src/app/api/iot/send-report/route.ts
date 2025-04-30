import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { request } from 'undici';

const resendApiKey = process.env.RESEND_API_KEY;
const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_CONSUMPTION_DATABASE_ID;
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

  // Validate token
  if (!token || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized (token)' }, { status: 401 });
  }

  // Validate that the request comes from cron-job.org
  if (!userAgent.toLowerCase().includes('cron-job.org')) {
    return NextResponse.json({ error: 'Unauthorized (user-agent)' }, { status: 401 });
  }

  // Check for missing configurations
  if (!resendApiKey || !notionToken || !databaseId || !emailTo) {
    return NextResponse.json({ error: 'Missing configuration' }, { status: 500 });
  }

  try {
    // Get current date in the Europe/Madrid timezone
    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    const year = localTime.getFullYear();
    const month = localTime.getMonth(); // 0-indexed

    // Calculate first and last day of the previous month
    const firstDayLastMonth = new Date(year, month - 1, 1);
    const lastDayLastMonth = new Date(year, month, 0);

    // Format dates as yyyy-mm-dd
    const startDate = firstDayLastMonth.toLocaleDateString('en-CA'); // e.g. "2025-04-01"
    const endDate = lastDayLastMonth.toLocaleDateString('en-CA');     // e.g. "2025-04-30"

    // Query Notion for entries in the previous month
    const notionDataResponse = await request(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          and: [
            {
              property: 'Fecha',
              date: {
                on_or_after: startDate,
              },
            },
            {
              property: 'Fecha',
              date: {
                on_or_before: endDate,
              },
            },
          ],
        },
      }),
    });

    interface NotionResult {
      properties: {
        Fecha: { created_time: string };
        'Temperatura Impulsión': { number: number };
        Caudal: { number: number };
        Potencia: { number: number };
        'Temperatura Retorno': { number: number };
        Volumen: { number: number };
        Energía: { number: number };
        'Tiempo Funcionamiento': { number: number };
        'Contador Agua': { number: number };
      };
    }

    const notionData = await notionDataResponse.body.json() as { results: NotionResult[] };
    const data = notionData.results;

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No data found for the previous month' }, { status: 404 });
    }

    // Build HTML table with data
    const htmlTable = `
      <h1>Monthly Consumption Report - ${firstDayLastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h1>
      <p>Hello,</p>
      <p>This is the monthly consumption report for ${firstDayLastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>
      <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
        <thead>
          <tr>
            <th>Date</th>
            <th>Temperatura Impulsión (°C)</th>
            <th>Caudal (m³/h)</th>
            <th>Potencia (kW)</th>
            <th>Temperatura Retorno (°C)</th>
            <th>Volumen (m³)</th>
            <th>Energía (kWh)</th>
            <th>Tiempo Funcionamiento (days)</th>
            <th>Contador Agua (m³)</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(entry => {
            const props = entry.properties;
            return `
              <tr>
                <td>${props.Fecha.created_time}</td>
                <td>${props['Temperatura Impulsión'].number}</td>
                <td>${props.Caudal.number}</td>
                <td>${props.Potencia.number}</td>
                <td>${props['Temperatura Retorno'].number}</td>
                <td>${props.Volumen.number}</td>
                <td>${props.Energía.number}</td>
                <td>${props['Tiempo Funcionamiento'].number}</td>
                <td>${props['Contador Agua'].number}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <p>Best regards,</p>
    `;

    // Email subject with previous month
    const subject = `Monthly Report (ACS and Heating Consumption) - ${firstDayLastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

    // Send email
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: emailTo,
      subject,
      html: htmlTable,
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
