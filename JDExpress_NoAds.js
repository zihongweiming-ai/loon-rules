/*
 * 京东快递去广告 for Loon
 * Capture verified: 2026-09-02
 * Compatible with single/double slash API paths observed on lop-proxy.jd.com.
 * Goal: remove splash / popup / marketing cards while preserving shipping, tracking,
 * coupons, help content and normal app resources.
 */

const url = ($request && $request.url) || "";
const isResponsePhase = typeof $response !== "undefined";

function toText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    if (typeof TextDecoder !== "undefined" && value instanceof Uint8Array) {
      return new TextDecoder("utf-8").decode(value);
    }
  } catch (_) {}
  try { return String(value); } catch (_) { return ""; }
}

function parseJSON(text) {
  try { return JSON.parse(toText(text)); } catch (_) { return null; }
}

function getSceneKeys(req) {
  if (!Array.isArray(req) || !req.length || !req[0] || typeof req[0] !== "object") return [];
  const root = req[0];
  const keys = [];
  if (typeof root.sceneKey === "string") keys.push(root.sceneKey);
  if (Array.isArray(root.items)) {
    for (const item of root.items) {
      if (item && typeof item.sceneKey === "string") keys.push(item.sceneKey);
    }
  }
  return keys;
}

const blockedDecisionScenes = new Set([
  "jdl_splash_screen",
  "jdl_home_feed_card",
  "jdl_home_feed_fwj_card",
  "app_jdkd_home_popup",
  "app_jdkd_tab_benefit_popup"
]);

const blockedAggregatedScenes = new Set([
  "jdl_home_rec_card_left",
  "jdl_home_rec_card_middle",
  "jdl_home_rec_card_right"
]);

const requestBody = toText(($request && $request.body) || "");
const requestObj = parseJSON(requestBody);
const scenes = getSceneKeys(requestObj);

function allScenesBlocked(set) {
  return scenes.length > 0 && scenes.every((scene) => set.has(scene));
}

function passthrough() { $done({}); }

function mockJSON(obj) {
  $done({
    response: {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(obj)
    }
  });
}

function mockEmptyDecision() {
  mockJSON({ code: 0, data: [], message: "SUCCESS", traceId: "loon-blocked" });
}

function emptySplashResponse() {
  const empty = {
    marketingConfigInfoDto: {},
    ruleBasicInfoDto: {},
    trafficControlInfoDto: { trafficStrategyType: 0 }
  };
  return {
    code: 1,
    content: empty,
    data: empty,
    errorMsg: "SUCCESS",
    msg: "SUCCESS",
    success: true
  };
}

function emptyNewPersonPopupResponse() {
  const empty = {
    businessLine: 2,
    contentDTO: null,
    couponDetail: null,
    isNewPerson: false
  };
  return {
    code: 1,
    content: empty,
    data: empty,
    errorMsg: "SUCCESS",
    msg: "SUCCESS",
    success: true
  };
}

function finishResponse(obj) { $done({ body: JSON.stringify(obj) }); }

// Normalize only for endpoint detection; keep the original request untouched.
const endpoint = url.replace(/^https:\/\/lop-proxy\.jd\.com\/+/, "/");

