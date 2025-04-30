import { NextResponse } from 'next/server';
import { request } from 'undici';

const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_CONSUMPTION_DATABASE_ID;
const consumptionUrl = process.env.CONSUMPTION_URL_LOGIN;
const consumptionEmail = process.env.CONSUMPTION_EMAIL;
const consumptionPwd = process.env.CONSUMPTION_PWD;
const measureUrl = process.env.CONSUMPTION_URL_MEASURE;

export async function GET() {

  if (!notionToken) throw new Error('Environment variable NOTION_TOKEN is not defined');
  if (!databaseId) throw new Error('Environment variable NOTION_CONSUMPTION_DATABASE_ID is not defined');
  if (!consumptionEmail) throw new Error('Environment variable CONSUMPTION_EMAIL is not defined');
  if (!consumptionPwd) throw new Error('Environment variable CONSUMPTION_PWD is not defined');
  if (!consumptionUrl) throw new Error('Environment variable CONSUMPTION_URL_LOGIN is not defined');
  if (!measureUrl) throw new Error('Environment variable CONSUMPTION_URL_MEASURE is not defined');

  try {
    // Step 1: Login to the consumption endpoint
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

    const setCookieHeader = loginResponse.headers['set-cookie'];
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

    const cookieMap = cookies.reduce((acc, cookie) => {
      const match = cookie?.match(/^([^=]+)=([^;]+)/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {} as Record<string, string>);

    const { JSESSIONID, ['remember-me']: rememberMe } = cookieMap;

    if (!JSESSIONID || !rememberMe) {
      return NextResponse.json({ error: 'Missking session information' }, { status: 401 });
    }

    const cookieHeader = `JSESSIONID=${JSESSIONID}; remember-me=${rememberMe}`;

    // Step 2: Obtaining consumption measures
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

    // Step 3: Pushing information to the Notion database
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
          "Fecha": {
            date: {
              start: new Date().toISOString(),
            },
          },
          "Temperatura Impulsión": {
            number: filtered.temperatura_impulsion,
          },
          "Caudal": {
            number: filtered.caudal,
          },
          "Potencia": {
            number: filtered.potencia,
          },
          "Temperatura Retorno": {
            number: filtered.temperatura_retorno,
          },
          "Volumen": {
            number: filtered.volumen,
          },
          "Energía": {
            number: filtered.energia,
          },
          "Tiempo Funcionamiento": {
            number: filtered.tiempo_funcionamiento,
          },
          "Contador Agua": {
            number: filtered.contador_agua,
          },
        },
      }),
    });

    // Step 4: Returning response to the client
    return NextResponse.json(
      {
        success: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
