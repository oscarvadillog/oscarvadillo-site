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

  // Validate user-agent is from cron-job.org
  if (!userAgent.toLowerCase().includes('cron-job.org')) {
    return NextResponse.json({ error: 'Unauthorized (user-agent)' }, { status: 401 });
  }

  // Check for missing configurations
  if (!resendApiKey || !notionToken || !databaseId || !emailTo) {
    return NextResponse.json({ error: 'Missing configuration' }, { status: 500 });
  }

  try {
    const today = new Date();
    const firstDayCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayLastMonth = new Date(firstDayCurrentMonth.getFullYear(), firstDayCurrentMonth.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(firstDayCurrentMonth.getFullYear(), firstDayCurrentMonth.getMonth(), 0);
    
    // Format as yyyy-mm-dd using toLocaleDateString with 'en-CA' locale (which outputs ISO format)
    const startDate = firstDayLastMonth.toLocaleDateString('en-CA'); // "2025-04-01"
    const endDate = lastDayLastMonth.toLocaleDateString('en-CA');    // "2025-04-30"

    // Fetch data from Notion for the previous month
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

    // Define an interface for the expected structure of the Notion data
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
    console.log('Notion data:', notionData);
    const data = notionData.results;

    // If no data is found, return an error
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No data found for the previous month' }, { status: 404 });
    }

    // Format the consumption data
    const formattedData = `
      <h1>Monthly Consumption Report - Previous Month</h1>
      <p>Hello,</p>
      <p>This is the monthly consumption report for the month of ${firstDayLastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>
      <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Temperatura Impulsión</th>
            <th>Caudal</th>
            <th>Potencia</th>
            <th>Temperatura Retorno</th>
            <th>Volumen</th>
            <th>Energía</th>
            <th>Tiempo Funcionamiento</th>
            <th>Contador Agua</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((entry: NotionResult) => {
            const consumo = entry.properties;
            return `
              <tr>
                <td>${consumo['Fecha'].created_time}</td>
                <td>${consumo['Temperatura Impulsión'].number} °C</td>
                <td>${consumo['Caudal'].number} m³/h</td>
                <td>${consumo['Potencia'].number} kW</td>
                <td>${consumo['Temperatura Retorno'].number} °C</td>
                <td>${consumo['Volumen'].number} m³</td>
                <td>${consumo['Energía'].number} kWh</td>
                <td>${consumo['Tiempo Funcionamiento'].number} days</td>
                <td>${consumo['Contador Agua'].number} m³</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <p>Best Regards.</p>
    `;

    // Get the previous month name for the subject
    const previousMonth = firstDayLastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Send the email with the previous month's consumption data
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: emailTo,
      subject: `Monthly Report (ACS and Heating Consumption) - ${previousMonth}`,
      html: formattedData,
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Error fetching Notion data or sending the email:', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
