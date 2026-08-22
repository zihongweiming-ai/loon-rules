/*
 * 京东快递去广告 for Loon
 * Target: 京东快递 iOS / jdlogistic
 * Capture verified: 2026-08-22, app 1.8.2
 * Host: lop-proxy.jd.com
 *
 * 原则：只处理明确的广告/营销场景，不拦截寄件、查件、登录、优惠券、会员、签到等业务接口。
 */

const url = $request.url || "";
const responseBody = $response.body || "";
const requestBody = $request.body || "";

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function finish(obj) {
  $done({ body: JSON.stringify(obj) });
}

function passthrough() {
  $done({});
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

const obj = parseJSON(responseBody);
if (!obj) {
  passthrough();
} else {
  try {
    // 1. 当前版本核心广告决策接口：按 sceneKey 精确清理。
    if (/\/decision(?:\?|$)/.test(url) && !/\/decisionAggregated(?:\?|$)/.test(url)) {
      const req = parseJSON(requestBody);
      const scenes = getSceneKeys(req);

      const blockedScenes = new Set([
        // 开屏广告
        "jdl_splash_screen",
        // 首页大图/商品 Feed 广告
        "jdl_home_feed_card",
        "jdl_home_feed_fwj_card",
        // 首页弹窗
        "app_jdkd_home_popup",
        // “找优惠”等营销提示弹层/角标
        "app_jdkd_tab_benefit_popup"
      ]);

      if (scenes.some((scene) => blockedScenes.has(scene))) {
        obj.data = [];
        if (obj.code === undefined) obj.code = 0;
        if (obj.message === undefined) obj.message = "SUCCESS";
        finish(obj);
      } else {
        passthrough();
      }

    // 2. 首页推荐卡：PLUS 联名卡 / 京寄卡 / 快递 E 卡。
    } else if (/\/decisionAggregated(?:\?|$)/.test(url)) {
      const req = parseJSON(requestBody);
      const scenes = getSceneKeys(req);
      const blockedAggregatedScenes = new Set([
        "jdl_home_rec_card_left",
        "jdl_home_rec_card_middle",
        "jdl_home_rec_card_right"
      ]);

      let changed = false;
      if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
        for (const scene of scenes) {
          if (blockedAggregatedScenes.has(scene) && Object.prototype.hasOwnProperty.call(obj.data, scene)) {
            obj.data[scene] = [];
            changed = true;
          }
        }
      }

      if (changed) finish(obj);
      else passthrough();

    // 3. 首页信息流营销卡：券包/京东商品等。
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

      if (changed) finish(obj);
      else passthrough();

    // 4. 兼容旧版：APP 首页开屏/营销推荐配置。
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
      finish(obj);

    // 5. 兼容旧版：首页 Banner/营销素材列表。
    } else if (/\/config\/queryContentListWithPage(?:\?|$)/.test(url)) {
      if (obj.data && typeof obj.data === "object") {
        obj.data.itemList = [];
        obj.data.currentItemCount = 0;
        obj.data.totalItems = 0;
        obj.data.totalPages = 0;
      }
      finish(obj);

    // 6. 兼容旧版：只在明确命中首页营销模板时清理，其他 CMS 配置放行。
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
          finish(obj);
        }
      } else {
        passthrough();
      }

    // 7. 兼容旧版：首页主信息中的明确广告容器。
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

      if (changed) finish(obj);
      else passthrough();

    } else {
      passthrough();
    }
  } catch (_) {
    passthrough();
  }
}