// REQUEST phase: dedicated ad endpoints can be answered locally to prevent flicker/cache.
if (!isResponsePhase) {
  if (/^\/decision(?:\?|$)/.test(endpoint) && !/^\/decisionAggregated(?:\?|$)/.test(endpoint)) {
    if (allScenesBlocked(blockedDecisionScenes)) {
      console.log(`[JDExpress_NoAds] request blocked decision: ${scenes.join(",")}`);
      mockEmptyDecision();
    } else {
      passthrough();
    }
  } else if (/^\/queryAppHomePageMarketingRecommendRuleConfigInfo(?:\?|$)/.test(endpoint)) {
    console.log("[JDExpress_NoAds] request blocked splash marketing config");
    mockJSON(emptySplashResponse());
  } else if (/^\/home\/queryNewPersonSceneDisplayContent(?:\?|$)/.test(endpoint)) {
    console.log("[JDExpress_NoAds] request blocked new-person popup");
    mockJSON(emptyNewPersonPopupResponse());
  } else {
    passthrough();
  }
} else {
  const responseBody = toText(($response && $response.body) || "");
  const obj = parseJSON(responseBody);

  if (!obj) {
    passthrough();
  } else {
    try {
      // 1. Decision-based splash / home popup / benefit popup.
      if (/^\/decision(?:\?|$)/.test(endpoint) && !/^\/decisionAggregated(?:\?|$)/.test(endpoint)) {
        if (allScenesBlocked(blockedDecisionScenes)) {
          obj.data = [];
          if (obj.code === undefined) obj.code = 0;
          if (obj.message === undefined) obj.message = "SUCCESS";
          finishResponse(obj);
        } else {
          passthrough();
        }

      // 2. Aggregated home recommendation cards.
      } else if (/^\/decisionAggregated(?:\?|$)/.test(endpoint)) {
        let changed = false;
        if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
          for (const scene of scenes) {
            if (blockedAggregatedScenes.has(scene) && Object.prototype.hasOwnProperty.call(obj.data, scene)) {
              obj.data[scene] = [];
              changed = true;
            }
          }
        }
        if (changed) finishResponse(obj); else passthrough();

      // 3. Feed-style recommendation cards.
      } else if (/^\/getHomePageFeedCards(?:\?|$)/.test(endpoint)) {
        let changed = false;
        if (obj.content && typeof obj.content === "object" && Array.isArray(obj.content.cardList)) {
          obj.content.cardList = [];
          changed = true;
        }
        if (obj.data && typeof obj.data === "object" && !obj.data.$ref && Array.isArray(obj.data.cardList)) {
          obj.data.cardList = [];
          changed = true;
        }
        if (changed) finishResponse(obj); else passthrough();

      // 4. Explicit splash ad config: response fallback.
      } else if (/^\/queryAppHomePageMarketingRecommendRuleConfigInfo(?:\?|$)/.test(endpoint)) {
        finishResponse(emptySplashResponse());

      // 5. New-user coupon popup: response fallback.
      } else if (/^\/home\/queryNewPersonSceneDisplayContent(?:\?|$)/.test(endpoint)) {
        finishResponse(emptyNewPersonPopupResponse());

      // 6. CMS list: only pos00007 is verified marketing (京寄卡 / PLUS); keep pos00011 help content.
      } else if (/^\/config\/queryContentListWithPage(?:\?|$)/.test(endpoint)) {
        const isMarketingSlot = /"resCode"\s*:\s*"pos00007"/i.test(requestBody);
        if (!isMarketingSlot) {
          passthrough();
        } else if (obj.data && typeof obj.data === "object") {
          obj.data.itemList = [];
          obj.data.currentItemCount = 0;
          obj.data.totalItems = 0;
          obj.data.totalPages = 0;
          finishResponse(obj);
        } else {
          passthrough();
        }

      // 7. CMS marketing modules. Verified: middle_market; keep resource/skin payload intact.
      } else if (/^\/queryCmsContentInfo(?:\?|$)/.test(endpoint)) {
        const isMarketingTemplate = /expressapp_online-(?:middle_market|template-market)/i.test(requestBody);
        if (!isMarketingTemplate || !obj.data || typeof obj.data !== "object" || typeof obj.data.content !== "string") {
          passthrough();
        } else {
          const content = parseJSON(obj.data.content);
          if (!content || typeof content !== "object") {
            passthrough();
          } else {
            const keys = [
              "marketList", "bannerList", "adList", "adsList", "popupList",
              "floatList", "floatWindow", "recommendList", "activityList",
              "promotionList", "resourceList", "mulResourceList"
            ];
            for (const key of keys) {
              if (Array.isArray(content[key])) content[key] = [];
              else if (content[key] && typeof content[key] === "object") content[key] = {};
            }
            obj.data.content = JSON.stringify(content);
            finishResponse(obj);
          }
        }

      // 8. Home main payload: clear only explicit marketing containers; preserve functions/navigation.
      } else if (/^\/queryHomeMainInfo(?:\?|$)/.test(endpoint)) {
        const keys = [
          "homeBanner", "homeYingxiao", "bannerList", "adList", "adsList",
          "popupList", "floatList", "floatWindow", "marketingList", "recommendAdList"
        ];
        let changed = false;
        for (const containerName of ["content", "data"]) {
          const container = obj[containerName];
          if (!container || typeof container !== "object" || container.$ref) continue;
          for (const key of keys) {
            if (Array.isArray(container[key])) {
              container[key] = [];
              changed = true;
            } else if (container[key] && typeof container[key] === "object") {
              container[key] = {};
              changed = true;
            }
          }
        }
        if (changed) finishResponse(obj); else passthrough();
      } else {
        passthrough();
      }
    } catch (e) {
      console.log(`[JDExpress_NoAds] error: ${e}`);
      passthrough();
    }
  }
}
