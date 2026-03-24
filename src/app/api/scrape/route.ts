import { NextRequest, NextResponse } from "next/server";
import { parseUrlParams, fetchInitialPage, fetchBoardByPostback, switchToNsSortView } from "@/lib/scraper/fitsys";
import { parseHandRecord, parseTravellerTable, detectScoringType } from "@/lib/scraper/parser";
import type { BoardData } from "@/lib/bridge/types";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes("fitsys.jp")) {
      return NextResponse.json(
        { error: "有効なfitsys.jpのURLを入力してください" },
        { status: 400 }
      );
    }

    const params = parseUrlParams(url);
    const fullUrl = `${params.baseUrl}?CC=${params.cc}&TC=${params.tc}&Id=${params.id}`;

    // Fetch initial page
    const initial = await fetchInitialPage(fullUrl);
    const boards: BoardData[] = [];

    // Detect scoring type from first board's table
    const scoringType = detectScoringType(initial.$);

    // For IMP format, switch to NS番号順 view to get per-pair data
    let firstPage = initial;
    if (scoringType === "IMP") {
      const nsSorted = await switchToNsSortView(fullUrl, initial.fields, 1);
      firstPage = { ...initial, $: nsSorted.$, fields: nsSorted.fields };
    }

    // Determine parser type based on scoring
    const parserType = scoringType === "IMP" ? "IMP_NS" : scoringType;

    // Parse first board
    const handText = firstPage.$("#txtHand").val() as string || "";
    const handData = parseHandRecord(handText);
    const travellers = parseTravellerTable(firstPage.$, parserType);

    boards.push({
      ...handData,
      travellers,
      ddsTable: null,
      bidding: null,
      comment: null,
    });

    // Fetch remaining boards
    let currentFields = firstPage.fields;

    for (let boardNum = 2; boardNum <= initial.totalBoards; boardNum++) {
      // Delay between requests
      await new Promise((r) => setTimeout(r, 500));

      try {
        const result = await fetchBoardByPostback(fullUrl, boardNum, currentFields);
        const boardHandText = result.$("#txtHand").val() as string || "";
        const boardHandData = parseHandRecord(boardHandText);
        // For IMP, switch to NS sort view for each board
        let boardPage = result;
        if (scoringType === "IMP") {
          const nsSorted = await switchToNsSortView(fullUrl, result.fields, boardNum);
          boardPage = nsSorted;
        }
        const boardTravellers = parseTravellerTable(boardPage.$, parserType);

        boards.push({
          ...boardHandData,
          travellers: boardTravellers,
          ddsTable: null,
          bidding: null,
          comment: null,
        });

        currentFields = boardPage.fields;
      } catch (err) {
        console.error(`Failed to fetch board ${boardNum}:`, err);
      }
    }

    return NextResponse.json({
      tournamentName: initial.tournamentName,
      tournamentDate: initial.tournamentDate,
      tournamentCode: params.tc,
      eventId: params.id,
      totalBoards: initial.totalBoards,
      scoringType,
      boards,
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました。URLを確認してください。" },
      { status: 500 }
    );
  }
}
