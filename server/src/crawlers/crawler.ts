import fetch from "node-fetch";
import Encoding from "encoding-japanese";
import cheerio from "cheerio";

import { dbConnect } from "../utils/mongo";
import sleep from "../utils/sleep";
import { getGeoFromText } from "../utils/googleMapApi";
import normalizeAddress from "../utils/address";
import GameCenterModel, { GameCenter, Info } from "../models/gameCenter";

export type GameCenterWithRawAddress = Pick<GameCenter, Exclude<keyof GameCenter, "address" | "geo">> & {
  rawAddress: string;
  geo?: { lat: number; lng: number };
};

// TODO consider to remove getPaginatedUrls to simplify this class?
export default class Crawler {
  sourceId: string;
  // For web site like bemani eagate, we have to crawl it multiple times for different games.
  // We don't want to duplicate game center infos in database, so we will set the same sourceId for all these "bemani crawlers",
  // but set different gameSourceId for "iidx bemani crawler" and "ddr bemani crawler"
  gameSourceId: string;
  updateTime: Date;
  urls: string[];
  fetchHeaders: any;

  getPaginatedUrls: (url: string) => string[] | Promise<string[]>;
  getList: (page: CheerioStatic) => any[];
  getItem: (item: any, cheerioSelector: Cheerio) => GameCenterWithRawAddress | Promise<GameCenterWithRawAddress> | null;

  constructor({
    sourceId,
    gameSourceId,
    urls,
    getPaginatedUrls = url => [url],
    getList,
    getItem,
    fetchHeaders = {}
  }: {
    sourceId: string;
    gameSourceId?: string;
    urls: string[];
    getPaginatedUrls?: (url: string) => string[] | Promise<string[]>;
    getList: (html: CheerioStatic) => any[];
    getItem: (item: any, cheerioSelector: Cheerio) => GameCenterWithRawAddress | Promise<GameCenterWithRawAddress>;
    fetchHeaders?: any;
  }) {
    this.sourceId = sourceId;
    this.gameSourceId = gameSourceId || sourceId;
    this.urls = urls;
    this.getPaginatedUrls = getPaginatedUrls;
    this.getList = getList;
    this.getItem = getItem;
    this.fetchHeaders = fetchHeaders;

    this.updateTime = new Date();
  }

  // fetch page with header and try to find the right encoding to decode
  static async fetchPage(url: string, headers?: any): Promise<string> {
    const htmlBuffer = await fetch(url, { headers }).then(res => res.arrayBuffer());
    const htmlUnit8Array = new Uint8Array(htmlBuffer);
    const unicodeArray = Encoding.convert(htmlUnit8Array, {
      to: "UNICODE",
      from: Encoding.detect(htmlUnit8Array),
      type: "array"
    });

    // @ts-ignore we know unicodeArray is always number[]
    const htmlText = Encoding.codeToString(unicodeArray);
    return htmlText;
  }

  async crawlOnePage(url: string): Promise<GameCenter[]> {
    const addAdditionInfo = (sourceId: string) => (item: Info) => ({
      ...item,
      url,
      sourceId,
      updateTime: this.updateTime
    });

    const html = await Crawler.fetchPage(url, this.fetchHeaders);

    const $ = cheerio.load(html);
    const items: (GameCenter | null)[] = await Promise.all(
      this.getList($).map(async item => {
        const rawItem = await this.getItem(item, $(item));
        if (!rawItem) return null;

        const address = await normalizeAddress(rawItem.rawAddress);

        if (!address) return null;

        if (rawItem.geo) {
          return { ...rawItem, geo: rawItem.geo, address };
        } else {
          // if there is no geo information
          const addressTextWithoutBuilding = address.region + address.town + address.number;
          const geo = await getGeoFromText(addressTextWithoutBuilding);
          return { ...rawItem, geo, address };
        }
      })
    );

    console.log("crawling:", url, "results:", items.length);
    // Add crawler info
    return items
      .filter(x => x)
      .map(gameCenterItem => ({
        ...gameCenterItem,
        infos: gameCenterItem.infos.map(addAdditionInfo(this.sourceId)),
        games: gameCenterItem.games.map(gameItem => ({
          ...gameItem,
          infos: gameItem.infos.map(addAdditionInfo(this.gameSourceId))
        }))
      }));
  }

  async start() {
    const db = dbConnect();

    const that = this;
    const paginatedUrls = await Promise.all(this.urls.map(this.getPaginatedUrls));
    this.urls = [].concat(...paginatedUrls);

    this.urls.forEach(url => console.log("target urls:", url));

    const promises = [];
    for (let i = 0; i < this.urls.length; i++) {
      promises.push(this.crawlOnePage(this.urls[i]));
      await sleep(3);
    }
    const results = await Promise.all(promises);
    const flatResults = ([] as GameCenter[]).concat(...results);

    console.log("flatResults.length:", flatResults.length);

    let newGameCenterCount = 0;
    // TODO remove all information from that source if there are results from same source (how to check?)
    for (let i = 0; i < flatResults.length; i++) {
      const gameCenterItem = flatResults[i];

      // TODO change here
      let gameCenterEntity = await GameCenterModel.findSameGameCenter(gameCenterItem);
      if (!gameCenterEntity) {
        console.log("New Game Center!", gameCenterItem);
        newGameCenterCount++;
        gameCenterEntity = new GameCenterModel({
          ...gameCenterItem,
          infos: [],
          games: []
        });
      }

      // TODO try to move this part to schema?
      // clear previous info from this source
      gameCenterEntity.infos = gameCenterEntity.infos.filter(info => info.sourceId !== that.sourceId);
      // add new info
      gameCenterEntity.infos = [...gameCenterEntity.infos, ...gameCenterItem.infos];
      gameCenterItem.games.forEach(gameItem => {
        let currentGame;
        let index = gameCenterEntity.games.findIndex(x => x.name === gameItem.name);
        if (index >= 0) {
          let currentGameInfos = gameCenterEntity.games[index].infos;
          // clear previous info from this source
          currentGameInfos = currentGameInfos.filter(info => info.sourceId !== that.gameSourceId);
          gameCenterEntity.games[index].infos = [...currentGameInfos, ...gameItem.infos];
        } else {
          currentGame = { name: gameItem.name, infos: gameItem.infos };
          gameCenterEntity.games.push(currentGame);
        }
      });

      await gameCenterEntity.save();
    }
    console.log(`Saved ${flatResults.length} Items, new game center: ${newGameCenterCount}`);

    db.close();
  }
}
