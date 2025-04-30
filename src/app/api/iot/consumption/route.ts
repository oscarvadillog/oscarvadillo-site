import { NextResponse } from 'next/server';
import { request } from 'undici';

const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_CONSUMPTION_DATABASE_ID;
const consumptionUrl = process.env.CONSUMPTION_URL_LOGIN;
const consumptionEmail = process.env.CONSUMPTION_EMAIL;
const consumptionPwd = process.env.CONSUMPTION_PWD;
const measureUrl = process.env.CONSUMPTION_URL_MEASURE;
const cronSecret = process.env.CRON_SECRET_TOKEN;

export async function POST(req: Request) {
  // Parse JSON body to extract the secret token
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const token = body?.token;

  // Validate secret token
  if (!token || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized (token)' }, { status: 401 });
  }

  // Validate that request is from cron-job.org using User-Agent
  const userAgent = req.headers.get('user-agent') || '';
  if (!userAgent.toLowerCase().includes('cron-job.org')) {
    return NextResponse.json({ error: 'Unauthorized (user-agent)' }, { status: 401 });
  }

  // Check for required environment variables
  if (!notionToken || !databaseId || !consumptionEmail || !consumptionPwd || !consumptionUrl || !measureUrl) {
    return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
  }

  try {
    // Step 1: Login to external system
    const formBody = new URLSearchParams();
    formBody.append('email', consumptionEmail);
    formBody.append('login', consumptionPwd);
    formBody.append('remember-check', 'on');

    const loginResponse = await request(consumptionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });

    // Extract cookies from login response
    const setCookieHeader = loginResponse.headers['set-cookie'];
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

    const cookieMap = cookies.reduce((acc, cookie) => {
      const match = cookie?.match(/^([^=]+)=([^;]+)/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {} as Record<string, string>);

    const { JSESSIONID, ['remember-me']: rememberMe } = cookieMap;

    if (!JSESSIONID || !rememberMe) {
      return NextResponse.json({ error: 'Missing session info' }, { status: 401 });
    }

    const cookieHeader = `JSESSIONID=${JSESSIONID}; remember-me=${rememberMe}`;

    // Step 2: Fetch measurement data
    const dataResponse = await request(measureUrl, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
      },
    });

    const dataText = await dataResponse.body.text();
    const dataParsed = JSON.parse(dataText);

    const filtered = {
      temperatura_impulsion: dataParsed.mBus121Forward,
      caudal: dataParsed.mBus121Flow,
      potencia: dataParsed.mBus121Power,
      temperatura_retorno: dataParsed.mBus121Return,
      volumen: dataParsed.mBus121Volume,
      energia: dataParsed.mBus121Energy,
      tiempo_funcionamiento: dataParsed.mBus121OnTime,
      contador_agua: dataParsed.mBus121Pulse3,
    };

    // Step 3: Send data to Notion database
    await request('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: {
          database_id: databaseId,
        },
        properties: {
          "Fecha": { date: { start: new Date().toISOString() } },
          "Temperatura Impulsión": { number: filtered.temperatura_impulsion },
          "Caudal": { number: filtered.caudal },
          "Potencia": { number: filtered.potencia },
          "Temperatura Retorno": { number: filtered.temperatura_retorno },
          "Volumen": { number: filtered.volumen },
          "Energía": { number: filtered.energia },
          "Tiempo Funcionamiento": { number: filtered.tiempo_funcionamiento },
          "Contador Agua": { number: filtered.contador_agua },
        },
      }),
    });

    // Step 4: Return success response
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
