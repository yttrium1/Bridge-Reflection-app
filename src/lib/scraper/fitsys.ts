import * as cheerio from "cheerio";

interface ScrapedPage {
  html: string;
  viewState: string;
  viewStateGenerator: string;
  eventValidation: string;
}

function extractAspNetFields($: cheerio.CheerioAPI) {
  return {
    viewState: $("#__VIEWSTATE").val() as string || "",
    viewStateGenerator: $("#__VIEWSTATEGENERATOR").val() as string || "",
    eventValidation: $("#__EVENTVALIDATION").val() as string || "",
  };
}

async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "ja,en;q=0.9",
          ...(options?.headers || {}),
        },
      });
      if (response.ok) return response;
    } catch {
      if (i === retries - 1) throw new Error(`Failed to fetch after ${retries} retries: ${url}`);
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error(`Failed to fetch: ${url}`);
}

export function parseUrlParams(url: string) {
  const u = new URL(url);
  return {
    cc: u.searchParams.get("CC") || "",
    tc: u.searchParams.get("TC") || "",
    id: u.searchParams.get("Id") || "1",
    baseUrl: `${u.protocol}//${u.host}${u.pathname}`,
  };
}

export async function fetchInitialPage(url: string): Promise<{
  $: cheerio.CheerioAPI;
  fields: ReturnType<typeof extractAspNetFields>;
  totalBoards: number;
  tournamentName: string;
  tournamentDate: string;
}> {
  const response = await fetchWithRetry(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  const fields = extractAspNetFields($);

  const boardOptions = $("#ddlBoardId option");
  const totalBoards = boardOptions.length;

  const tournamentName = $("#lblTitle1").text().trim();
  const tournamentDate = $("#lblDate").text().trim();

  return { $, fields, totalBoards, tournamentName, tournamentDate };
}

export async function fetchBoardByPostback(
  url: string,
  boardNumber: number,
  fields: ReturnType<typeof extractAspNetFields>
): Promise<{
  $: cheerio.CheerioAPI;
  fields: ReturnType<typeof extractAspNetFields>;
}> {
  const body = new URLSearchParams({
    __EVENTTARGET: "ddlBoardId",
    __EVENTARGUMENT: "",
    __LASTFOCUS: "",
    __VIEWSTATE: fields.viewState,
    __VIEWSTATEGENERATOR: fields.viewStateGenerator,
    __EVENTVALIDATION: fields.eventValidation,
    ddlBoardId: String(boardNumber),
  });

  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const html = await response.text();
  const $ = cheerio.load(html);
  const newFields = extractAspNetFields($);

  return { $, fields: newFields };
}
