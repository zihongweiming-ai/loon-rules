/*
 * 京东快递去广告 for Loon
 * Target: 京东快递 iOS / jdlogistic 1.8.2
 * Capture verified: 2026-08-22
 * Fix: 2026-08-23 - 开屏改为 request 阶段直接返回空广告，并保留 response 阶段兜底。
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
  try {
    return String(value);
  } catch (_) {
    return "";
  }
}

function parseJSON(text) {
  try {
    return JSON.parse(toText(text));
  } catch (_) {
    return null;
  }
}

function getSceneKeys(req) {
  if (!Array.isArray(req) || !req.length || !req[0] || typeof req[0] !== "object") {
    return [];
  }
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

function passthrough() {
  $done({});
}

function mockEmptyDecision() {
  const body = JSON.stringify({
    code: 0,
    data: [],
    message: "SUCCESS",
    traceId: "loon-blocked"
  });
  $done({
    response: {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body
    }
  });
}

function finishResponse(obj) {
  $done({ body: JSON.stringify(obj) });
}

// ─────────────────────────────────────────────
// REQUEST 阶段：开屏等单场景广告直接在发出请求前返回空结果。
// 这样不会依赖服务器响应，也能减少开屏广告再次被缓存的机会。
// ─────────────────────────────────────────────
if (!isResponsePhase) {
  if (/\/decision(?:\?|$)/.test(url) && !/\/decisionAggregated(?:\?|$)/.test(url)) {
    if (allScenesBlocked(blockedDecisionScenes)) {
      console.log(`[JDExpress_NoAds] request blocked: ${scenes.join(",")}`);
      mockEmptyDecision();
    } else {
      passthrough();
    }
  } else {
    passthrough();
  }
} else {
  // ───────────────────────────────────────────
  // RESPONSE 阶段：继续作为兜底，并处理聚合卡片/CMS 等响应。
  // ───────────────────────────────────────────
  const responseBody = toText(($response && $response.body) || "");
  const obj = parseJSON(responseBody);

  if (!obj) {
    passthrough();
  } else {
    try {
      // 1. 单场景广告：开屏、首页 Feed、弹窗。
      if (/\/decision(?:\?|$)/.test(url) && !/\/decisionAggregated(?:\?|$)/.test(url)) {
        if (allScenesBlocked(blockedDecisionScenes)) {
          obj.data = [];
          if (obj.code === undefined) obj.code = 0;
          if (obj.message === undefined) obj.message = "SUCCESS";
          console.log(`[JDExpress_NoAds] response cleared: ${scenes.join(",")}`);
          finishResponse(obj);
        } else {
          passthrough();
        }

      // 2. 首页三张营销推荐卡。
      } else if (/\/decisionAggregated(?:\?|$)/.test(url)) {
        let changed = false;
        if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
          for (const scene of scenes) {
            if (blockedAggregatedScenes.has(scene) && Object.prototype.hasOwnProperty.call(obj.data, scene)) {
              obj.data[scene] = [];
              changed = true;
            }
          }
        }
        if (changed) finishResponse(obj);
        else passthrough();

      // 3. 首页“为您推荐”等营销信息流。
      } else if (/\/getHomePageFeedCards(?:\?|$)/.test(url)) {
        let changed = false;
        if (obj.content && typeof obj.content === "object" && Array.isArray(obj.content.cardList)) {
          obj.content.cardList = [];
          changed = true;
        }
        if (obj.data && typeof obj.data === "object" && !obj.data.$ref && Array.isArray(obj.data.cardList)) {
          obj.data.cardList = [];
          changed = true;
        }
        if (changed) finishResponse(obj);
        else passthrough();

      // 4. 旧版首页营销推荐配置兼容。
      } else if (/\/queryAppHomePageMarketingRecommendRuleConfigInfo(?:\?|$)/.test(url)) {
        const emptyContent = {
          marketingConfigInfoDto: {},
          ruleBasicInfoDto: {},
          trafficControlInfoDto: { trafficStrategyType: 0 }
        };
        obj.content = emptyContent;
        obj.data = emptyContent;
        obj.success = true;
        obj.errorMsg = "SUCCESS";
        obj.msg = "SUCCESS";
        finishResponse(obj);

      // 5. 旧版 Banner/营销素材列表兼容。
      } else if (/\/config\/queryContentListWithPage(?:\?|$)/.test(url)) {
        if (obj.data && typeof obj.data === "object") {
          obj.data.itemList = [];
          obj.data.currentItemCount = 0;
          obj.data.totalItems = 0;
          obj.data.totalPages = 0;
        }
        finishResponse(obj);

      // 6. CMS：首页营销模板才处理，其他 CMS 放行。
      } else if (/\/queryCmsContentInfo(?:\?|$)/.test(url)) {
        const isMarketTemplate = /expressapp_online-template-market/i.test(requestBody);
        if (!isMarketTemplate) {
          passthrough();
        } else if (obj.data && typeof obj.data === "object" && typeof obj.data.content === "string") {
          const content = parseJSON(obj.data.content);
          if (!content || typeof content !== "object") {
            passthrough();
          } else {
            const listKeys = [
              "marketList", "bannerList", "adList", "adsList", "popupList",
              "floatList", "floatWindow", "recommendList", "activityList",
              "promotionList", "resourceList", "mulResourceList"
            ];
            for (const key of listKeys) {
              if (Array.isArray(content[key])) content[key] = [];
              else if (content[key] && typeof content[key] === "object") content[key] = {};
            }
            obj.data.content = JSON.stringify(content);
            finishResponse(obj);
          }
        } else {
          passthrough();
        }

      // 7. 首页主信息中的明确广告容器。
      } else if (/\/queryHomeMainInfo(?:\?|$)/.test(url)) {
        const keys = [
          "homeBanner", "bannerList", "adList", "adsList", "popupList",
          "floatList", "floatWindow", "marketingList", "recommendAdList"
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
        if (changed) finishResponse(obj);
        else passthrough();
      } else {
        passthrough();
      }
    } catch (e) {
      console.log(`[JDExpress_NoAds] error: ${e}`);
      passthrough();
    }
  }
}
