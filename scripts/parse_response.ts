import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';
import { tableToJson } from '../server/src/utils';

const filePath = '/Users/victorgallegos/Downloads/response.html';
const html = fs.readFileSync(filePath, 'utf8');
const $ = load(html);

const tables: any[] = [];
$('table').each((i, t) => {
  try {
    const parsed = tableToJson($, t, i);
    tables.push(parsed);
  } catch (err) {
    tables.push({ error: String(err) });
  }
});

console.log(JSON.stringify(tables, null, 2));
